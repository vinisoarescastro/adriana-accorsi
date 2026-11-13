import { desc, eq, inArray } from 'drizzle-orm';
import type { Leitor } from '../conexao.js';
import { consentimentoNotificacao, type OrigemDeConsentimento } from '../esquema/index.js';
import { registrarTrilha } from '../trilha.js';

/** O consentimento vigente é o registro mais recente; sem registro, não há consentimento (RN-NOT-02). */
export async function consentimentoVigente(leitor: Leitor, pessoaId: number): Promise<boolean> {
  const [ultimo] = await leitor
    .select({ consentido: consentimentoNotificacao.consentido })
    .from(consentimentoNotificacao)
    .where(eq(consentimentoNotificacao.pessoaId, pessoaId))
    .orderBy(desc(consentimentoNotificacao.id))
    .limit(1);
  return ultimo?.consentido ?? false;
}

export interface NovoConsentimento {
  readonly pessoaId: number;
  readonly consentido: boolean;
  readonly origem: OrigemDeConsentimento;
  /** Quem registrou. Nulo só no descadastro feito pelo próprio cidadão (função do banco). */
  readonly registradoPor: number | null;
  /** Versão do texto aceito; obrigatória quando o consentimento é "sim". */
  readonly versaoTexto?: number;
  readonly registradoEm?: Date;
}

/**
 * Acrescenta um registro ao histórico e à trilha, na mesma transação. Só registra se o valor muda:
 * repetir o mesmo "sim" ou "não" não polui o histórico. Devolve se houve mudança.
 */
export async function registrarConsentimento(
  tx: Parameters<typeof registrarTrilha>[0] & Leitor,
  dados: NovoConsentimento,
): Promise<boolean> {
  if ((await consentimentoVigente(tx, dados.pessoaId)) === dados.consentido) return false;
  await tx.insert(consentimentoNotificacao).values({
    pessoaId: dados.pessoaId,
    consentido: dados.consentido,
    origem: dados.origem,
    registradoPor: dados.registradoPor,
    versaoTexto: dados.consentido ? (dados.versaoTexto ?? null) : null,
    ...(dados.registradoEm ? { registradoEm: dados.registradoEm } : {}),
  });
  await registrarTrilha(tx, {
    origem: 'usuario',
    autorId: dados.registradoPor,
    operacao: 'consentimento.registrar',
    entidade: 'pessoa',
    registroId: dados.pessoaId,
    // Sem dado pessoal: só o valor, a origem e a versão do texto.
    valorNovo: {
      consentido: dados.consentido,
      origem: dados.origem,
      versaoTexto: dados.consentido ? (dados.versaoTexto ?? null) : null,
    },
  });
  return true;
}

/** O consentimento vigente de várias pessoas de uma vez (uma consulta, não uma por pessoa). */
export async function consentimentosVigentes(
  leitor: Leitor,
  pessoaIds: readonly number[],
): Promise<Map<number, boolean>> {
  const mapa = new Map<number, boolean>();
  if (pessoaIds.length === 0) return mapa;
  const linhas = await leitor
    .select({
      pessoaId: consentimentoNotificacao.pessoaId,
      consentido: consentimentoNotificacao.consentido,
    })
    .from(consentimentoNotificacao)
    .where(inArray(consentimentoNotificacao.pessoaId, [...pessoaIds]))
    .orderBy(consentimentoNotificacao.id);
  // Em ordem de registro: o último de cada pessoa é o vigente.
  for (const l of linhas) mapa.set(l.pessoaId, l.consentido);
  return mapa;
}
