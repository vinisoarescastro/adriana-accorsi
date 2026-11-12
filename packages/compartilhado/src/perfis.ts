/** Perfis de usuário (ver docs/especificacao/03-perfis-e-permissoes.md). */
export const perfis = [
  'parlamentar',
  'administrador',
  'chefe',
  'supervisor',
  'assessor_interno',
  'assessor_externo',
] as const;

export type Perfil = (typeof perfis)[number];

/** Habilitações por módulo: Atendimento, Agenda, Legislativo, Financeiro. */
export const areas = ['AT', 'AG', 'LG', 'FI'] as const;

export type Area = (typeof areas)[number];

export const situacoesDeUsuario = ['ativo', 'inativo'] as const;

export type SituacaoDeUsuario = (typeof situacoesDeUsuario)[number];

/** Perfis que, por regra, têm todas as habilitações e não podem perdê-las. */
export const perfisComTodasAsHabilitacoes: readonly Perfil[] = ['parlamentar', 'administrador'];
