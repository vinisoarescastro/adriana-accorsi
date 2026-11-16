import {
  demanda,
  etapa,
  parametro,
  tarefa,
  tipoProcesso,
  type BancoDeDados,
} from '@gabinete/banco';
import type { PainelDeAtendimento, PainelDeTarefas } from '@gabinete/compartilhado';
import { and, asc, count, eq, gte, inArray, isNull, lt, sql, type SQL } from 'drizzle-orm';
import { hojeNoGabinete, inicioDoMesNoGabinete } from '../atendimento/comum.js';
import { ConsultasDeDemandas } from '../demandas/consultas.js';
import type { Ator } from '../equipe/regras.js';
import { ConsultasDeTarefas } from '../tarefas/consultas.js';

const limiteParadoPadraoEmDias = 14;
const umDiaEmMs = 86_400_000;

/**
 * Bloco de atendimento do painel. Os números vêm das MESMAS condições de alcance das listagens
 * (`condicoesDeAlcance`): o painel nunca mostra o que a lista não mostraria.
 */
export class ServicoDoPainel {
  constructor(
    private readonly bd: BancoDeDados,
    private readonly agora: () => Date,
  ) {}

  private async limiteParado(): Promise<number> {
    const [linha] = await this.bd
      .select({ valor: parametro.valor })
      .from(parametro)
      .where(eq(parametro.chave, 'limite_parado.demanda'))
      .limit(1);
    return typeof linha?.valor === 'number' && linha.valor > 0
      ? linha.valor
      : limiteParadoPadraoEmDias;
  }

  async atendimento(ator: Ator): Promise<PainelDeAtendimento> {
    const agora = this.agora();
    const hoje = hojeNoGabinete(agora);
    const limite = await this.limiteParado();
    const alcance = ConsultasDeDemandas.condicoesDeAlcance(ator);

    const emAndamento = and(
      isNull(demanda.canceladaEm),
      inArray(etapa.papel, ['entrada', 'intermediaria']),
    );
    const ultimaMovimentacao = sql`(select max(m.criada_em) from movimentacao m where m.registro_tipo = 'demanda' and m.registro_id = ${demanda.id})`;
    const desde = (instante: Date) =>
      sql`${ultimaMovimentacao} >= ${instante.toISOString()}::timestamptz`;
    const antes = (instante: Date) =>
      sql`${ultimaMovimentacao} < ${instante.toISOString()}::timestamptz`;

    const contar = async (
      ...condicoes: (ReturnType<typeof and> | ReturnType<typeof sql> | undefined)[]
    ) => {
      const [linha] = await this.bd
        .select({ total: count() })
        .from(demanda)
        .innerJoin(etapa, eq(etapa.id, demanda.etapaAtualId))
        .where(and(...alcance, ...condicoes));
      return linha?.total ?? 0;
    };

    const [abertas, atrasadas, paradas, novasNaSemana, concluidasNoMes, minhasAbertas] =
      await Promise.all([
        contar(emAndamento),
        contar(emAndamento, lt(demanda.prazo, hoje)),
        contar(emAndamento, antes(new Date(agora.getTime() - limite * umDiaEmMs))),
        contar(
          isNull(demanda.canceladaEm),
          gte(demanda.criadoEm, new Date(agora.getTime() - 7 * umDiaEmMs)),
        ),
        contar(
          isNull(demanda.canceladaEm),
          eq(etapa.papel, 'conclusao'),
          desde(inicioDoMesNoGabinete(agora)),
        ),
        contar(emAndamento, eq(demanda.responsavelId, ator.usuarioId)),
      ]);

    const etapas = await this.bd
      .select({ id: etapa.id, nome: etapa.nomeInterno, papel: etapa.papel })
      .from(etapa)
      .innerJoin(tipoProcesso, eq(tipoProcesso.id, etapa.tipoProcessoId))
      .where(and(eq(tipoProcesso.tipo, 'demanda'), eq(etapa.situacao, 'ativa')))
      .orderBy(asc(etapa.ordem), asc(etapa.id));
    const porEtapa = await this.bd
      .select({ etapaId: demanda.etapaAtualId, total: count() })
      .from(demanda)
      .where(and(...alcance, isNull(demanda.canceladaEm)))
      .groupBy(demanda.etapaAtualId);

    return {
      abertas,
      atrasadas,
      paradas,
      limiteParadoDias: limite,
      novasNaSemana,
      concluidasNoMes,
      minhasAbertas,
      porEtapa: etapas.map((e) => ({
        ...e,
        total: porEtapa.find((p) => p.etapaId === e.id)?.total ?? 0,
      })),
    };
  }

  /** Bloco de tarefas. Usa as mesmas condições de alcance da listagem de tarefas. */
  async tarefas(ator: Ator): Promise<PainelDeTarefas> {
    const hoje = hojeNoGabinete(this.agora());
    const alcance = ConsultasDeTarefas.condicoesDeAlcance(ator);
    const emAndamento = ConsultasDeTarefas.emAndamento();
    const contar = async (...extra: (SQL | undefined)[]) => {
      const [linha] = await this.bd
        .select({ total: count() })
        .from(tarefa)
        .innerJoin(etapa, eq(etapa.id, tarefa.etapaAtualId))
        .where(and(...alcance, emAndamento, ...extra));
      return linha?.total ?? 0;
    };
    const minha = eq(tarefa.responsavelId, ator.usuarioId);
    const vencida = lt(tarefa.prazo, hoje);
    const [abertas, atrasadas, minhasAbertas, minhasAtrasadas] = await Promise.all([
      contar(),
      contar(vencida),
      contar(minha),
      contar(minha, vencida),
    ]);
    return { abertas, atrasadas, minhasAbertas, minhasAtrasadas };
  }
}
