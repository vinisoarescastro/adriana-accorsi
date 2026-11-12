import type { Area, Perfil } from '@gabinete/compartilhado';
import { operacoes, type DefinicaoDeOperacao, type NomeDeOperacao } from './operacoes.js';

/** Nível efetivo de cada perfil. O Parlamentar conta como Supervisor (3). */
export const nivelDoPerfil: Readonly<Record<Perfil, number>> = {
  administrador: 5,
  chefe: 4,
  supervisor: 3,
  assessor_interno: 2,
  assessor_externo: 1,
  parlamentar: 3,
};

export interface Autoridade {
  readonly perfil: Perfil;
  readonly habilitacoes: readonly Area[];
}

export type MotivoDaRecusa = 'perfil_excluido' | 'nivel_insuficiente' | 'sem_habilitacao';

export type Decisao =
  { readonly permitido: true } | { readonly permitido: false; readonly motivo: MotivoDaRecusa };

/**
 * A decisão de autorização por perfil e habilitação. É o ÚNICO lugar onde ela acontece:
 * rotas e navegação chamam este decisor. A primeira falha encerra.
 *
 * A autoridade efetiva é a interseção de nível e habilitação (RN-P05): um sem o outro
 * não autoriza. A verificação do registro-pai e do alcance (passo final) é feita pelo
 * serviço do módulo, com `composicaoDeAlcance`.
 */
export function decidir(operacao: NomeDeOperacao, autoridade: Autoridade): Decisao {
  return decidirPelaDefinicao(operacoes[operacao], autoridade);
}

/** O mesmo cálculo, sobre uma definição qualquer (útil para testar regras de habilitação). */
export function decidirPelaDefinicao(
  definicao: DefinicaoDeOperacao,
  autoridade: Autoridade,
): Decisao {
  if (definicao.perfisExcluidos?.includes(autoridade.perfil)) {
    return { permitido: false, motivo: 'perfil_excluido' };
  }

  const alcancaPeloNivel =
    nivelDoPerfil[autoridade.perfil] >= definicao.nivelMinimo ||
    (definicao.perfisAdicionais?.includes(autoridade.perfil) ?? false);
  if (!alcancaPeloNivel) return { permitido: false, motivo: 'nivel_insuficiente' };

  if (definicao.habilitacao && definicao.habilitacao.length > 0) {
    const possui = definicao.habilitacao.some((area) => autoridade.habilitacoes.includes(area));
    if (!possui) return { permitido: false, motivo: 'sem_habilitacao' };
  }

  return { permitido: true };
}

export function pode(operacao: NomeDeOperacao, autoridade: Autoridade): boolean {
  return decidir(operacao, autoridade).permitido;
}
