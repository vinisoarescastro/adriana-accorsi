import { habilitacao, pessoa, usuario, type Transacao } from '@gabinete/banco';
import { perfisComTodasAsHabilitacoes } from '@gabinete/compartilhado';
import { and, eq, inArray } from 'drizzle-orm';
import { erros } from '../erros.js';

/** Participante interno: usuário ativo com a habilitação de Agenda (Administrador e Parlamentar têm todas). */
export async function validarInternos(tx: Transacao, ids: readonly number[]): Promise<void> {
  if (ids.length === 0) return;
  const alvos = await tx
    .select({ id: usuario.id, perfil: usuario.perfil, situacao: usuario.situacao })
    .from(usuario)
    .where(inArray(usuario.id, [...ids]));
  if (alvos.length !== ids.length || alvos.some((u) => u.situacao !== 'ativo')) {
    throw erros.conflito('Todo participante interno precisa ser um usuário ativo da equipe.');
  }
  const comAgenda = new Set(
    (
      await tx
        .select({ usuarioId: habilitacao.usuarioId })
        .from(habilitacao)
        .where(and(inArray(habilitacao.usuarioId, [...ids]), eq(habilitacao.area, 'AG')))
    ).map((h) => h.usuarioId),
  );
  for (const u of alvos) {
    if (!perfisComTodasAsHabilitacoes.includes(u.perfil) && !comAgenda.has(u.id)) {
      throw erros.conflito('Todo participante interno precisa ter a habilitação de Agenda.');
    }
  }
}

/** Participante externo: pessoa já cadastrada e ativa. Não tem acesso, aviso nem presença. */
export async function validarExternos(tx: Transacao, ids: readonly number[]): Promise<void> {
  if (ids.length === 0) return;
  const alvos = await tx
    .select({ id: pessoa.id, situacao: pessoa.situacao })
    .from(pessoa)
    .where(inArray(pessoa.id, [...ids]));
  if (alvos.length !== ids.length || alvos.some((p) => p.situacao !== 'ativa')) {
    throw erros.conflito('Todo participante externo precisa ser uma pessoa cadastrada e ativa.');
  }
}
