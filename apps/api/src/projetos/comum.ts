import { nivelDoPerfil } from '@gabinete/autorizacao';
import {
  categoria,
  habilitacao,
  projetoLei,
  usuario,
  type Leitor,
  type NaturezaDeCategoria,
  type Transacao,
} from '@gabinete/banco';
import { perfisComTodasAsHabilitacoes } from '@gabinete/compartilhado';
import { and, eq, inArray } from 'drizzle-orm';
import type { Ator } from '../equipe/regras.js';
import { erros } from '../erros.js';

export type ProjetoCarregado = typeof projetoLei.$inferSelect;

/** Carrega o projeto travando a linha. Inexistente responde "não encontrado". */
export async function carregarProjeto(tx: Transacao, id: number): Promise<ProjetoCarregado> {
  const [linha] = await tx
    .select()
    .from(projetoLei)
    .where(eq(projetoLei.id, id))
    .limit(1)
    .for('update');
  if (!linha) throw erros.naoEncontrado();
  return linha;
}

/** Quem pode editar, mover e acompanhar: Supervisor ou superior, ou o responsável (RN-PRO-03). */
export function exigirPodeAlterar(ator: Ator, projeto: Pick<ProjetoCarregado, 'responsavelId'>) {
  if (nivelDoPerfil[ator.perfil] >= 3 || projeto.responsavelId === ator.usuarioId) return;
  throw erros.semPermissao('Só o responsável, o Supervisor ou superior alteram este projeto.');
}

export function exigirNaoCancelado(projeto: Pick<ProjetoCarregado, 'canceladoEm'>): void {
  if (projeto.canceladoEm) throw erros.conflito('Projeto cancelado não se altera.');
}

/**
 * Quem responde pelo projeto: usuário ativo, de nível Assessor Interno ou acima e com a habilitação
 * Legislativo (Administrador e Parlamentar têm todas).
 */
export async function exigirResponsavelDoLegislativo(
  leitor: Leitor,
  usuarioId: number,
): Promise<void> {
  const [alvo] = await leitor
    .select({ perfil: usuario.perfil, situacao: usuario.situacao })
    .from(usuario)
    .where(eq(usuario.id, usuarioId))
    .limit(1);
  if (!alvo || alvo.situacao !== 'ativo') {
    throw erros.conflito('O responsável precisa ser um usuário ativo da equipe.');
  }
  if (nivelDoPerfil[alvo.perfil] < 2) {
    throw erros.conflito('O responsável precisa ser Assessor Interno ou de nível superior.');
  }
  if (perfisComTodasAsHabilitacoes.includes(alvo.perfil)) return;
  const [lg] = await leitor
    .select({ area: habilitacao.area })
    .from(habilitacao)
    .where(and(eq(habilitacao.usuarioId, usuarioId), eq(habilitacao.area, 'LG')))
    .limit(1);
  if (!lg) throw erros.conflito('O responsável precisa ter a habilitação Legislativo.');
}

/** As categorias existem, são da natureza esperada e estão ativas. Devolve os ids sem repetição. */
export async function exigirCategorias(
  leitor: Leitor,
  natureza: NaturezaDeCategoria,
  ids: readonly number[],
  mensagem: string,
): Promise<number[]> {
  const unicos = [...new Set(ids)];
  if (unicos.length === 0) return unicos;
  const validas = await leitor
    .select({ id: categoria.id })
    .from(categoria)
    .where(
      and(
        inArray(categoria.id, unicos),
        eq(categoria.natureza, natureza),
        eq(categoria.situacao, 'ativa'),
      ),
    );
  if (validas.length !== unicos.length) throw erros.conflito(mensagem);
  return unicos;
}

/** Nomes sem repetição (sem diferenciar maiúsculas), na ordem em que vieram. */
export function nomesUnicos(nomes: readonly string[]): string[] {
  const vistos = new Set<string>();
  const saida: string[] = [];
  for (const nome of nomes) {
    const chave = nome.trim().toLocaleLowerCase('pt-BR');
    if (chave && !vistos.has(chave)) {
      vistos.add(chave);
      saida.push(nome.trim());
    }
  }
  return saida;
}
