import {
  cifrarSegredoDeLink,
  demanda,
  emitirProtocolo,
  gerarSegredoDeLink,
  hashDoSegredoDeLink,
  movimentacao,
} from '@gabinete/banco';
import type { Prioridade } from '@gabinete/compartilhado';
import { eq } from 'drizzle-orm';
import { bairros, justificativasDeCancelamento, observacoesDeMovimento, ruas } from './conteudo.js';
import { temas, type Tema } from './temas.js';
import {
  comArea,
  contar,
  preencher,
  registrarNaTrilha,
  type Colega,
  type Contexto,
} from './contexto.js';
import type { PessoaCriada } from './pessoas.js';

export interface PassoDeEtapa {
  readonly etapa: string;
  readonly quando: Date;
  readonly autorId: number;
}

export interface DemandaCriada {
  readonly id: number;
  readonly protocolo: string;
  readonly titulo: string;
  readonly tema: Tema;
  readonly pessoa: PessoaCriada;
  readonly responsavel: Colega;
  readonly autor: Colega;
  readonly criadoEm: Date;
  readonly passos: readonly PassoDeEtapa[];
  readonly etapaFinal: string;
  readonly cancelada: boolean;
  readonly link: 'ativa' | 'suspensa' | 'revogada';
  readonly encerrada: boolean;
}

const total = 124;
const canceladas = 6;

type Resultado =
  'recebida' | 'triagem' | 'andamento' | 'aguardando' | 'concluida' | 'semSolucao' | 'arquivada';

const caminhos: Record<Resultado, readonly string[]> = {
  recebida: ['Recebida'],
  triagem: ['Recebida', 'Em triagem'],
  andamento: ['Recebida', 'Em triagem', 'Em andamento'],
  aguardando: ['Recebida', 'Em triagem', 'Em andamento', 'Aguardando terceiros'],
  concluida: ['Recebida', 'Em triagem', 'Em andamento', 'Concluída'],
  semSolucao: ['Recebida', 'Em triagem', 'Em andamento', 'Sem solução'],
  arquivada: ['Recebida', 'Em triagem', 'Em andamento', 'Concluída', 'Arquivada'],
};

/** Quantos dias cada passagem de etapa costuma levar (mínimo, máximo). */
const duracao: Record<string, readonly [number, number]> = {
  'Em triagem': [0, 3],
  'Em andamento': [1, 7],
  'Aguardando terceiros': [3, 16],
  Concluída: [4, 32],
  'Sem solução': [6, 30],
  Arquivada: [3, 25],
};

/**
 * Demandas em todos os estágios: recém-recebidas, em triagem, em andamento (algumas atrasadas e
 * paradas), aguardando terceiros, concluídas, sem solução, arquivadas e algumas canceladas. Cada uma
 * tem a história completa de movimentações, com quem moveu e quando. As mais antigas tendem a estar
 * concluídas; as recentes, em aberto.
 */
