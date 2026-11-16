import { movimentacao, tarefa } from '@gabinete/banco';
import type { Prioridade } from '@gabinete/compartilhado';
import { eq } from 'drizzle-orm';
import {
  bairros,
  descricoesDeTarefa,
  justificativasDeCancelamento,
  titulosDeTarefaDeDemanda,
  titulosDeTarefaInterna,
} from './conteudo.js';
import { avisar, contar, preencher, registrarNaTrilha, type Contexto } from './contexto.js';
import type { DemandaCriada } from './demandas.js';

const total = 98;
const canceladas = 6;
const reatribuidas = 7;

const caminhos: ReadonlyArray<readonly [readonly string[], number]> = [
  [['A fazer'], 18],
  [['A fazer', 'Em andamento'], 28],
  [['A fazer', 'Em andamento', 'Concluída'], 44],
  [['A fazer', 'Em andamento', 'Concluída', 'Encerrada'], 10],
];

const duracao: Record<string, readonly [number, number]> = {
  'Em andamento': [0, 4],
  Concluída: [1, 14],
  Encerrada: [2, 20],
};

/**
 * Tarefas da equipe: parte vinculada a demandas (acompanhar o caso), parte interna (relatórios,
 * pautas, agenda). Variam em prioridade, etapa e prazo (há atrasadas e a vencer); algumas foram
 * passadas a outra pessoa ou canceladas. As descrições mencionam colegas com @.
 */
