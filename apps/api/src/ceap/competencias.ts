import {
  ceapEncerramento,
  despesa,
  etapa,
  registrarTrilha,
  type BancoDeDados,
} from '@gabinete/banco';
import { and, eq, sql } from 'drizzle-orm';
import type { Ator } from '../equipe/regras.js';
import { erros } from '../erros.js';
import { etapasDaDespesa } from './saldo.js';

/**
 * Encerramento da competência (mês). Depois de encerrada, ela não recebe despesa nova nem mudança; e não se
 * encerra com despesa aguardando análise. Reabrir é possível e fica na trilha.
 */
export class ServicoDeCompetencias {
  constructor(
    private readonly bd: BancoDeDados,
    private readonly agora: () => Date,
  ) {}

  async encerrar(ator: Ator, ano: number, mes: number): Promise<void> {
    await this.bd.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('ceap'))`);
      const etapas = await etapasDaDespesa(tx);
      const aguardando = await tx
        .select({ id: despesa.id })
        .from(despesa)
        .innerJoin(etapa, eq(etapa.id, despesa.etapaAtualId))
        .where(
          and(
            eq(despesa.competenciaAno, ano),
            eq(despesa.competenciaMes, mes),
            eq(despesa.etapaAtualId, etapas.get('Em análise')!.id),
            sql`${despesa.canceladaEm} IS NULL`,
          ),
        );
      if (aguardando.length > 0) {
        throw erros.conflito(
          `Há ${aguardando.length} despesa(s) aguardando análise nesta competência. Decida ou cancele antes de encerrar.`,
        );
      }
      const [atual] = await tx
        .select()
        .from(ceapEncerramento)
        .where(and(eq(ceapEncerramento.ano, ano), eq(ceapEncerramento.mes, mes)))
        .limit(1)
        .for('update');
      if (atual && atual.reabertaEm === null)
        throw erros.conflito('A competência já está encerrada.');
      if (atual) {
        await tx
          .update(ceapEncerramento)
          .set({
            encerradaPor: ator.usuarioId,
            encerradaEm: this.agora(),
            reabertaPor: null,
            reabertaEm: null,
          })
          .where(and(eq(ceapEncerramento.ano, ano), eq(ceapEncerramento.mes, mes)));
      } else {
        await tx
          .insert(ceapEncerramento)
          .values({ ano, mes, encerradaPor: ator.usuarioId, encerradaEm: this.agora() });
      }
      await registrarTrilha(tx, {
        origem: 'usuario',
        autorId: ator.usuarioId,
        operacao: 'ceap.competencia_encerrar',
        entidade: 'ceap_competencia',
        registroId: `${ano}-${String(mes).padStart(2, '0')}`,
      });
    });
  }

  async reabrir(ator: Ator, ano: number, mes: number): Promise<void> {
    await this.bd.transaction(async (tx) => {
      const [atual] = await tx
        .select()
        .from(ceapEncerramento)
        .where(and(eq(ceapEncerramento.ano, ano), eq(ceapEncerramento.mes, mes)))
        .limit(1)
        .for('update');
      if (!atual || atual.reabertaEm !== null)
        throw erros.conflito('A competência não está encerrada.');
      await tx
        .update(ceapEncerramento)
        .set({ reabertaPor: ator.usuarioId, reabertaEm: this.agora() })
        .where(and(eq(ceapEncerramento.ano, ano), eq(ceapEncerramento.mes, mes)));
      await registrarTrilha(tx, {
        origem: 'usuario',
        autorId: ator.usuarioId,
        operacao: 'ceap.competencia_reabrir',
        entidade: 'ceap_competencia',
        registroId: `${ano}-${String(mes).padStart(2, '0')}`,
      });
    });
  }
}