export async function popularDemandas(
  ctx: Contexto,
  pessoas: readonly PessoaCriada[],
): Promise<DemandaCriada[]> {
  const { sorteio, relogio } = ctx;
  const responsaveis = comArea(ctx, 'AT');
  const internos = responsaveis.filter((c) => c.perfil !== 'assessor_externo');
  const supervisores = responsaveis.filter((c) =>
    ['supervisor', 'chefe', 'administrador'].includes(c.perfil),
  );
  const ativas = pessoas.filter((p) => p.situacao === 'ativa');
  const eliminadas = pessoas.filter((p) => p.situacao === 'dados_eliminados');
  // Alguns cidadãos voltam várias vezes: o sorteio favorece o começo da lista.
  const sorteiaPessoa = () => ativas[Math.floor(sorteio.proximo() ** 1.7 * ativas.length)]!;

  const criadas: DemandaCriada[] = [];
  const linhasDeMovimentacao: (typeof movimentacao.$inferInsert)[] = [];

  await ctx.bd.transaction(async (tx) => {
    for (let i = 0; i < total; i += 1) {
      const idade = Math.floor(sorteio.proximo() ** 1.35 * 135) + 1;
      const velho = idade > 70;
      const resultado = sorteio.ponderado<Resultado>(
        velho
          ? [
              ['concluida', 52],
              ['arquivada', 16],
              ['semSolucao', 6],
              ['andamento', 14],
              ['aguardando', 12],
            ]
          : idade > 25
            ? [
                ['concluida', 30],
                ['andamento', 32],
                ['aguardando', 18],
                ['triagem', 8],
                ['semSolucao', 5],
                ['arquivada', 7],
              ]
            : [
                ['recebida', 22],
                ['triagem', 22],
                ['andamento', 34],
                ['aguardando', 10],
                ['concluida', 12],
              ],
      );

      const tema = sorteio.escolher(temas);
      const eliminada = i < 4 && eliminadas.length > 0;
      const pessoa = eliminada ? eliminadas[i % eliminadas.length]! : sorteiaPessoa();
      const responsavel = sorteio.chance(0.2)
        ? sorteio.escolher(responsaveis.filter((r) => r.perfil === 'assessor_externo'))
        : sorteio.escolher(internos);
      const autor =
        responsavel.perfil === 'assessor_externo' ? responsavel : sorteio.escolher(internos);
      const criadoEm = relogio.diasAtras(eliminada ? sorteio.inteiro(90, 135) : idade);

      const valores = {
        rua: sorteio.escolher(ruas),
        bairro: sorteio.escolher(bairros),
        num: String(sorteio.inteiro(20, 900)),
      };
      const titulo = preencher(sorteio.escolher(tema.titulos), valores);
      const descricao = sorteio.chance(0.9)
        ? preencher(sorteio.escolher(tema.descricoes), valores)
        : null;

      // Linha do tempo: cada etapa em seu dia; só vale o que já aconteceu até agora.
      const passos: PassoDeEtapa[] = [];
      let quando = criadoEm;
      for (const nome of caminhos[eliminada ? 'concluida' : resultado]) {
        if (nome !== 'Recebida') {
          const [min, max] = duracao[nome] ?? [1, 5];
          quando = relogio.somarDias(quando, sorteio.inteiro(min, max));
          if (quando >= relogio.agora) break;
        }
        passos.push({
          etapa: nome,
          quando,
          autorId:
            nome === 'Recebida' ? autor.id : sorteio.escolher([responsavel, ...supervisores]).id,
        });
      }
      // Na vida real a maioria dos casos abertos teve movimento recente, e boa parte dos encerrados fechou
      // há pouco: aproxima a última etapa de hoje (sempre depois da anterior), para o painel ficar realista.
      if (passos.length > 1) {
        const ultimo = passos[passos.length - 1]!;
        const anterior = passos[passos.length - 2]!;
        const emAberto = !['Concluída', 'Sem solução', 'Arquivada'].includes(ultimo.etapa);
        const alvo = emAberto
          ? sorteio.chance(0.68)
            ? sorteio.inteiro(1, 13)
            : null
          : ultimo.etapa !== 'Arquivada' && sorteio.chance(0.42)
            ? sorteio.inteiro(1, 28)
            : null;
        if (alvo !== null) {
          const nova = new Date(relogio.agora.getTime() - alvo * 86_400_000);
          if (nova > anterior.quando) passos[passos.length - 1] = { ...ultimo, quando: nova };
        }
      }
      const etapaFinal = passos[passos.length - 1]!.etapa;
      const encerrada = ['Concluída', 'Sem solução', 'Arquivada'].includes(etapaFinal);

      const prioridade = sorteio.ponderado<Prioridade>([
        ['baixa', 18],
        ['media', 46],
        ['alta', 26],
        ['urgente', 10],
      ]);
      // Prazo: em aberto, a maioria ainda dentro (e algumas atrasadas); encerradas, em torno da conclusão.
      const prazoBase = ['Concluída', 'Sem solução', 'Arquivada'].includes(etapaFinal)
        ? relogio.somarDias(criadoEm, sorteio.inteiro(8, 45))
        : sorteio.chance(0.24)
          ? new Date(relogio.agora.getTime() - sorteio.inteiro(1, 25) * 86_400_000)
          : new Date(relogio.agora.getTime() + sorteio.inteiro(2, 40) * 86_400_000);
      const prazo = sorteio.chance(0.8) ? relogio.dia(prazoBase) : null;
      const link = sorteio.ponderado<DemandaCriada['link']>([
        ['ativa', 88],
        ['suspensa', 5],
        ['revogada', 7],
      ]);
      const segredo = gerarSegredoDeLink();
      const protocolo = await emitirProtocolo(tx);

      const [linha] = await tx
        .insert(demanda)
        .values({
          protocolo,
          segredoLinkHash: hashDoSegredoDeLink(segredo),
          segredoLinkCifrado: cifrarSegredoDeLink(segredo, ctx.segredoDaAplicacao),
          publicacaoLink: link,
          solicitanteId: pessoa.id,
          responsavelId: responsavel.id,
          autorId: autor.id,
          titulo,
          descricao,
          prioridade,
          etapaAtualId: ctx.etapas.demanda[etapaFinal]!.id,
          prazo,
          criadoEm,
          atualizadoEm: passos[passos.length - 1]!.quando,
        })
        .returning({ id: demanda.id });

      passos.forEach((p, k) => {
        linhasDeMovimentacao.push({
          registroTipo: 'demanda',
          registroId: linha!.id,
          tipoProcessoId: ctx.tipos.demanda,
          etapaOrigemId: k === 0 ? null : ctx.etapas.demanda[passos[k - 1]!.etapa]!.id,
          etapaDestinoId: ctx.etapas.demanda[p.etapa]!.id,
          autorId: p.autorId,
          observacao:
            k === 0 || sorteio.chance(0.45) ? null : sorteio.escolher(observacoesDeMovimento),
          criadaEm: p.quando,
        });
        registrarNaTrilha(ctx, {
          ocorridaEm: p.quando,
          autorId: p.autorId,
          origem: 'usuario',
          operacao: k === 0 ? 'demanda.registrar' : 'demanda.mover',
          entidade: 'demanda',
          registroId: String(linha!.id),
          valorNovo: { etapa: p.etapa, prioridade },
        });
      });

      criadas.push({
        id: linha!.id,
        protocolo,
        titulo,
        tema,
        pessoa,
        responsavel,
        autor,
        criadoEm,
        passos,
        etapaFinal,
        cancelada: false,
        link,
        encerrada,
      });
    }

    // Cancelamentos: a etapa não muda, e a demanda deixa de se alterar (regra do banco).
    const candidatas = sorteio.amostra(
      criadas.filter((d) => !d.encerrada),
      canceladas,
    );
    for (const [k, d] of candidatas.entries()) {
      const quando = relogio.limitar(
        relogio.depois(d.passos[d.passos.length - 1]!.quando, sorteio.inteiro(1, 6)),
      );
      const quem = sorteio.escolher(supervisores);
      const justificativa = justificativasDeCancelamento[k % justificativasDeCancelamento.length]!;
      await tx
        .update(demanda)
        .set({
          canceladaEm: quando,
          canceladaPor: quem.id,
          justificativaCancelamento: justificativa,
          atualizadoEm: quando,
        })
        .where(eq(demanda.id, d.id));
      registrarNaTrilha(ctx, {
        ocorridaEm: quando,
        autorId: quem.id,
        origem: 'usuario',
        operacao: 'demanda.cancelar',
        entidade: 'demanda',
        registroId: String(d.id),
        justificativa,
      });
      (d as { cancelada: boolean }).cancelada = true;
    }
    if (linhasDeMovimentacao.length > 0) await tx.insert(movimentacao).values(linhasDeMovimentacao);
  });

  contar(ctx, 'Demandas', criadas.length);
  contar(ctx, 'Movimentações de demandas (histórico)', linhasDeMovimentacao.length);
  contar(ctx, 'Demandas canceladas', canceladas);
  return criadas;
}
