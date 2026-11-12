import type { Transacao } from './conexao.js';
import { trilha, type OrigemDaTrilha } from './esquema/index.js';

export interface EntradaDaTrilha {
  readonly origem: OrigemDaTrilha;
  readonly autorId?: number | null;
  readonly operacao: string;
  readonly entidade: string;
  readonly registroId?: string | number | null;
  readonly valorAnterior?: unknown;
  readonly valorNovo?: unknown;
  readonly justificativa?: string | null;
}

/**
 * Registra uma entrada na trilha. Deve ser chamada DENTRO da transação da operação:
 * se gravar a trilha falhar, a operação inteira é desfeita (RN-AUD-01).
 * Valores nunca devem conter senha nem segredo; o banco também recusa chaves suspeitas.
 */
export async function registrarTrilha(
  tx: Pick<Transacao, 'insert'>,
  entrada: EntradaDaTrilha,
): Promise<void> {
  await tx.insert(trilha).values({
    origem: entrada.origem,
    autorId: entrada.autorId ?? null,
    operacao: entrada.operacao,
    entidade: entrada.entidade,
    registroId: entrada.registroId === undefined ? null : String(entrada.registroId),
    valorAnterior: entrada.valorAnterior ?? null,
    valorNovo: entrada.valorNovo ?? null,
    justificativa: entrada.justificativa ?? null,
  });
}
