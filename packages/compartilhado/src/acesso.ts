import { z } from 'zod';
import type { Area, Perfil } from './perfis.js';

/** Contratos da API de acesso (login, sessão e troca de senha), compartilhados com o front. */

export const esquemaEntrar = z.object({
  email: z.string().trim().min(1).max(254),
  senha: z.string().min(1).max(256),
});
export type CorpoEntrar = z.infer<typeof esquemaEntrar>;

export const esquemaTrocarSenha = z.object({
  senhaAtual: z.string().min(1).max(256),
  novaSenha: z.string().min(1).max(256),
});
export type CorpoTrocarSenha = z.infer<typeof esquemaTrocarSenha>;

export interface UsuarioDaSessao {
  readonly id: number;
  readonly nome: string;
  readonly email: string;
  readonly perfil: Perfil;
  readonly habilitacoes: readonly Area[];
}

export interface RespostaDaSessao {
  readonly usuario: UsuarioDaSessao;
  /** Verdadeiro no primeiro acesso: nenhuma outra tela funciona até a senha ser trocada. */
  readonly senhaTrocaObrigatoria: boolean;
  /** Fim absoluto da sessão (12 horas após a entrada). */
  readonly expiraEm: string;
  /** Páginas que o usuário alcança, decididas pelo mesmo decisor das rotas. */
  readonly paginasAlcancaveis: readonly PaginaAlcancavel[];
}

export interface PaginaAlcancavel {
  readonly id: string;
  readonly caminho: string;
  readonly titulo: string;
  readonly operacao: string;
}

/** Códigos de erro estáveis que o front pode tratar. */
export const codigosDeErro = [
  'requisicao_invalida',
  'credenciais_invalidas',
  'senha_inicial_vencida',
  'nao_autenticado',
  'nao_encontrado',
  'sem_permissao',
  'conflito',
  'arquivo_invalido',
  'troca_de_senha_obrigatoria',
  'senha_atual_incorreta',
  'senha_fraca',
  'origem_nao_permitida',
  'muitas_requisicoes',
  'erro_interno',
] as const;
export type CodigoDeErro = (typeof codigosDeErro)[number];

export interface RespostaDeErro {
  readonly codigo: CodigoDeErro;
  readonly mensagem: string;
  /** Detalhes que o usuário pode corrigir (por exemplo, os problemas da senha). */
  readonly detalhes?: readonly string[];
}
