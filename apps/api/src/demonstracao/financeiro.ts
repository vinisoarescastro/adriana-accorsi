import {
  beneficiario,
  categoria,
  ceapCategoria,
  ceapEncerramento,
  ceapParametro,
  despesa,
  destinacao,
  emenda,
  emendaValor,
  etapa,
  execucaoDestinacao,
  movimentacao,
  tipoProcesso,
} from '@gabinete/banco';
import { eq } from 'drizzle-orm';
import { cnpjComDigitos } from './legislativo.js';
import { comArea, contar, registrarNaTrilha, type Colega, type Contexto } from './contexto.js';

/**
 * VALORES FICTÍCIOS, só para a demonstração: a cota mensal, o limite de alerta e os valores das
 * emendas abaixo não são os da norma vigente. No ambiente real, o Administrador ou a Parlamentar
 * cadastra a cota em CEAP > Parâmetros, conferida na norma.
 */
const cotaFicticia = '45000.00';
const limiteDeAlertaFicticio = '8000.00';
const prazoDeApresentacaoFicticio = '90.00';

const fornecedores = [
  ['Aeroviário Passagens e Turismo Ltda', '1000'],
  ['Posto Planalto Combustíveis Ltda', '2000'],
  ['Locadora Cerrado Veículos Ltda', '3000'],
  ['Hotel Centro Executivo Goiânia Ltda', '4000'],
  ['Gráfica e Editora Brasil Central Ltda', '5000'],
  ['Telefonia Centro-Oeste S.A.', '6000'],
  ['Escritório de Contabilidade Vitória Ltda', '7000'],
  ['Divulgação e Comunicação Goiás Ltda', '8000'],
  ['Restaurante Sabor do Cerrado Ltda', '9000'],
] as const;

const descricoesPorFornecedor: Record<string, string[]> = {
  '1000': ['Passagem aérea Goiânia–Brasília', 'Passagem aérea Brasília–Goiânia'],
  '2000': ['Abastecimento de veículo em deslocamento a municípios'],
  '3000': ['Locação de veículo para agenda no interior'],
  '4000': ['Hospedagem em Brasília durante a sessão deliberativa'],
  '5000': ['Impressão de material de divulgação da atividade parlamentar'],
  '6000': ['Telefonia móvel e internet do escritório de apoio'],
  '7000': ['Serviços de consultoria contábil e jurídica'],
  '8000': ['Divulgação da atividade parlamentar'],
  '9000': ['Alimentação em reunião de trabalho'],
};

type EtapaPorNome = Record<string, { id: number; papel: string; tipoId: number }>;

async function etapasDo(ctx: Contexto, tipo: 'emenda' | 'despesa_ceap'): Promise<EtapaPorNome> {
  const linhas = await ctx.bd
    .select({ id: etapa.id, nome: etapa.nomeInterno, papel: etapa.papel, tipoId: tipoProcesso.id })
    .from(etapa)
    .innerJoin(tipoProcesso, eq(tipoProcesso.id, etapa.tipoProcessoId))
    .where(eq(tipoProcesso.tipo, tipo));
  return Object.fromEntries(
    linhas.map((l) => [l.nome, { id: l.id, papel: l.papel, tipoId: l.tipoId }]),
  );
}

const dinheiro = (centavos: number): string => (centavos / 100).toFixed(2);

/** Financeiro: emendas parlamentares (com destinações e execuções) e a CEAP (cota, despesas, encerramentos). */
export async function popularFinanceiro(ctx: Contexto): Promise<void> {
  await popularEmendas(ctx);
  await popularCeap(ctx);
}

// ---------------------------------------------------------------------------
// Emendas
// ---------------------------------------------------------------------------

const modelosDeEmenda = [
  ['Ambulâncias para o SAMU regional', 'Individual', 4_200_000, 'Executada'],
  ['Reforma da UPA do Setor Norte', 'Individual', 8_500_000, 'Paga'],
  ['Pavimentação e drenagem de vias urbanas', 'Individual', 12_000_000, 'Liquidada'],
  ['Equipamentos para hospital de referência', 'Bancada', 25_000_000, 'Empenhada'],
  [
    'Quadra poliesportiva coberta em escola municipal',
    'Individual',
    3_000_000,
    'Em análise pelo órgão',
  ],
  ['Aquisição de maquinário agrícola para associação', 'Individual', 1_800_000, 'Indicada'],
  ['Construção de creche em bairro periférico', 'Bancada', 15_000_000, 'Indicada'],
  ['Centro de referência da mulher', 'Individual', 2_400_000, 'Disponível'],
  ['Iluminação pública em LED', 'Individual', 6_000_000, 'Não executada'],
] as const;

