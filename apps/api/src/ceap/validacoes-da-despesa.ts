import { nivelDoPerfil } from '@gabinete/autorizacao';
import type { despesa } from '@gabinete/banco';
import {
  ceapCategoria,
  ceapEncerramento,
  habilitacao,
  usuario,
  type Leitor,
} from '@gabinete/banco';
import { perfisComTodasAsHabilitacoes } from '@gabinete/compartilhado';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { hojeNoGabinete } from '../atendimento/comum.js';
import type { Ator } from '../equipe/regras.js';
import { erros } from '../erros.js';

/** Quem responde pela despesa: ativo, de nível Assessor Interno ou acima e com a habilitação Financeiro. */
export async function exigirResponsavelFinanceiro(tx: Leitor, usuarioId: number): Promise<void> {
  const [alvo] = await tx
    .select({ perfil: usuario.perfil, situacao: usuario.situacao })
    .from(usuario)
    .where(eq(usuario.id, usuarioId))
    .limit(1);
  if (!alvo || alvo.situacao !== 'ativo')
    throw erros.conflito('O responsável precisa ser um usuário ativo da equipe.');
  if (nivelDoPerfil[alvo.perfil] < 2)
    throw erros.conflito('O responsável precisa ser Assessor Interno ou de nível superior.');
  if (perfisComTodasAsHabilitacoes.includes(alvo.perfil)) return;
  const [fi] = await tx
    .select({ area: habilitacao.area })
    .from(habilitacao)
    .where(and(eq(habilitacao.usuarioId, usuarioId), eq(habilitacao.area, 'FI')))
    .limit(1);
  if (!fi) throw erros.conflito('O responsável precisa ter a habilitação Financeiro.');
}

export async function exigirCategoriaAtiva(tx: Leitor, categoriaId: number) {
  const [c] = await tx
    .select()
    .from(ceapCategoria)
    .where(eq(ceapCategoria.id, categoriaId))
    .limit(1);
  if (!c || c.situacao !== 'ativa') throw erros.conflito('Categoria inválida ou inativa.');
  return c;
}

export async function exigirCompetenciaAberta(tx: Leitor, dataDocumento: string): Promise<void> {
  const ano = Number(dataDocumento.slice(0, 4));
  const mes = Number(dataDocumento.slice(5, 7));
  const [e] = await tx
    .select()
    .from(ceapEncerramento)
    .where(
      and(
        eq(ceapEncerramento.ano, ano),
        eq(ceapEncerramento.mes, mes),
        isNull(ceapEncerramento.reabertaEm),
      ),
    )
    .limit(1);
  if (e)
    throw erros.conflito(`A competência ${String(mes).padStart(2, '0')}/${ano} está encerrada.`);
}

/** Os usuários que podem decidir despesa (Supervisor em diante com Financeiro, e a Parlamentar). */
export async function quemPodeDecidir(tx: Leitor): Promise<number[]> {
  const ativos = await tx
    .select({ id: usuario.id, perfil: usuario.perfil })
    .from(usuario)
    .where(
      and(
        eq(usuario.situacao, 'ativo'),
        inArray(usuario.perfil, ['administrador', 'parlamentar', 'chefe', 'supervisor']),
      ),
    );
  const comFi = new Set(
    (
      await tx
        .select({ id: habilitacao.usuarioId })
        .from(habilitacao)
        .where(eq(habilitacao.area, 'FI'))
    ).map((h) => h.id),
  );
  return ativos
    .filter((u) => perfisComTodasAsHabilitacoes.includes(u.perfil) || comFi.has(u.id))
    .map((u) => u.id);
}

export type DespesaCarregada = typeof despesa.$inferSelect;

export function exigirDataValida(dataDocumento: string, agora: Date): void {
  if (dataDocumento > hojeNoGabinete(agora)) {
    throw erros.conflito('A data do documento não pode ser futura.');
  }
  if (Number.isNaN(new Date(`${dataDocumento}T12:00:00Z`).getTime()))
    throw erros.requisicaoInvalida();
}

/** Quem pode mexer enquanto a despesa é rascunho: quem lançou, o responsável, ou o Supervisor em diante. */
export function exigirPodeMexer(ator: Ator, d: DespesaCarregada): void {
  if (
    nivelDoPerfil[ator.perfil] >= 3 ||
    d.lancadoPor === ator.usuarioId ||
    d.responsavelId === ator.usuarioId
  )
    return;
  throw erros.semPermissao(
    'Só quem lançou, o responsável, o Supervisor ou superior mexem nesta despesa.',
  );
}
