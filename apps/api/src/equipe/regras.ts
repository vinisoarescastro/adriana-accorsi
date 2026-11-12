import { podeAtribuirPerfil, podeGerir } from '@gabinete/autorizacao';
import {
  areas,
  perfisComTodasAsHabilitacoes,
  type Area,
  type Perfil,
} from '@gabinete/compartilhado';
import { erros } from '../erros.js';

export interface Ator {
  readonly usuarioId: number;
  readonly perfil: Perfil;
  readonly habilitacoes: readonly Area[];
}

export function exigirPodeAtribuir(ator: Ator, perfil: Perfil): void {
  if (!podeAtribuirPerfil(ator.perfil, perfil)) {
    throw erros.semPermissao('Você não pode conceder esse perfil.');
  }
}

export function exigirPodeGerir(ator: Ator, perfilDoAlvo: Perfil): void {
  if (!podeGerir(ator.perfil, perfilDoAlvo)) {
    throw erros.semPermissao('Você não pode alterar um usuário de perfil superior ao seu.');
  }
}

export function exigirOutroUsuario(ator: Ator, alvoId: number): void {
  if (ator.usuarioId === alvoId) {
    throw erros.semPermissao(
      'Você não pode alterar o seu próprio perfil, situação, habilitações ou senha por esta tela.',
    );
  }
}

/**
 * Habilitações a gravar. Administrador e Parlamentar têm todas, não removíveis. Para os
 * demais, ninguém concede habilitação que não possui (V-13).
 */
export function habilitacoesParaGravar(
  ator: Ator,
  perfilDoAlvo: Perfil,
  pedidas: readonly Area[],
): readonly Area[] {
  if (perfisComTodasAsHabilitacoes.includes(perfilDoAlvo)) return areas;
  const unicas = [...new Set(pedidas)];
  const naoPossui = unicas.filter((area) => !ator.habilitacoes.includes(area));
  if (naoPossui.length > 0) {
    throw erros.semPermissao('Você não pode conceder habilitação que não possui.');
  }
  return unicas;
}