async function popularEmendas(ctx: Contexto): Promise<void> {
  const { sorteio, relogio } = ctx;
  const equipe = comArea(ctx, 'LG').filter((c) => c.perfil !== 'assessor_externo');
  const supervisores = equipe.filter((c) =>
    ['supervisor', 'chefe', 'administrador', 'parlamentar'].includes(c.perfil),
  );
  if (equipe.length === 0 || supervisores.length === 0) return;
  const etapas = await etapasDo(ctx, 'emenda');
  const tipos = await ctx.bd.select().from(categoria).where(eq(categoria.natureza, 'tipo_emenda'));
  const beneficiarios = (await ctx.bd.select().from(beneficiario)).filter(
    (b) => b.situacao === 'ativo',
  );
  if (beneficiarios.length === 0) return;
  const exercicio = Number(relogio.dia(relogio.agora).slice(0, 4));
  const indicada = etapas['Indicada']!;

  const movimentos: (typeof movimentacao.$inferInsert)[] = [];
  let destinacoes = 0;
  let execucoes = 0;
  for (const [
    i,
    [finalidade, tipoNome, valorEmCentavos, etapaFinal],
  ] of modelosDeEmenda.entries()) {
    const tipoId = (tipos.find((t) => t.nome === tipoNome) ?? tipos[0])?.id;
    if (!tipoId) continue;
    const criadoEm = relogio.diasAtras(sorteio.inteiro(60, 200));
    const responsavel = sorteio.escolher(supervisores);
    const caminho = [
      'Disponível',
      'Indicada',
      'Em análise pelo órgão',
      'Empenhada',
      'Liquidada',
      'Paga',
      'Executada',
    ];
    const ate = caminho.indexOf(etapaFinal);
    const passos: Array<{ nome: string; quando: Date }> = [];
    let quando = criadoEm;
    const sequencia =
      etapaFinal === 'Não executada'
        ? [...caminho.slice(0, 4), etapaFinal]
        : caminho.slice(0, ate + 1);
    for (const nome of sequencia) {
      if (passos.length > 0) quando = relogio.somarDias(quando, sorteio.inteiro(8, 30));
      if (quando >= relogio.agora) break;
      passos.push({ nome, quando });
    }
    const ultima = passos[passos.length - 1]!;
    const concluida = etapas[ultima.nome]!.papel === 'conclusao';

    const [linha] = await ctx.bd
      .insert(emenda)
      .values({
        criadorId: responsavel.id,
        responsavelId: responsavel.id,
        identificacao: `EMD ${exercicio}/${String(i + 1).padStart(4, '0')}`,
        exercicio,
        tipoId,
        finalidade,
        prazoExecucao: concluida
          ? null
          : relogio.dia(
              new Date(
                relogio.agora.getTime() +
                  (i % 3 === 0 ? -1 : 1) * sorteio.inteiro(10, 90) * 86_400_000,
              ),
            ),
        etapaAtualId: etapas[ultima.nome]!.id,
        criadoEm,
        atualizadoEm: ultima.quando,
      })
      .returning({ id: emenda.id });
    const id = linha!.id;
    await ctx.bd.insert(emendaValor).values({
      emendaId: id,
      valor: dinheiro(valorEmCentavos),
      definidoPor: responsavel.id,
      definidoEm: criadoEm,
    });
    passos.forEach((p, k) => {
      movimentos.push({
        registroTipo: 'emenda',
        registroId: id,
        tipoProcessoId: indicada.tipoId,
        etapaOrigemId: k === 0 ? null : etapas[passos[k - 1]!.nome]!.id,
        etapaDestinoId: etapas[p.nome]!.id,
        autorId: responsavel.id,
        criadaEm: p.quando,
      });
      registrarNaTrilha(ctx, {
        ocorridaEm: p.quando,
        autorId: responsavel.id,
        origem: 'usuario',
        operacao: k === 0 ? 'emenda.criar' : 'emenda.mover',
        entidade: 'emenda',
        registroId: String(id),
        valorNovo: { etapa: p.nome },
      });
    });

    // Destinações: da etapa "Indicada" em diante, comprometendo 60% a 100% do valor.
    if (passos.length < 2) continue;
    const quantas = sorteio.inteiro(1, 3);
    let restante = Math.floor(valorEmCentavos * (sorteio.inteiro(60, 100) / 100));
    const escolhidos = sorteio.amostra(beneficiarios, quantas);
    for (const [k, b] of escolhidos.entries()) {
      const parte =
        k === escolhidos.length - 1 ? restante : Math.floor(restante / (escolhidos.length - k));
      restante -= parte;
      if (parte <= 0) continue;
      const criadaEm = relogio.limitar(relogio.somarDias(passos[1]!.quando, k + 1));
      const [d] = await ctx.bd
        .insert(destinacao)
        .values({
          emendaId: id,
          beneficiarioId: b.id,
          valor: dinheiro(parte),
          finalidade: `${finalidade} — ${b.nomeFantasia}`,
          etapaAtualId: indicada.id,
          criadaPor: responsavel.id,
          criadaEm,
        })
        .returning({ id: destinacao.id });
      movimentos.push({
        registroTipo: 'destinacao',
        registroId: d!.id,
        tipoProcessoId: indicada.tipoId,
        etapaOrigemId: null,
        etapaDestinoId: indicada.id,
        autorId: responsavel.id,
        criadaEm,
      });
      destinacoes += 1;

      // Execução: só depois de empenhada; parcial (30–70%) ou total se a emenda foi executada.
      const empenho = passos.find((p) => p.nome === 'Empenhada');
      if (empenho) {
        const total = ultima.nome === 'Executada';
        const executado = total ? parte : Math.floor((parte * sorteio.inteiro(30, 70)) / 100);
        if (executado > 0) {
          const em = relogio.limitar(relogio.somarDias(empenho.quando, sorteio.inteiro(3, 20)));
          await ctx.bd.insert(execucaoDestinacao).values({
            destinacaoId: d!.id,
            valor: dinheiro(executado),
            data: relogio.dia(em),
            observacao: total ? 'Execução concluída.' : 'Medição parcial.',
            registradoPor: responsavel.id,
            registradoEm: em,
          });
          execucoes += 1;
        }
      }
    }
  }
  await ctx.bd.insert(movimentacao).values(movimentos);
  contar(ctx, 'Emendas parlamentares', modelosDeEmenda.length);
  contar(ctx, '  destinações a beneficiários', destinacoes);
  contar(ctx, '  execuções registradas', execucoes);
}

