import {
  beneficiario,
  categoria,
  movimentacao,
  projetoAssunto,
  projetoCoautor,
  projetoLei,
  tramitacaoComissao,
  votacaoProjeto,
  type ResultadoDeVotacao,
} from '@gabinete/banco';
import { eq } from 'drizzle-orm';
import {
  beneficiariosDeExemplo,
  comissoesDeExemplo,
  logradourosDeExemplo,
  pareceresDeExemplo,
  projetosDeExemplo,
} from './conteudo-legislativo.js';
import { nomes, sobrenomes } from './conteudo.js';
import { comArea, contar, registrarNaTrilha, type Contexto } from './contexto.js';

/** Calcula os dois dígitos verificadores de uma base de 12 caracteres, como a Receita Federal. */
export function cnpjComDigitos(base: string): string {
  const digito = (texto: string, pesos: readonly number[]) => {
    const soma = [...texto].reduce((s, c, i) => s + (c.charCodeAt(0) - 48) * (pesos[i] ?? 0), 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  const d1 = digito(base, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = digito(base + d1, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return `${base}${d1}${d2}`;
}

const inativos = 2;
const projetosCancelados = 2;

/** O caminho principal do fluxo federal; depois dele, o projeto termina num dos finais. */
const caminhoPrincipal = [
  'Em redação',
  'Protocolado',
  'Na comissão de constituição e justiça',
  'Nas comissões de mérito',
  'Pronto para pauta',
  'Em votação',
  'Na casa revisora',
  'Aprovado, aguardando sanção',
] as const;
const finais = ['Sancionado', 'Vetado', 'Rejeitado', 'Arquivado'] as const;

const prefixoDoTipo: Record<string, string> = {
  'Projeto de lei': 'PL',
  'Projeto de lei complementar': 'PLP',
  'Projeto de decreto legislativo': 'PDL',
  'Proposta de emenda à Constituição': 'PEC',
  Requerimento: 'REQ',
  Indicação: 'INC',
};

/**
 * Legislativo: beneficiários (municípios, órgãos e entidades, com CNPJ válido, dois deles inativos) e
 * projetos de lei em todas as etapas do fluxo federal, com assuntos, coautores, passagem por
 * comissões e votações. Há projetos atrasados, concluídos, arquivados e cancelados.
 */
export async function popularLegislativo(ctx: Contexto): Promise<void> {
  await popularBeneficiarios(ctx);
  await popularProjetos(ctx);
}

async function popularBeneficiarios(ctx: Contexto): Promise<void> {
  const { sorteio, relogio } = ctx;
  const quemCadastra = comArea(ctx, 'LG').filter((c) => c.perfil !== 'assessor_externo');
  const criador = quemCadastra[0];
  if (!criador) return;

  const linhas: (typeof beneficiario.$inferInsert)[] = beneficiariosDeExemplo.map((b, i) => ({
    nomeFantasia: b.nomeFantasia,
    razaoSocial: b.razaoSocial,
    cnpj: cnpjComDigitos(`${String(10_000_000 + i * 137_251).padStart(8, '0')}0001`),
    cep: b.cep,
    logradouro: sorteio.escolher(logradourosDeExemplo),
    numero: String(sorteio.inteiro(10, 2400)),
    complemento: sorteio.chance(0.2) ? `Sala ${sorteio.inteiro(1, 40)}` : null,
    bairro: 'Centro',
    cidade: b.cidade,
    estado: 'MS',
    natureza: b.natureza,
    situacao: i >= beneficiariosDeExemplo.length - inativos ? 'inativo' : 'ativo',
    criadoPor: sorteio.escolher(quemCadastra).id,
    criadoEm: relogio.diasAtras(sorteio.inteiro(20, 220)),
  }));
  const criados = await ctx.bd.insert(beneficiario).values(linhas).returning({
    id: beneficiario.id,
    criadoEm: beneficiario.criadoEm,
    criadoPor: beneficiario.criadoPor,
    cnpj: beneficiario.cnpj,
  });
  for (const b of criados) {
    registrarNaTrilha(ctx, {
      ocorridaEm: b.criadoEm,
      autorId: b.criadoPor,
      origem: 'usuario',
      operacao: 'beneficiario.criar',
      entidade: 'beneficiario',
      registroId: String(b.id),
      valorNovo: { cnpj: b.cnpj },
    });
  }
  contar(ctx, 'Beneficiários', criados.length);
}

async function popularProjetos(ctx: Contexto): Promise<void> {
  const { sorteio, relogio } = ctx;
  const responsaveis = comArea(ctx, 'LG').filter((c) => c.perfil !== 'assessor_externo');
  const supervisores = responsaveis.filter((c) =>
    ['supervisor', 'chefe', 'administrador', 'parlamentar'].includes(c.perfil),
  );
  if (responsaveis.length === 0 || supervisores.length === 0) return;

  const todasAsCategorias = await ctx.bd.select().from(categoria);
  const idDaCategoria = (natureza: string, nome: string) =>
    todasAsCategorias.find((c) => c.natureza === natureza && c.nome === nome)?.id;

  const contadorDeNumero: Record<string, number> = {};
  const movimentos: (typeof movimentacao.$inferInsert)[] = [];
  const criados: Array<{ id: number; encerrado: boolean }> = [];
  let comissoes = 0;
  let votacoes = 0;

  for (const [i, modelo] of projetosDeExemplo.entries()) {
    const tipoId = idDaCategoria('tipo_proposicao', modelo.tipo);
    if (!tipoId) continue;
    // Quanto do caminho principal o projeto já percorreu; alguns chegam a um final.
    const ate = sorteio.ponderado<number>([
      [0, 4],
      [1, 4],
      [2, 5],
      [3, 5],
      [4, 3],
      [5, 3],
      [6, 2],
      [7, 3],
      [8, 7], // chega a um final
    ]);
    const idade =
      ate === 8 ? sorteio.inteiro(150, 230) : Math.floor(sorteio.proximo() ** 1.2 * 150) + 5;
    const criadoEm = relogio.diasAtras(idade);
    const responsavel = sorteio.escolher(responsaveis);
    const criador = sorteio.chance(0.5) ? responsavel : sorteio.escolher(responsaveis);

    const etapasDoCaminho: string[] = caminhoPrincipal.slice(0, Math.min(ate + 1, 8));
    if (ate === 8) {
      etapasDoCaminho.push(
        sorteio.ponderado<string>([
          ['Sancionado', 5],
          ['Vetado', 1],
          ['Rejeitado', 2],
          ['Arquivado', 3],
        ]),
      );
    }

    const passos: Array<{ etapa: string; quando: Date; autorId: number }> = [];
    let quando = criadoEm;
    for (const etapa of etapasDoCaminho) {
      if (passos.length > 0) {
        quando = relogio.somarDias(quando, sorteio.inteiro(2, 18));
        if (quando >= relogio.agora) break;
      }
      passos.push({
        etapa,
        quando,
        autorId:
          passos.length === 0
            ? criador.id
            : sorteio.chance(0.7)
              ? responsavel.id
              : sorteio.escolher(supervisores).id,
      });
    }
    const etapaFinal = passos[passos.length - 1]!.etapa;
    const posicao = (nome: string) => passos.findIndex((p) => p.etapa === nome);
    const encerrado = (finais as readonly string[]).includes(etapaFinal);

    // O número vem com o protocolo (a partir de "Protocolado").
    const prefixo = prefixoDoTipo[modelo.tipo] ?? 'PL';
    let numero: string | null = null;
    if (passos.length > 1) {
      contadorDeNumero[prefixo] = (contadorDeNumero[prefixo] ?? 100) + sorteio.inteiro(7, 380);
      numero = `${prefixo} ${contadorDeNumero[prefixo]}/2026`;
    }

    const prazo = encerrado
      ? relogio.dia(relogio.somarDias(criadoEm, sorteio.inteiro(20, 120)))
      : sorteio.chance(0.3)
        ? relogio.dia(new Date(relogio.agora.getTime() - sorteio.inteiro(2, 40) * 86_400_000))
        : sorteio.chance(0.8)
          ? relogio.dia(new Date(relogio.agora.getTime() + sorteio.inteiro(3, 90) * 86_400_000))
          : null;

    const [linha] = await ctx.bd
      .insert(projetoLei)
      .values({
        criadorId: criador.id,
        responsavelId: responsavel.id,
        titulo: modelo.titulo,
        ementa: modelo.ementa,
        autoria: i % 7 === 3 ? 'Dep. Adriana Accorsi e outros' : 'Dep. Adriana Accorsi',
        numero,
        tipoProposicaoId: tipoId,
        etapaAtualId: ctx.etapas.projeto_lei[etapaFinal]!.id,
        prazo,
        criadoEm,
        atualizadoEm: passos[passos.length - 1]!.quando,
      })
      .returning({ id: projetoLei.id });
    const id = linha!.id;
    criados.push({ id, encerrado });

    passos.forEach((p, k) => {
      movimentos.push({
        registroTipo: 'projeto_lei',
        registroId: id,
        tipoProcessoId: ctx.tipos.projeto_lei,
        etapaOrigemId: k === 0 ? null : ctx.etapas.projeto_lei[passos[k - 1]!.etapa]!.id,
        etapaDestinoId: ctx.etapas.projeto_lei[p.etapa]!.id,
        autorId: p.autorId,
        observacao:
          k > 0 && sorteio.chance(0.3) ? 'Andamento conforme o acompanhamento da Câmara.' : null,
        criadaEm: p.quando,
      });
      registrarNaTrilha(ctx, {
        ocorridaEm: p.quando,
        autorId: p.autorId,
        origem: 'usuario',
        operacao: k === 0 ? 'projeto.criar' : 'projeto.mover',
        entidade: 'projeto_lei',
        registroId: String(id),
        valorNovo: { etapa: p.etapa },
      });
    });

    // Assuntos e coautores.
    const assuntos = modelo.assuntos
      .map((nome) => idDaCategoria('assunto_projeto', nome))
      .filter((v): v is number => v !== undefined);
    if (assuntos.length > 0) {
      await ctx.bd
        .insert(projetoAssunto)
        .values(assuntos.map((c) => ({ projetoId: id, categoriaId: c })));
    }
    if (sorteio.chance(0.55)) {
      const quantidade = sorteio.inteiro(1, 3);
      const nomesDosCoautores = new Set<string>();
      while (nomesDosCoautores.size < quantidade) {
        nomesDosCoautores.add(`Dep. ${sorteio.escolher(nomes)} ${sorteio.escolher(sobrenomes)}`);
      }
      await ctx.bd
        .insert(projetoCoautor)
        .values([...nomesDosCoautores].map((nome) => ({ projetoId: id, nome })));
    }

    // Passagem por comissões: a CCJC e, depois, as de mérito.
    const noDia = (nome: string, atraso: number) => {
      const p = passos[posicao(nome)];
      return p ? relogio.dia(relogio.limitar(relogio.somarDias(p.quando, atraso))) : null;
    };
    const tramitacoes: (typeof tramitacaoComissao.$inferInsert)[] = [];
    const dataDaCcj = noDia('Na comissão de constituição e justiça', 1);
    if (dataDaCcj) {
      tramitacoes.push({
        projetoId: id,
        comissao: comissoesDeExemplo[0]!,
        data: dataDaCcj,
        parecer: sorteio.chance(0.7) ? sorteio.escolher(pareceresDeExemplo) : null,
        registradoPor: responsavel.id,
        registradoEm: relogio.limitar(
          passos[posicao('Na comissão de constituição e justiça')]!.quando,
        ),
      });
    }
    const dataDoMerito = noDia('Nas comissões de mérito', 1);
    if (dataDoMerito) {
      for (const comissao of sorteio.amostra(comissoesDeExemplo.slice(1), sorteio.inteiro(1, 2))) {
        tramitacoes.push({
          projetoId: id,
          comissao,
          data: dataDoMerito,
          parecer: sorteio.chance(0.75) ? sorteio.escolher(pareceresDeExemplo) : null,
          registradoPor: responsavel.id,
          registradoEm: relogio.limitar(passos[posicao('Nas comissões de mérito')]!.quando),
        });
      }
    }
    if (tramitacoes.length > 0) {
      await ctx.bd.insert(tramitacaoComissao).values(tramitacoes);
      comissoes += tramitacoes.length;
    }

    // Votações: no plenário (ao chegar em votação) e na casa revisora.
    const votos: (typeof votacaoProjeto.$inferInsert)[] = [];
    const dataDaVotacao = noDia('Em votação', 1);
    if (dataDaVotacao) {
      const rejeitado = etapaFinal === 'Rejeitado';
      votos.push({
        projetoId: id,
        data: dataDaVotacao,
        resultado: rejeitado
          ? 'rejeitado'
          : sorteio.ponderado<ResultadoDeVotacao>([
              ['aprovado', 6],
              ['aprovado_com_emendas', 3],
              ['adiado', 2],
            ]),
        local: 'Plenário',
        registradoPor: responsavel.id,
        registradoEm: relogio.limitar(passos[posicao('Em votação')]!.quando),
      });
    }
    const dataDaRevisora = noDia('Na casa revisora', 2);
    if (dataDaRevisora && sorteio.chance(0.6)) {
      votos.push({
        projetoId: id,
        data: dataDaRevisora,
        resultado: 'aprovado',
        local: 'Senado Federal',
        registradoPor: responsavel.id,
        registradoEm: relogio.limitar(passos[posicao('Na casa revisora')]!.quando),
      });
    }
    if (votos.length > 0) {
      await ctx.bd.insert(votacaoProjeto).values(votos);
      votacoes += votos.length;
    }
  }
  await ctx.bd.insert(movimentacao).values(movimentos);

  // Alguns projetos em andamento são cancelados, com justificativa; depois disso não se alteram.
  const emAndamento = criados.filter((c) => !c.encerrado);
  for (const [k, p] of sorteio.amostra(emAndamento, projetosCancelados).entries()) {
    const quem = sorteio.escolher(supervisores);
    const quando = relogio.diasAtras(sorteio.inteiro(0, 5));
    await ctx.bd
      .update(projetoLei)
      .set({
        canceladoEm: quando,
        canceladoPor: quem.id,
        justificativaCancelamento:
          k === 0
            ? 'Cadastrado em duplicidade com outro projeto da legislatura.'
            : 'Retirado pela autoria após acordo com a liderança.',
        atualizadoEm: quando,
      })
      .where(eq(projetoLei.id, p.id));
    registrarNaTrilha(ctx, {
      ocorridaEm: quando,
      autorId: quem.id,
      origem: 'usuario',
      operacao: 'projeto.cancelar',
      entidade: 'projeto_lei',
      registroId: String(p.id),
      justificativa: 'Cancelado pela supervisão.',
    });
  }

  contar(ctx, 'Projetos de lei', criados.length);
  contar(ctx, 'Movimentações de projetos (histórico)', movimentos.length);
  contar(ctx, 'Passagens por comissões', comissoes);
  contar(ctx, 'Votações de projetos', votacoes);
}
