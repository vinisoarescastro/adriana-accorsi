import { z } from 'zod';
import {
  areas,
  perfis,
  situacoesDeUsuario,
  type Area,
  type Perfil,
  type SituacaoDeUsuario,
} from './perfis.js';

/** Contratos da equipe e da identidade do gabinete. */

const nome = z.string().trim().min(1).max(120);
const contato = z.string().trim().max(200);

export const esquemaNovoUsuario = z.object({
  nome,
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  perfil: z.enum(perfis),
  habilitacoes: z.array(z.enum(areas)).max(areas.length).default([]),
  contato: contato.optional(),
});
export type CorpoNovoUsuario = z.infer<typeof esquemaNovoUsuario>;

export const esquemaAtualizarUsuario = z
  .object({ nome: nome.optional(), contato: contato.nullable().optional() })
  .refine((v) => v.nome !== undefined || v.contato !== undefined, 'Informe ao menos um campo.');
export type CorpoAtualizarUsuario = z.infer<typeof esquemaAtualizarUsuario>;

export const esquemaAlterarPerfil = z.object({ perfil: z.enum(perfis) });
export const esquemaAlterarSituacao = z.object({ situacao: z.enum(situacoesDeUsuario) });
export const esquemaAlterarHabilitacoes = z.object({
  habilitacoes: z.array(z.enum(areas)).max(areas.length),
});

export interface UsuarioDaEquipe {
  readonly id: number;
  readonly nome: string;
  readonly email: string;
  readonly contato: string | null;
  readonly perfil: Perfil;
  readonly situacao: SituacaoDeUsuario;
  readonly habilitacoes: readonly Area[];
  readonly temFoto: boolean;
  readonly criadoEm: string;
}

/** Resposta de criação e de redefinição de senha: a senha inicial aparece UMA única vez. */
export interface UsuarioComSenhaInicial extends UsuarioDaEquipe {
  readonly senhaInicial: string;
  readonly senhaInicialValidaAte: string;
}

export const esquemaGabinete = z.object({
  nome,
  parlamentarNome: nome,
  cargo: nome,
  partido: z.string().trim().max(60).nullable().optional(),
  mandato: z.string().trim().max(60).nullable().optional(),
  contatoTelefone: z.string().trim().max(40).nullable().optional(),
  contatoEmail: z.string().trim().max(254).nullable().optional(),
  contatoEndereco: z.string().trim().max(300).nullable().optional(),
});
export type CorpoGabinete = z.infer<typeof esquemaGabinete>;

export interface IdentidadeDoGabinete {
  readonly nome: string;
  readonly parlamentarNome: string;
  readonly cargo: string;
  readonly partido: string | null;
  readonly mandato: string | null;
  readonly contatoTelefone: string | null;
  readonly contatoEmail: string | null;
  readonly contatoEndereco: string | null;
  readonly temFoto: boolean;
  readonly fuso: string;
}

export interface EntradaDaTrilhaVisivel {
  readonly id: number;
  readonly ocorridaEm: string;
  readonly autorId: number | null;
  readonly autorNome: string | null;
  readonly origem: string;
  readonly operacao: string;
  readonly entidade: string;
  readonly registroId: string | null;
  readonly valorAnterior: unknown;
  readonly valorNovo: unknown;
  readonly justificativa: string | null;
}

export interface PaginaDaTrilha {
  readonly itens: readonly EntradaDaTrilhaVisivel[];
  readonly total: number;
  readonly pagina: number;
  readonly porPagina: number;
}
