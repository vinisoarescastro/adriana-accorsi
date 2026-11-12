import type { Area, Perfil } from '@gabinete/compartilhado';

/**
 * Definição ÚNICA das operações (ADR 0003). Rotas, navegação, testes e documentação
 * (docs/especificacao/03-perfis-e-permissoes.md) partem daqui. Cada fase acrescenta as suas.
 *
 * Nível mínimo: 1 Assessor Externo, 2 Assessor Interno, 3 Supervisor, 4 Chefe, 5 Administrador.
 * O Parlamentar fica fora da escala: conta como nível 3 e se expressa por perfis adicionais
 * e excluídos (ver 3.4.1 da especificação).
 */
export interface DefinicaoDeOperacao {
  readonly descricao: string;
  readonly nivelMinimo: 1 | 2 | 3 | 4 | 5;
  /** O usuário precisa ter ao menos UMA destas habilitações (por exemplo, LG ou FI). */
  readonly habilitacao?: readonly Area[];
  /** Perfis que alcançam a operação mesmo abaixo do nível mínimo. */
  readonly perfisAdicionais?: readonly Perfil[];
  /** Perfis que NÃO alcançam, mesmo com nível suficiente. */
  readonly perfisExcluidos?: readonly Perfil[];
}

export const operacoes = {
  // Sessão e perfil próprio
  'sessao.consultar': { descricao: 'Consultar a própria sessão', nivelMinimo: 1 },
  'sessao.sair': { descricao: 'Sair do sistema', nivelMinimo: 1 },
  'sessao.trocar_senha': { descricao: 'Trocar a própria senha', nivelMinimo: 1 },
  'perfil.alterar_foto': { descricao: 'Alterar a própria foto', nivelMinimo: 1 },

  // Painel (blocos entram a partir da fase 2)
  'painel.abrir': { descricao: 'Abrir o painel', nivelMinimo: 1 },

  // Equipe
  'equipe.ver': { descricao: 'Ver a equipe', nivelMinimo: 1 },
  'equipe.administrar': {
    descricao: 'Criar e alterar usuários, perfis, situação, habilitações e senhas',
    nivelMinimo: 4,
  },
  'equipe.historico': {
    descricao: 'Ver o histórico de um usuário',
    nivelMinimo: 4,
    perfisAdicionais: ['parlamentar'],
  },

  // Fluxos
  'fluxos.consultar': { descricao: 'Consultar os fluxos', nivelMinimo: 1 },
  'fluxos.ajustar': {
    descricao: 'Ajustar etapas (rótulo, visibilidade, prazo, ordem)',
    nivelMinimo: 3,
    perfisExcluidos: ['parlamentar'],
  },
  'fluxos.estruturar': {
    descricao: 'Estruturar fluxos (criar e desativar etapas)',
    nivelMinimo: 5,
  },

  // Identidade do gabinete
  'gabinete.consultar': { descricao: 'Consultar a identidade do gabinete', nivelMinimo: 1 },
  'gabinete.editar': { descricao: 'Editar a identidade e a foto do gabinete', nivelMinimo: 4 },

  // Auditoria
  'auditoria.consultar_gabinete': {
    descricao: 'Consultar a trilha de auditoria do gabinete',
    nivelMinimo: 4,
    perfisAdicionais: ['parlamentar'],
  },
  'auditoria.historico_registro': {
    descricao: 'Consultar o histórico de um registro',
    nivelMinimo: 2,
  },
} as const satisfies Record<string, DefinicaoDeOperacao>;

export type NomeDeOperacao = keyof typeof operacoes;

export const nomesDeOperacoes = Object.keys(operacoes) as NomeDeOperacao[];

export function ehOperacaoConhecida(nome: string): nome is NomeDeOperacao {
  return Object.hasOwn(operacoes, nome);
}
