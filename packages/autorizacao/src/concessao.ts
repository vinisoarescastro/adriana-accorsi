import type { Perfil } from '@gabinete/compartilhado';
import { nivelDoPerfil } from './decisor.js';

/**
 * Regras de concessão (3.5 da especificação, V-13), usadas pela API e pela tela:
 * - só se concede perfil igual ou inferior ao próprio;
 * - o Chefe não concede Administrador;
 * - o perfil Parlamentar só o Administrador concede;
 * - o Parlamentar nunca administra a equipe.
 */
export function podeAtribuirPerfil(ator: Perfil, perfil: Perfil): boolean {
  if (ator === 'parlamentar') return false;
  if (perfil === 'parlamentar') return ator === 'administrador';
  return nivelDoPerfil[ator] >= nivelDoPerfil[perfil];
}

/** Quem pode alterar uma conta existente: a mesma regra, aplicada ao perfil atual dela. */
export const podeGerir = podeAtribuirPerfil;
