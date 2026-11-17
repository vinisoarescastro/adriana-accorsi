import { nivelDoPerfil } from '@gabinete/autorizacao';
import { emenda, etapa, tipoProcesso, type Leitor, type Transacao } from '@gabinete/banco';
import { and, eq } from 'drizzle-orm';
import type { Ator } from '../equipe/regras.js';
import { erros } from '../erros.js';

export type EmendaCarregada = typeof emenda.$inferSelect;

/** Carrega a emenda travando a linha: as contas de valor se fazem com ela travada. */
export async function carregarEmenda(tx: Transacao, id: number): Promise<EmendaCarregada> {
  const [linha] = await tx.select().from(emenda).where(eq(emenda.id, id)).limit(1).for('update');
  if (!linha) throw erros.naoEncontrado();
  return linha;
}

/** Quem acompanha: o responsável, o Supervisor ou superior. */
export function exigirPodeAcompanhar(ator: Ator, e: Pick<EmendaCarregada, 'responsavelId'>): void {
  if (nivelDoPerfil[ator.perfil] >= 3 || e.responsavelId === ator.usuarioId) return;
  throw erros.semPermissao('Só o responsável, o Supervisor ou superior alteram esta emenda.');
}

export function exigirNaoCancelada(e: Pick<EmendaCarregada, 'canceladaEm'>): void {
  if (e.canceladaEm) throw erros.conflito('Emenda cancelada não se altera.');
}

/** A etapa em que a destinação nasce: a primeira intermediária ativa do fluxo da emenda ("Indicada"). */
export async function etapaInicialDaDestinacao(leitor: Leitor): Promise<number> {
  const [linha] = await leitor
    .select({ id: etapa.id })
    .from(etapa)
    .innerJoin(tipoProcesso, eq(tipoProcesso.id, etapa.tipoProcessoId))
    .where(
      and(
        eq(tipoProcesso.tipo, 'emenda'),
        eq(etapa.papel, 'intermediaria'),
        eq(etapa.situacao, 'ativa'),
      ),
    )
    .orderBy(etapa.ordem, etapa.id)
    .limit(1);
  if (!linha) throw erros.conflito('O fluxo da emenda não tem etapa intermediária ativa.');
  return linha.id;
}

/** A etapa de destino existe, é do fluxo da emenda e está ativa. */
export async function exigirEtapaDoFluxo(leitor: Leitor, etapaId: number) {
  const [destino] = await leitor
    .select({ id: etapa.id, situacao: etapa.situacao, papel: etapa.papel })
    .from(etapa)
    .innerJoin(tipoProcesso, eq(tipoProcesso.id, etapa.tipoProcessoId))
    .where(and(eq(etapa.id, etapaId), eq(tipoProcesso.tipo, 'emenda')))
    .limit(1);
  if (!destino) throw erros.requisicaoInvalida();
  if (destino.situacao !== 'ativa') throw erros.conflito('A etapa de destino está inativa.');
  return destino;
}
