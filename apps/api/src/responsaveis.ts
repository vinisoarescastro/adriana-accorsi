import {
  demanda,
  demandaResponsavel,
  tarefa,
  tarefaResponsavel,
  usuario,
  type Leitor,
  type Transacao,
} from '@gabinete/banco';
import { and, eq, inArray, or, sql, type SQL } from 'drizzle-orm';

/**
 * Mais de um responsável por demanda e por tarefa. O PRINCIPAL continua em `responsavel_id`; os demais
 * ("corresponsáveis") ficam numa tabela à parte. Para alcance e permissão, todos contam como
 * responsáveis: veem o registro, acompanham e podem alterá-lo (as mesmas regras do principal).
 */
export type TipoComResponsaveis = 'demanda' | 'tarefa';

const tabela = {
  demanda: { t: demandaResponsavel, registro: demandaResponsavel.demandaId },
  tarefa: { t: tarefaResponsavel, registro: tarefaResponsavel.tarefaId },
} as const;

/** Condição SQL: a demanda é do usuário (como principal ou corresponsável). */
export const demandaDoUsuario = (usuarioId: number): SQL =>
  or(
    eq(demanda.responsavelId, usuarioId),
    sql`exists (select 1 from demanda_responsavel dr where dr.demanda_id = ${demanda.id} and dr.usuario_id = ${usuarioId})`,
  ) as SQL;

/** Condição SQL: a tarefa é do usuário (como principal ou corresponsável). */
export const tarefaDoUsuario = (usuarioId: number): SQL =>
  or(
    eq(tarefa.responsavelId, usuarioId),
    sql`exists (select 1 from tarefa_responsavel tr where tr.tarefa_id = ${tarefa.id} and tr.usuario_id = ${usuarioId})`,
  ) as SQL;

export async function idsDosCorresponsaveis(
  leitor: Leitor,
  tipo: TipoComResponsaveis,
  registroId: number,
): Promise<number[]> {
  const { t, registro } = tabela[tipo];
  const linhas = await leitor
    .select({ usuarioId: t.usuarioId })
    .from(t)
    .where(eq(registro, registroId));
  return linhas.map((l) => l.usuarioId);
}

/** Os corresponsáveis (id e nome) de vários registros de uma vez: `registroId → pessoas`. */
export async function corresponsaveisDe(
  leitor: Leitor,
  tipo: TipoComResponsaveis,
  registros: readonly number[],
): Promise<Map<number, { id: number; nome: string }[]>> {
  const mapa = new Map<number, { id: number; nome: string }[]>();
  if (registros.length === 0) return mapa;
  const { t, registro } = tabela[tipo];
  const linhas = await leitor
    .select({ registroId: registro, id: usuario.id, nome: usuario.nome })
    .from(t)
    .innerJoin(usuario, eq(usuario.id, t.usuarioId))
    .where(inArray(registro, [...registros]))
    .orderBy(t.adicionadoEm, usuario.nome);
  for (const l of linhas) {
    mapa.set(l.registroId, [...(mapa.get(l.registroId) ?? []), { id: l.id, nome: l.nome }]);
  }
  return mapa;
}

/** Acrescenta `corresponsaveis` a cada item (a lista vazia se o item não tem nenhum). */
export async function comCorresponsaveis<T extends { id: number }>(
  leitor: Leitor,
  tipo: TipoComResponsaveis,
  itens: readonly T[],
): Promise<(T & { corresponsaveis: { id: number; nome: string }[] })[]> {
  const mapa = await corresponsaveisDe(
    leitor,
    tipo,
    itens.map((i) => i.id),
  );
  return itens.map((i) => ({ ...i, corresponsaveis: mapa.get(i.id) ?? [] }));
}

/** O usuário responde pelo registro (principal ou corresponsável)? */
export async function respondePor(
  leitor: Leitor,
  tipo: TipoComResponsaveis,
  registroId: number,
  principalId: number,
  usuarioId: number,
): Promise<boolean> {
  if (principalId === usuarioId) return true;
  const { t, registro } = tabela[tipo];
  const [linha] = await leitor
    .select({ usuarioId: t.usuarioId })
    .from(t)
    .where(and(eq(registro, registroId), eq(t.usuarioId, usuarioId)))
    .limit(1);
  return linha !== undefined;
}

/**
 * Troca a lista de corresponsáveis. O principal nunca entra na lista; repetidos somem; cada novo é
 * validado por `validar`. Devolve quem entrou e quem saiu (quem entrou é avisado por quem chama).
 */
export async function substituirCorresponsaveis(
  tx: Transacao,
  tipo: TipoComResponsaveis,
  registroId: number,
  principalId: number,
  novos: readonly number[],
  validar: (id: number) => Promise<void>,
): Promise<{ adicionados: number[]; removidos: number[] }> {
  const { t, registro } = tabela[tipo];
  const desejados = [...new Set(novos)].filter((id) => id !== principalId);
  const atuais = await idsDosCorresponsaveis(tx, tipo, registroId);
  const adicionados = desejados.filter((id) => !atuais.includes(id));
  const removidos = atuais.filter((id) => !desejados.includes(id));
  for (const id of adicionados) await validar(id);
  if (removidos.length > 0) {
    await tx.delete(t).where(and(eq(registro, registroId), inArray(t.usuarioId, removidos)));
  }
  if (adicionados.length > 0) {
    await tx.insert(t).values(
      adicionados.map((usuarioId) => ({
        [tipo === 'demanda' ? 'demandaId' : 'tarefaId']: registroId,
        usuarioId,
      })) as never,
    );
  }
  return { adicionados, removidos };
}
