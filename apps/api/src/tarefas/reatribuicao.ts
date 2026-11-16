import {
  criarAvisos,
  demanda,
  registrarTrilha,
  tarefa,
  usuario,
  type Leitor,
  type Transacao,
} from '@gabinete/banco';
import type { Perfil } from '@gabinete/compartilhado';
import { eq } from 'drizzle-orm';
import type { Ator } from '../equipe/regras.js';
import { erros } from '../erros.js';
import { idsDosCorresponsaveis, respondePor, substituirCorresponsaveis } from '../responsaveis.js';

/** O usuário que vai responder: precisa existir e estar ativo. */
export async function carregarResponsavelAtivo(
  leitor: Leitor,
  usuarioId: number,
): Promise<{ id: number; perfil: Perfil }> {
  const [alvo] = await leitor
    .select({ id: usuario.id, perfil: usuario.perfil, situacao: usuario.situacao })
    .from(usuario)
    .where(eq(usuario.id, usuarioId))
    .limit(1);
  if (!alvo || alvo.situacao !== 'ativo') {
    throw erros.conflito('O responsável precisa ser um usuário ativo da equipe.');
  }
  return { id: alvo.id, perfil: alvo.perfil };
}

/**
 * Passa a tarefa para outro responsável principal e/ou troca a lista dos demais. Quem entra é avisado
 * (o novo principal, como "passada para você"; os demais, como "designada"). Um Assessor Externo só
 * pode responder por uma tarefa ligada a uma demanda que ele também alcança.
 */
export async function reatribuirTarefa(
  tx: Transacao,
  ator: Ator,
  atual: {
    id: number;
    responsavelId: number;
    vinculoTipo: string | null;
    vinculoId: number | null;
  },
  corpo: { responsavelId?: number | undefined; corresponsaveis?: readonly number[] | undefined },
  agora: Date,
): Promise<void> {
  if (corpo.responsavelId === atual.responsavelId && corpo.corresponsaveis === undefined) {
    throw erros.conflito('Este já é o responsável.');
  }
  const novoPrincipal = corpo.responsavelId ?? atual.responsavelId;
  const validar = async (uid: number) => {
    const novo = await carregarResponsavelAtivo(tx, uid);
    if (atual.vinculoTipo === 'demanda' && novo.perfil === 'assessor_externo') {
      const [d] = await tx
        .select({ id: demanda.id, responsavelId: demanda.responsavelId })
        .from(demanda)
        .where(eq(demanda.id, atual.vinculoId as number))
        .limit(1);
      if (!d || !(await respondePor(tx, 'demanda', d.id, d.responsavelId, novo.id))) {
        throw erros.conflito('O novo responsável não alcança a demanda desta tarefa.');
      }
    }
  };
  const principalMudou = novoPrincipal !== atual.responsavelId;
  if (principalMudou) {
    await validar(novoPrincipal);
    await tx.update(tarefa).set({ responsavelId: novoPrincipal }).where(eq(tarefa.id, atual.id));
  }
  const lista = corpo.corresponsaveis ?? (await idsDosCorresponsaveis(tx, 'tarefa', atual.id));
  const { adicionados, removidos } = await substituirCorresponsaveis(
    tx,
    'tarefa',
    atual.id,
    novoPrincipal,
    lista,
    validar,
  );
  await registrarTrilha(tx, {
    origem: 'usuario',
    autorId: ator.usuarioId,
    operacao: 'tarefa.reatribuir',
    entidade: 'tarefa',
    registroId: atual.id,
    valorAnterior: { responsavelId: atual.responsavelId, removidos },
    valorNovo: { responsavelId: novoPrincipal, adicionados },
  });
  await criarAvisos(tx, ator.usuarioId, [
    ...(principalMudou
      ? [
          {
            destinatarioId: novoPrincipal,
            natureza: 'tarefa_reatribuida' as const,
            registroTipo: 'tarefa' as const,
            registroId: atual.id,
            geradoEm: agora,
          },
        ]
      : []),
    ...adicionados.map((destinatarioId) => ({
      destinatarioId,
      natureza: 'tarefa_designada' as const,
      registroTipo: 'tarefa' as const,
      registroId: atual.id,
      geradoEm: agora,
    })),
  ]);
}
