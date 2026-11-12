import { and, desc, eq } from 'drizzle-orm';
import type { Transacao } from '../conexao.js';
import {
  etapa,
  movimentacao,
  tipoProcesso,
  type PapelDeEtapa,
  type TipoDeProcesso,
  type TipoDeRegistro,
} from '../esquema/index.js';

/**
 * Mecanismo ÚNICO de movimentação (docs/especificacao/02-modulos.md): demanda, tarefa, projeto
 * de lei, emenda, destinação e despesa percorrem etapas por aqui. Nenhum tem máquina de
 * estados própria. O banco recusa etapa de outro fluxo ou inativa e torna a movimentação
 * imutável; o histórico de um registro é a leitura das suas movimentações.
 */

/** Fluxo que cada tipo de registro percorre. */
export const fluxoDoRegistro: Readonly<Record<TipoDeRegistro, TipoDeProcesso>> = {
  demanda: 'demanda',
  tarefa: 'tarefa',
  projeto_lei: 'projeto_lei',
  emenda: 'emenda',
  destinacao: 'emenda',
  despesa: 'despesa_ceap',
};

export type StatusDeRegistro = 'em_andamento' | 'concluido' | 'arquivado';

/** O status é DERIVADO do papel da etapa; nunca é armazenado (RN-DEM-06). */
export function statusPeloPapel(papel: PapelDeEtapa): StatusDeRegistro {
  switch (papel) {
    case 'conclusao':
      return 'concluido';
    case 'arquivamento':
      return 'arquivado';
    default:
      return 'em_andamento';
  }
}

export interface NovaMovimentacao {
  readonly registroTipo: TipoDeRegistro;
  readonly registroId: number;
  readonly etapaOrigemId: number | null;
  readonly etapaDestinoId: number;
  readonly autorId: number;
  readonly observacao?: string | null;
  /** Hora do ato, pelo relógio da aplicação. Se omitida, vale a do banco. */
  readonly criadaEm?: Date;
}

export async function idDoTipoDeProcesso(
  tx: Pick<Transacao, 'select'>,
  tipo: TipoDeProcesso,
): Promise<number> {
  const [linha] = await tx
    .select({ id: tipoProcesso.id })
    .from(tipoProcesso)
    .where(eq(tipoProcesso.tipo, tipo))
    .limit(1);
  if (!linha) throw new Error(`Tipo de processo ${tipo} não existe.`);
  return linha.id;
}

/** A etapa de Entrada ativa do fluxo: onde todo registro novo nasce. */
export async function etapaDeEntrada(
  tx: Pick<Transacao, 'select'>,
  tipo: TipoDeProcesso,
): Promise<{ id: number; papel: PapelDeEtapa }> {
  const [linha] = await tx
    .select({ id: etapa.id, papel: etapa.papel })
    .from(etapa)
    .innerJoin(tipoProcesso, eq(tipoProcesso.id, etapa.tipoProcessoId))
    .where(
      and(eq(tipoProcesso.tipo, tipo), eq(etapa.papel, 'entrada'), eq(etapa.situacao, 'ativa')),
    )
    .limit(1);
  if (!linha) throw new Error(`O fluxo ${tipo} não tem etapa de Entrada ativa.`);
  return linha;
}

/** Registra a transição de etapa. Chamar dentro da transação da operação do módulo. */
export async function registrarMovimentacao(
  tx: Pick<Transacao, 'select' | 'insert'>,
  dados: NovaMovimentacao,
): Promise<number> {
  const tipoProcessoId = await idDoTipoDeProcesso(tx, fluxoDoRegistro[dados.registroTipo]);
  const [criada] = await tx
    .insert(movimentacao)
    .values({
      registroTipo: dados.registroTipo,
      registroId: dados.registroId,
      tipoProcessoId,
      etapaOrigemId: dados.etapaOrigemId,
      etapaDestinoId: dados.etapaDestinoId,
      autorId: dados.autorId,
      observacao: dados.observacao ?? null,
      ...(dados.criadaEm ? { criadaEm: dados.criadaEm } : {}),
    })
    .returning({ id: movimentacao.id });
  if (!criada) throw new Error('Falha ao registrar a movimentação.');
  return criada.id;
}

/** A etapa atual de um registro: o destino da sua última movimentação. */
export async function etapaAtualDoRegistro(
  tx: Pick<Transacao, 'select'>,
  registroTipo: TipoDeRegistro,
  registroId: number,
) {
  const [linha] = await tx
    .select({ etapaId: etapa.id, papel: etapa.papel, nome: etapa.nomeInterno })
    .from(movimentacao)
    .innerJoin(etapa, eq(etapa.id, movimentacao.etapaDestinoId))
    .where(
      and(eq(movimentacao.registroTipo, registroTipo), eq(movimentacao.registroId, registroId)),
    )
    .orderBy(desc(movimentacao.id))
    .limit(1);
  return linha;
}
