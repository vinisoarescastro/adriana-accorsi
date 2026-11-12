import { contaAcesso, habilitacao, sessao, usuario, type BancoDeDados } from '@gabinete/banco';
import type { Area, Perfil } from '@gabinete/compartilhado';
import { and, eq, ne } from 'drizzle-orm';
import { gerarTicket, hashDoTicket } from './tickets.js';

/** Sessão: 5 horas de inatividade ou 12 horas absolutas (RN-ACE-03). */
export const inatividadeMaximaEmMs = 5 * 3_600_000;
export const duracaoAbsolutaEmMs = 12 * 3_600_000;
/** Para não gravar a cada requisição, o último uso só é atualizado depois deste intervalo. */
const intervaloDeAtualizacaoEmMs = 60_000;

/** O que as funções de sessão precisam do banco: serve para o banco e para uma transação. */
export type Executor = Pick<BancoDeDados, 'select' | 'insert' | 'update' | 'delete'>;

export interface DadosDaSessao {
  readonly ticketHash: string;
  readonly usuarioId: number;
  readonly contaId: number;
  readonly nome: string;
  readonly email: string;
  readonly perfil: Perfil;
  readonly habilitacoes: readonly Area[];
  readonly senhaTrocaObrigatoria: boolean;
  readonly expiraEm: Date;
}

export interface SessaoCriada {
  readonly ticket: string;
  readonly expiraEm: Date;
  readonly habilitacoes: readonly Area[];
}

/** Cria a sessão com perfil e habilitações FIXADOS no momento da entrada. */
export async function criarSessao(
  executor: Executor,
  dados: { usuarioId: number; perfil: Perfil; agora: Date; segredo: string },
): Promise<SessaoCriada> {
  const concedidas = await executor
    .select({ area: habilitacao.area })
    .from(habilitacao)
    .where(eq(habilitacao.usuarioId, dados.usuarioId));
  const habilitacoes = concedidas.map((c) => c.area);

  const ticket = gerarTicket();
  const expiraEm = new Date(dados.agora.getTime() + duracaoAbsolutaEmMs);

  await executor.insert(sessao).values({
    ticketHash: hashDoTicket(ticket, dados.segredo),
    usuarioId: dados.usuarioId,
    perfil: dados.perfil,
    habilitacoes,
    criadaEm: dados.agora,
    ultimoUsoEm: dados.agora,
    expiraEm,
  });

  return { ticket, expiraEm, habilitacoes };
}

/**
 * Procura a sessão válida do ticket. Devolve `null` se não existe, expirou (absoluta ou por
 * inatividade) ou se o usuário foi inativado. Sessão vencida é apagada.
 */
export async function buscarSessao(
  bd: BancoDeDados,
  ticket: string,
  dados: { agora: Date; segredo: string },
): Promise<DadosDaSessao | null> {
  const ticketHash = hashDoTicket(ticket, dados.segredo);

  const [linha] = await bd
    .select({
      usuarioId: sessao.usuarioId,
      perfil: sessao.perfil,
      habilitacoes: sessao.habilitacoes,
      ultimoUsoEm: sessao.ultimoUsoEm,
      expiraEm: sessao.expiraEm,
      contaId: usuario.contaId,
      nome: usuario.nome,
      situacao: usuario.situacao,
      email: contaAcesso.email,
      senhaTrocaObrigatoria: contaAcesso.senhaTrocaObrigatoria,
    })
    .from(sessao)
    .innerJoin(usuario, eq(usuario.id, sessao.usuarioId))
    .innerJoin(contaAcesso, eq(contaAcesso.id, usuario.contaId))
    .where(eq(sessao.ticketHash, ticketHash))
    .limit(1);

  if (!linha) return null;

  const instante = dados.agora.getTime();
  const venceuAbsoluta = linha.expiraEm.getTime() <= instante;
  const venceuPorInatividade = instante - linha.ultimoUsoEm.getTime() >= inatividadeMaximaEmMs;
  if (venceuAbsoluta || venceuPorInatividade || linha.situacao !== 'ativo') {
    await bd.delete(sessao).where(eq(sessao.ticketHash, ticketHash));
    return null;
  }

  if (instante - linha.ultimoUsoEm.getTime() >= intervaloDeAtualizacaoEmMs) {
    await bd
      .update(sessao)
      .set({ ultimoUsoEm: dados.agora })
      .where(eq(sessao.ticketHash, ticketHash));
  }

  return {
    ticketHash,
    usuarioId: linha.usuarioId,
    contaId: linha.contaId,
    nome: linha.nome,
    email: linha.email,
    perfil: linha.perfil,
    habilitacoes: linha.habilitacoes,
    senhaTrocaObrigatoria: linha.senhaTrocaObrigatoria,
    expiraEm: linha.expiraEm,
  };
}

export async function encerrarSessao(executor: Executor, ticketHash: string): Promise<void> {
  await executor.delete(sessao).where(eq(sessao.ticketHash, ticketHash));
}

/**
 * Encerra as sessões de um usuário, opcionalmente poupando uma. Deve ser chamada, na mesma
 * transação, sempre que mudar perfil, habilitação, situação ou senha de alguém (RN-ACE-08).
 */
export async function encerrarSessoesDoUsuario(
  executor: Executor,
  usuarioId: number,
  opcoes: { exceto?: string } = {},
): Promise<void> {
  const condicao = opcoes.exceto
    ? and(eq(sessao.usuarioId, usuarioId), ne(sessao.ticketHash, opcoes.exceto))
    : eq(sessao.usuarioId, usuarioId);
  await executor.delete(sessao).where(condicao);
}