// ---------------------------------------------------------------------------
// CEAP
// ---------------------------------------------------------------------------

async function popularCeap(ctx: Contexto): Promise<void> {
  const { sorteio, relogio } = ctx;
  const equipe = comArea(ctx, 'FI');
  const decisores = equipe.filter((c) =>
    ['supervisor', 'chefe', 'administrador', 'parlamentar'].includes(c.perfil),
  );
  const definidor = equipe.find((c) => ['administrador', 'parlamentar'].includes(c.perfil));
  const chefe = equipe.find((c) => c.perfil === 'chefe');
  if (equipe.length === 0 || decisores.length < 2 || !definidor) return;
  const etapas = await etapasDo(ctx, 'despesa_ceap');
  const categorias = await ctx.bd.select().from(ceapCategoria);
  const ativas = categorias.filter((c) => c.situacao === 'ativa');
  if (ativas.length === 0) return;

  const hoje = relogio.dia(relogio.agora);
  const ano = Number(hoje.slice(0, 4));
  const mesAtual = Number(hoje.slice(5, 7));
  const inicio = `${ano}-01-01`;
  await ctx.bd.insert(ceapParametro).values([
    { chave: 'cota_mensal', valor: cotaFicticia, vigenteDe: inicio, definidoPor: definidor.id },
    {
      chave: 'limite_alerta_saldo',
      valor: limiteDeAlertaFicticio,
      vigenteDe: inicio,
      definidoPor: definidor.id,
    },
    {
      chave: 'prazo_apresentacao_dias',
      valor: prazoDeApresentacaoFicticio,
      vigenteDe: inicio,
      definidoPor: definidor.id,
    },
  ]);
  contar(ctx, 'Parâmetros da CEAP (valores fictícios)', 3);

  const movimentos: (typeof movimentacao.$inferInsert)[] = [];
  const mover = (id: number, de: string | null, para: string, autor: Colega, quando: Date) => {
    movimentos.push({
      registroTipo: 'despesa',
      registroId: id,
      tipoProcessoId: etapas['Lançada']!.tipoId,
      etapaOrigemId: de ? etapas[de]!.id : null,
      etapaDestinoId: etapas[para]!.id,
      autorId: autor.id,
      criadaEm: quando,
    });
  };

  let total = 0;
  let proprias = 0;
  for (let mes = 1; mes <= mesAtual; mes += 1) {
    const quantas = sorteio.inteiro(5, 8);
    const recente = mes >= mesAtual - 1;
    for (let k = 0; k < quantas; k += 1) {
      const [nome, base] = sorteio.escolher(fornecedores);
      const ultimoDia = mes === mesAtual ? Number(hoje.slice(8, 10)) : 28;
      const dia = sorteio.inteiro(1, Math.max(1, ultimoDia - 1));
      const dataDocumento = `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
      const lancadaEm = relogio.limitar(
        relogio.somarDias(new Date(`${dataDocumento}T12:00:00-03:00`), sorteio.inteiro(0, 3)),
      );
      const lancador = sorteio.escolher(equipe);
      const outros = decisores.filter((d) => d.id !== lancador.id);
      const decisor = sorteio.escolher(outros);

      const destino = recente
        ? sorteio.ponderado<string>([
            ['Lançada', 2],
            ['Em análise', 4],
            ['Aprovada', 3],
            ['Reprovada', 1],
            ['Arquivada', 1],
          ])
        : sorteio.ponderado<string>([
            ['Apresentada à Câmara', 3],
            ['Ressarcida', 8],
            ['Glosada pela Câmara', 1],
            ['Reprovada', 1],
          ]);
      const percurso: string[] = ['Lançada'];
      if (destino !== 'Lançada') percurso.push('Em análise');
      if (
        ['Aprovada', 'Apresentada à Câmara', 'Ressarcida', 'Glosada pela Câmara'].includes(destino)
      ) {
        percurso.push('Aprovada');
        if (destino !== 'Aprovada') percurso.push('Apresentada à Câmara');
        if (['Ressarcida', 'Glosada pela Câmara'].includes(destino)) percurso.push(destino);
      } else if (destino === 'Reprovada') {
        percurso.push('Reprovada');
      } else if (destino === 'Arquivada') {
        percurso.push('Arquivada');
      }

      const decidida = percurso.includes('Aprovada') || destino === 'Reprovada';
      const decisaoEm = relogio.limitar(relogio.somarDias(lancadaEm, sorteio.inteiro(1, 6)));
      // Uma das despesas é decidida por quem a lançou (o Chefe), para a marca aparecer na tela.
      const propria = Boolean(decidida && chefe && total >= 3 && proprias === 0);
      if (propria) proprias += 1;
      const quemDecide = propria ? chefe! : decisor;

      const [linha] = await ctx.bd
        .insert(despesa)
        .values({
          categoriaId: sorteio.escolher(ativas).id,
          responsavelId: lancador.id,
          lancadoPor: propria ? chefe!.id : lancador.id,
          descricao: sorteio.escolher(descricoesPorFornecedor[base]!),
          valor: dinheiro(sorteio.inteiro(90_000, 1_100_000)),
          dataDocumento,
          fornecedorNome: nome,
          fornecedorDocumento: cnpjComDigitos(`${base}00000001`),
          numeroDocumento: `NF-${sorteio.inteiro(1000, 99999)}`,
          etapaAtualId: etapas[percurso[percurso.length - 1]!]!.id,
          decididoPor: decidida ? quemDecide.id : null,
          decididaEm: decidida ? decisaoEm : null,
          decisaoPeloProprioLancador: propria,
          motivoReprovacao:
            destino === 'Reprovada'
              ? 'Documento fiscal ilegível; solicitar nova via ao fornecedor.'
              : null,
          ...(destino === 'Arquivada'
            ? {
                canceladaEm: decisaoEm,
                canceladaPor: lancador.id,
                justificativaCancelamento: 'Lançamento em duplicidade.',
              }
            : {}),
          criadoEm: lancadaEm,
          atualizadoEm: decisaoEm,
        })
        .returning({ id: despesa.id });
      const id = linha!.id;
      percurso.forEach((p, n) => {
        const quando = relogio.limitar(relogio.somarDias(lancadaEm, n * 2));
        const autor =
          n === 0 ? lancador : p === 'Aprovada' || p === 'Reprovada' ? quemDecide : lancador;
        mover(id, n === 0 ? null : percurso[n - 1]!, p, autor, quando);
        registrarNaTrilha(ctx, {
          ocorridaEm: quando,
          autorId: autor.id,
          origem: 'usuario',
          operacao: n === 0 ? 'ceap.lancar' : 'ceap.mover',
          entidade: 'despesa',
          registroId: String(id),
          valorNovo: { etapa: p },
        });
      });
      total += 1;
    }
  }
  await ctx.bd.insert(movimentacao).values(movimentos);
  contar(ctx, 'Despesas da CEAP', total);

  // Competências já fechadas: até três meses atrás.
  const encerrar = Math.max(0, mesAtual - 3);
  if (encerrar > 0) {
    await ctx.bd.insert(ceapEncerramento).values(
      Array.from({ length: encerrar }, (_, i) => ({
        ano,
        mes: i + 1,
        encerradaPor: definidor.id,
        encerradaEm: relogio.limitar(
          new Date(`${ano}-${String(i + 2).padStart(2, '0')}-05T12:00:00-03:00`),
        ),
      })),
    );
    contar(ctx, 'Competências da CEAP encerradas', encerrar);
  }
}
