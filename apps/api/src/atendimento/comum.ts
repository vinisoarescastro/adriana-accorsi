import { demanda, habilitacao, usuario, type BancoDeDados, type Transacao } from '@gabinete/banco';
import { composicaoDeAlcance } from '@gabinete/autorizacao';
import { perfisComTodasAsHabilitacoes } from '@gabinete/compartilhado';
import { and, eq } from 'drizzle-orm';
import type { Ator } from '../equipe/regras.js';
import { erros } from '../erros.js';

export type Leitor = Pick<BancoDeDados, 'select'> | Pick<Transacao, 'select'>;

const fusoDoGabinete = 'America/Sao_Paulo';

/** A data de hoje (AAAA-MM-DD) no fuso do gabinete, não no do servidor. */
export function hojeNoGabinete(agora: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: fusoDoGabinete,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(agora);
}

/** Primeiro instante do mês corrente no fuso do gabinete (UTC-3, sem horário de verão desde 2019). */
export function inicioDoMesNoGabinete(agora: Date): Date {
  const [ano, mes] = hojeNoGabinete(agora).split('-');
  return new Date(`${ano}-${mes}-01T00:00:00-03:00`);
}

/** Escapa `%`, `_` e `\` para usar a busca do usuário dentro de um ILIKE. */
export function padraoDeBusca(texto: string): string {
  return `%${texto.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

export function paginar(pagina: number, porPagina: number) {
  return { limite: porPagina, deslocamento: (pagina - 1) * porPagina };
}

/**
 * O usuário pode ser responsável por uma demanda? Precisa estar ativo e ter a habilitação AT
 * (Administrador e Parlamentar têm todas).
 */
export async function exigirResponsavelValido(leitor: Leitor, usuarioId: number): Promise<void> {
  const [alvo] = await leitor
    .select({ id: usuario.id, perfil: usuario.perfil, situacao: usuario.situacao })
    .from(usuario)
    .where(eq(usuario.id, usuarioId))
    .limit(1);
  if (!alvo || alvo.situacao !== 'ativo') {
    throw erros.conflito('O responsável precisa ser um usuário ativo da equipe.');
  }
  if (perfisComTodasAsHabilitacoes.includes(alvo.perfil)) return;
  const [atendimento] = await leitor
    .select({ area: habilitacao.area })
    .from(habilitacao)
    .where(and(eq(habilitacao.usuarioId, usuarioId), eq(habilitacao.area, 'AT')))
    .limit(1);
  if (!atendimento) {
    throw erros.conflito('O responsável precisa ter a habilitação de Atendimento.');
  }
}

/**
 * A demanda, se o ator a alcança. O Assessor Externo só alcança as dele; quem não alcança recebe
 * "não encontrado", igual a uma demanda inexistente (V-07, V-10).
 */
export async function carregarDemandaAlcancavel(
  leitor: Leitor,
  ator: Ator,
  id: number,
  opcoes: { paraAtualizar?: boolean } = {},
) {
  const consulta = leitor.select().from(demanda).where(eq(demanda.id, id)).limit(1);
  const [linha] = await (opcoes.paraAtualizar ? consulta.for('update') : consulta);
  if (!linha) throw erros.naoEncontrado();
  if (composicaoDeAlcance(ator.perfil) === 'proprio' && linha.responsavelId !== ator.usuarioId) {
    throw erros.naoEncontrado();
  }
  return linha;
}
