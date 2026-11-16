import { criarAvisos, demanda, registrarTrilha, type Transacao } from '@gabinete/banco';
import { eq } from 'drizzle-orm';
import { exigirResponsavelValido } from '../atendimento/comum.js';
import type { Ator } from '../equipe/regras.js';
import { erros } from '../erros.js';
import { idsDosCorresponsaveis, substituirCorresponsaveis } from '../responsaveis.js';

/**
 * Passa a demanda para outro responsável principal e/ou troca a lista dos demais responsáveis. Todos
 * precisam ser usuários ativos com Atendimento (ou Administrador/Parlamentar). Quem entra é avisado.
 */
export async function reatribuirDemanda(
  tx: Transacao,
  ator: Ator,
  atual: { id: number; responsavelId: number },
  corpo: { responsavelId?: number | undefined; corresponsaveis?: readonly number[] | undefined },
  agora: Date,
): Promise<void> {
  if (corpo.responsavelId === atual.responsavelId && corpo.corresponsaveis === undefined) {
    throw erros.conflito('Este já é o responsável.');
  }
  const novoPrincipal = corpo.responsavelId ?? atual.responsavelId;
  const validar = (uid: number) => exigirResponsavelValido(tx, uid);
  if (novoPrincipal !== atual.responsavelId) {
    await validar(novoPrincipal);
    await tx.update(demanda).set({ responsavelId: novoPrincipal }).where(eq(demanda.id, atual.id));
  }
  // Sem lista nova, a atual continua (só sai de lá quem virou o principal).
  const lista = corpo.corresponsaveis ?? (await idsDosCorresponsaveis(tx, 'demanda', atual.id));
  const { adicionados, removidos } = await substituirCorresponsaveis(
    tx,
    'demanda',
    atual.id,
    novoPrincipal,
    lista,
    validar,
  );
  await criarAvisos(
    tx,
    ator.usuarioId,
    adicionados.map((destinatarioId) => ({
      destinatarioId,
      natureza: 'demanda_designada' as const,
      registroTipo: 'demanda' as const,
      registroId: atual.id,
      geradoEm: agora,
    })),
  );
  await registrarTrilha(tx, {
    origem: 'usuario',
    autorId: ator.usuarioId,
    operacao: 'demanda.reatribuir',
    entidade: 'demanda',
    registroId: atual.id,
    valorAnterior: { responsavelId: atual.responsavelId, removidos },
    valorNovo: { responsavelId: novoPrincipal, adicionados },
  });
}