export async function popularTarefas(
  ctx: Contexto,
  demandas: readonly DemandaCriada[],
): Promise<void> {
  const { sorteio, relogio } = ctx;
  const ativos = ctx.colegas.filter((c) => c.ativo);
  const internos = ativos.filter((c) => c.perfil !== 'assessor_externo');
  const supervisores = internos.filter((c) =>
    ['supervisor', 'chefe', 'administrador'].includes(c.perfil),
  );
  const hoje = relogio.dia(relogio.agora);
  const abertas = demandas.filter((d) => !d.cancelada);

  const movimentos: (typeof movimentacao.$inferInsert)[] = [];
  const criadas: Array<{
    id: number;
    responsavelId: number;
    prazo: string | null;
    encerrada: boolean;
  }> = [];

  for (let i = 0; i < total; i += 1) {
    const idade = Math.floor(sorteio.proximo() ** 1.3 * 95) + 1;
    const criadoEm = relogio.diasAtras(idade);
    const responsavel = sorteio.escolher(ativos);
    const criador =
      responsavel.perfil === 'assessor_externo' && sorteio.chance(0.6)
        ? responsavel
        : sorteio.escolher(internos);
    const caminho = sorteio.ponderado(caminhos);

    const passos: Array<{ etapa: string; quando: Date; autorId: number }> = [];
    let quando = criadoEm;
    for (const etapa of caminho) {
      if (etapa !== 'A fazer') {
        const [min, max] = duracao[etapa] ?? [1, 5];
        quando = relogio.somarDias(quando, sorteio.inteiro(min, max));
        if (quando >= relogio.agora) break;
      }
      passos.push({ etapa, quando, autorId: etapa === 'A fazer' ? criador.id : responsavel.id });
    }
    const etapaFinal = passos[passos.length - 1]!.etapa;
    const encerrada = etapaFinal === 'Concluída' || etapaFinal === 'Encerrada';

    // Vínculo: demanda do mesmo responsável (se externo, só as dele) ou qualquer demanda aberta.
    const candidatas = abertas.filter(
      (d) => responsavel.perfil !== 'assessor_externo' || d.responsavel.id === responsavel.id,
    );
    const demandaVinculada =
      candidatas.length > 0 && sorteio.chance(0.5) ? sorteio.escolher(candidatas) : null;
    const valores = { bairro: sorteio.escolher(bairros) };
    const titulo = demandaVinculada
      ? `${sorteio.escolher(titulosDeTarefaDeDemanda)} (${demandaVinculada.protocolo})`
      : preencher(sorteio.escolher(titulosDeTarefaInterna), valores);

    const colega = sorteio.escolher(internos.filter((c) => c.id !== criador.id));
    const descricao = sorteio.chance(0.6)
      ? preencher(sorteio.escolher(descricoesDeTarefa), { A: colega.nome })
      : null;

    const prazoBase = encerrada
      ? relogio.somarDias(criadoEm, sorteio.inteiro(2, 28))
      : sorteio.chance(0.3)
        ? new Date(relogio.agora.getTime() - sorteio.inteiro(1, 14) * 86_400_000)
        : new Date(relogio.agora.getTime() + sorteio.inteiro(0, 25) * 86_400_000);
    const prazo = sorteio.chance(0.85) ? relogio.dia(prazoBase) : null;

    const [linha] = await ctx.bd
      .insert(tarefa)
      .values({
        criadorId: criador.id,
        responsavelId: responsavel.id,
        titulo,
        descricao,
        prioridade: sorteio.ponderado<Prioridade>([
          ['baixa', 20],
          ['media', 46],
          ['alta', 24],
          ['urgente', 10],
        ]),
        prazo,
        etapaAtualId: ctx.etapas.tarefa[etapaFinal]!.id,
        vinculoTipo: demandaVinculada ? 'demanda' : null,
        vinculoId: demandaVinculada?.id ?? null,
        criadoEm,
        atualizadoEm: passos[passos.length - 1]!.quando,
      })
      .returning({ id: tarefa.id });
    const id = linha!.id;
    criadas.push({ id, responsavelId: responsavel.id, prazo, encerrada });

    passos.forEach((p, k) => {
      movimentos.push({
        registroTipo: 'tarefa',
        registroId: id,
        tipoProcessoId: ctx.tipos.tarefa,
        etapaOrigemId: k === 0 ? null : ctx.etapas.tarefa[passos[k - 1]!.etapa]!.id,
        etapaDestinoId: ctx.etapas.tarefa[p.etapa]!.id,
        autorId: p.autorId,
        observacao: k > 0 && sorteio.chance(0.25) ? 'Feito conforme combinado com a chefia.' : null,
        criadaEm: p.quando,
      });
      registrarNaTrilha(ctx, {
        ocorridaEm: p.quando,
        autorId: p.autorId,
        origem: 'usuario',
        operacao: k === 0 ? 'tarefa.criar' : 'tarefa.mover',
        entidade: 'tarefa',
        registroId: String(id),
        valorNovo: { etapa: p.etapa },
      });
    });

    // Avisos: designação (quando outra pessoa criou) e menção na descrição.
    avisar(ctx, {
      destinatarioId: responsavel.id,
      natureza: 'tarefa_designada',
      registroTipo: 'tarefa',
      registroId: id,
      origemId: criador.id,
      geradoEm: criadoEm,
    });
    if (descricao?.includes(`@${colega.nome}`)) {
      avisar(ctx, {
        destinatarioId: colega.id,
        natureza: 'mencao',
        registroTipo: 'tarefa',
        registroId: id,
        origemId: criador.id,
        geradoEm: criadoEm,
      });
    }
    // Avisos de prazo (o worker gera um por prazo por dia): para as abertas vencidas ou a vencer.
    if (prazo && !encerrada) {
      const limite = relogio.dia(relogio.somarDias(relogio.agora, 3));
      if (prazo < hoje) {
        avisar(ctx, {
          destinatarioId: responsavel.id,
          natureza: 'prazo_vencido',
          registroTipo: 'tarefa',
          registroId: id,
          origemId: null,
          geradoEm: relogio.diasAtras(0),
          chaveUnica: `prazo_vencido:tarefa:${id}:${hoje}`,
        });
      } else if (prazo <= limite) {
        avisar(ctx, {
          destinatarioId: responsavel.id,
          natureza: 'prazo_proximo',
          registroTipo: 'tarefa',
          registroId: id,
          origemId: null,
          geradoEm: relogio.diasAtras(0),
          chaveUnica: `prazo_proximo:tarefa:${id}:${hoje}`,
        });
      }
    }
  }
  await ctx.bd.insert(movimentacao).values(movimentos);

  // Reatribuídas (avisa quem recebeu) e canceladas (justificadas; a tarefa deixa de se alterar).
  for (const t of sorteio.amostra(
    criadas.filter((c) => !c.encerrada),
    reatribuidas,
  )) {
    const quem = sorteio.escolher(supervisores);
    const quando = relogio.diasAtras(sorteio.inteiro(0, 6));
    avisar(ctx, {
      destinatarioId: t.responsavelId,
      natureza: 'tarefa_reatribuida',
      registroTipo: 'tarefa',
      registroId: t.id,
      origemId: quem.id,
      geradoEm: quando,
    });
    registrarNaTrilha(ctx, {
      ocorridaEm: quando,
      autorId: quem.id,
      origem: 'usuario',
      operacao: 'tarefa.reatribuir',
      entidade: 'tarefa',
      registroId: String(t.id),
      valorNovo: { responsavelId: t.responsavelId },
    });
  }
  const paraCancelar = sorteio.amostra(
    criadas.filter((c) => !c.encerrada),
    canceladas,
  );
  for (const [k, t] of paraCancelar.entries()) {
    const quem = sorteio.escolher(supervisores);
    const quando = relogio.diasAtras(sorteio.inteiro(0, 5));
    await ctx.bd
      .update(tarefa)
      .set({
        canceladaEm: quando,
        canceladaPor: quem.id,
        justificativaCancelamento:
          justificativasDeCancelamento[k % justificativasDeCancelamento.length]!,
        atualizadoEm: quando,
      })
      .where(eq(tarefa.id, t.id));
    registrarNaTrilha(ctx, {
      ocorridaEm: quando,
      autorId: quem.id,
      origem: 'usuario',
      operacao: 'tarefa.cancelar',
      entidade: 'tarefa',
      registroId: String(t.id),
      justificativa: 'Cancelada pela supervisão.',
    });
  }

  contar(ctx, 'Tarefas', criadas.length);
  contar(ctx, 'Movimentações de tarefas (histórico)', movimentos.length);
}
