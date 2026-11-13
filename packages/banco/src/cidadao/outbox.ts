import { createHash, randomBytes } from 'node:crypto';
import { and, eq, inArray, sql } from 'drizzle-orm';
import type { Transacao } from '../conexao.js';
import { demanda, envioNotificacao, pessoa, type EventoDeNotificacao } from '../esquema/index.js';
import { consentimentoVigente } from './consentimento.js';

export interface NovaNotificacao {
  readonly demandaId: number;
  readonly evento: EventoDeNotificacao;
  /** O que o modelo do e-mail precisa (rótulo público, texto do andamento). Nunca título nem dado interno. */
  readonly payload?: Record<string, unknown>;
  readonly criadoEm?: Date;
}

/**
 * Padrão outbox (ADR 0004): chamado DENTRO da transação do ato. Só enfileira se o cidadão pode ser
 * notificado agora: pessoa ativa, com e-mail válido, com consentimento vigente, e link ativo para
 * ele acompanhar (RN-NOT-01). Se não puder, não faz nada e o ato segue. Devolve o id, ou null.
 *
 * O link de descadastro é único por mensagem: aqui nasce o token, e o banco guarda só o hash.
 */
export async function enfileirarNotificacao(
  tx: Transacao,
  nova: NovaNotificacao,
): Promise<number | null> {
  const [alvo] = await tx
    .select({
      pessoaId: pessoa.id,
      protocolo: demanda.protocolo,
      email: pessoa.email,
      invalido: pessoa.emailInvalido,
      situacao: pessoa.situacao,
      link: demanda.publicacaoLink,
    })
    .from(demanda)
    .innerJoin(pessoa, eq(pessoa.id, demanda.solicitanteId))
    .where(eq(demanda.id, nova.demandaId))
    .limit(1);
  if (!alvo || alvo.situacao !== 'ativa' || !alvo.email || alvo.invalido) return null;
  if (alvo.link !== 'ativa') return null;
  if (!(await consentimentoVigente(tx, alvo.pessoaId))) return null;

  // O rótulo público da situação atual, pela MESMA visão do cidadão (dentro da transação do ato).
  const rotulo = await tx.execute<{ rotulo: string }>(
    sql`SELECT rotulo FROM vw_acompanhamento_etapas WHERE protocolo = ${alvo.protocolo} AND estado = 'atual'`,
  );
  const rotuloAtual = rotulo[0]?.rotulo ?? null;

  const token = randomBytes(32).toString('base64url');
  const [criado] = await tx
    .insert(envioNotificacao)
    .values({
      pessoaId: alvo.pessoaId,
      demandaId: nova.demandaId,
      evento: nova.evento,
      payload: { rotulo: rotuloAtual, ...nova.payload, descadastro: token },
      descadastroHash: createHash('sha256').update(token).digest('hex'),
      ...(nova.criadoEm ? { criadoEm: nova.criadoEm, proximaTentativaEm: nova.criadoEm } : {}),
    })
    .returning({ id: envioNotificacao.id });
  return criado?.id ?? null;
}

/** Cancela o que ainda não saiu (consentimento retirado, dados eliminados). Vale na hora. */
export async function cancelarEnviosPendentes(
  tx: Pick<Transacao, 'update'>,
  pessoaId: number,
  motivo: string,
): Promise<void> {
  await tx
    .update(envioNotificacao)
    .set({ estado: 'cancelado', erro: motivo })
    .where(
      and(
        eq(envioNotificacao.pessoaId, pessoaId),
        inArray(envioNotificacao.estado, ['pendente', 'enviando']),
      ),
    );
}
