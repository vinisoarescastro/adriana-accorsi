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

  'painel.equipe': {
    descricao: 'Ver a carga de trabalho e a composição da equipe no painel',
    nivelMinimo: 4,
    perfisAdicionais: ['parlamentar'],
  },

  // Atendimento (habilitação AT). Painel, pessoas e demandas: ver docs/especificacao/03.
  'painel.atendimento': {
    descricao: 'Ver o bloco de atendimento do painel',
    nivelMinimo: 1,
    habilitacao: ['AT'],
  },
  'pessoas.consultar': {
    descricao: 'Consultar e buscar pessoas',
    nivelMinimo: 1,
    habilitacao: ['AT'],
  },
  'pessoas.manter': {
    descricao: 'Cadastrar e alterar pessoas',
    nivelMinimo: 2,
    habilitacao: ['AT'],
  },
  'pessoas.inativar': {
    descricao: 'Inativar e reativar pessoas',
    nivelMinimo: 3,
    habilitacao: ['AT'],
  },
  'pessoas.eliminar_dados': {
    descricao: 'Eliminar os dados pessoais de uma pessoa',
    nivelMinimo: 5,
    habilitacao: ['AT'],
  },
  'demandas.registrar': { descricao: 'Registrar demanda', nivelMinimo: 1, habilitacao: ['AT'] },
  'demandas.consultar': {
    descricao: 'Listar e consultar demandas (o Assessor Externo vê só as suas)',
    nivelMinimo: 1,
    habilitacao: ['AT'],
  },
  'demandas.ficha': { descricao: 'Ficha completa da demanda', nivelMinimo: 2, habilitacao: ['AT'] },
  'demandas.alterar': {
    descricao:
      'Editar e mover demanda (Supervisor ou superior, ou o responsável: regra do serviço)',
    nivelMinimo: 1,
    habilitacao: ['AT'],
  },
  'demandas.reatribuir': { descricao: 'Reatribuir demanda', nivelMinimo: 3, habilitacao: ['AT'] },
  'demandas.cancelar': { descricao: 'Cancelar demanda', nivelMinimo: 3, habilitacao: ['AT'] },
  'comentarios.criar': { descricao: 'Comentar internamente', nivelMinimo: 2, habilitacao: ['AT'] },
  'comentarios.remover': {
    descricao: 'Remover comentário (o próprio; o de terceiro exige Supervisor: regra do serviço)',
    nivelMinimo: 2,
    habilitacao: ['AT'],
  },
  'documentos.anexar': { descricao: 'Anexar documento', nivelMinimo: 2, habilitacao: ['AT'] },
  'documentos.baixar': { descricao: 'Baixar documento', nivelMinimo: 2, habilitacao: ['AT'] },
  'documentos.remover': { descricao: 'Remover documento', nivelMinimo: 3, habilitacao: ['AT'] },

  // Cidadão (fase 3): política, link, andamentos, consentimento e fila de e-mails.
  'publicacao.consultar_politica': {
    descricao: 'Consultar a política de publicação e o histórico de versões',
    nivelMinimo: 2,
    habilitacao: ['AT'],
  },
  'publicacao.alterar_politica': {
    descricao: 'Alterar a política de publicação (fecha a versão vigente e abre a seguinte)',
    nivelMinimo: 5,
    habilitacao: ['AT'],
  },
  'link.obter': {
    descricao: 'Obter o link de acompanhamento e pré-visualizar o que o cidadão vê',
    nivelMinimo: 2,
    habilitacao: ['AT'],
  },
  'link.gerir': {
    descricao: 'Revogar, regenerar, suspender e retomar o link de acompanhamento',
    nivelMinimo: 3,
    habilitacao: ['AT'],
  },
  'andamentos.publicar': {
    descricao: 'Publicar andamento para o cidadão',
    nivelMinimo: 2,
    habilitacao: ['AT'],
  },
  'andamentos.remover': {
    descricao: 'Remover andamento publicado',
    nivelMinimo: 3,
    habilitacao: ['AT'],
  },
  'consentimento.registrar': {
    descricao: 'Registrar ou cancelar o consentimento de notificação por e-mail',
    nivelMinimo: 2,
    habilitacao: ['AT'],
  },
  'notificacoes.consultar_fila': {
    descricao: 'Ver a fila de e-mails ao cidadão (enviado, falhou, cancelado)',
    nivelMinimo: 3,
    habilitacao: ['AT'],
  },

  // Trabalho da equipe (fase 4). Tarefas e avisos não têm habilitação: herdam o alcance do registro
  // a que se ligam ou exigem só o nível. Agenda é AG; eventos e presença são AT.
  'painel.tarefas': { descricao: 'Ver o bloco de tarefas do painel', nivelMinimo: 1 },
  'tarefas.consultar': {
    descricao: 'Listar e consultar tarefas (o Assessor Externo vê só as suas)',
    nivelMinimo: 1,
  },
  'tarefas.criar': {
    descricao: 'Criar tarefa (o Assessor Externo só para si: regra do serviço)',
    nivelMinimo: 1,
  },
  'tarefas.alterar': {
    descricao:
      'Editar, mover e cancelar tarefa (Supervisor ou superior, ou o responsável; reabrir só Supervisor: regra do serviço)',
    nivelMinimo: 1,
  },
  'tarefas.reatribuir': {
    descricao: 'Designar ou reatribuir a tarefa a outra pessoa',
    nivelMinimo: 2,
  },
  'avisos.consultar': { descricao: 'Ver os próprios avisos (o sino)', nivelMinimo: 1 },
  'avisos.marcar_lido': { descricao: 'Marcar os próprios avisos como lidos', nivelMinimo: 1 },
  'avisos.configurar': {
    descricao: 'Configurar a antecedência do aviso de prazo',
    nivelMinimo: 4,
  },
  'agenda.consultar': {
    descricao: 'Consultar a agenda por período (o conteúdo depende da visibilidade)',
    nivelMinimo: 1,
    habilitacao: ['AG'],
  },
  'agenda.responder': {
    descricao: 'Responder a indicação como participante interno (a resposta é só informativa)',
    nivelMinimo: 1,
    habilitacao: ['AG'],
  },
  'agenda.marcar': {
    descricao: 'Marcar, remarcar e cancelar compromisso; criar e cancelar bloqueio',
    nivelMinimo: 2,
    habilitacao: ['AG'],
  },
  'agenda.criar_restrito': {
    descricao: 'Criar ou tornar Restrito um compromisso',
    nivelMinimo: 3,
    habilitacao: ['AG'],
  },
  'eventos.consultar': {
    descricao: 'Acompanhar eventos e a contagem de presença',
    nivelMinimo: 1,
    habilitacao: ['AT'],
  },
  'presenca.registrar': {
    descricao: 'Registrar presença (e corrigir a própria em até 30 minutos)',
    nivelMinimo: 1,
    habilitacao: ['AT'],
  },
  'eventos.organizar': {
    descricao: 'Cadastrar e alterar eventos; corrigir presença depois dos 30 minutos',
    nivelMinimo: 2,
    habilitacao: ['AT'],
  },
  'eventos.lista_nominal': {
    descricao: 'Ver a lista nominal de presença',
    nivelMinimo: 2,
    habilitacao: ['AT'],
  },
  'eventos.encerrar': { descricao: 'Encerrar evento', nivelMinimo: 3, habilitacao: ['AT'] },
  'presenca.remover': {
    descricao: 'Remover presença, com justificativa',
    nivelMinimo: 3,
    habilitacao: ['AT'],
  },

  // Legislativo (fase 5, habilitação LG). Beneficiários também aceitam FI (usados pelas emendas).
  'projetos.consultar': {
    descricao: 'Listar e consultar projetos de lei (quadro, consolidado e atrasados)',
    nivelMinimo: 2,
    habilitacao: ['LG'],
  },
  'projetos.registrar': {
    descricao: 'Cadastrar projeto de lei',
    nivelMinimo: 2,
    habilitacao: ['LG'],
  },
  'projetos.alterar': {
    descricao:
      'Editar, mover e acompanhar o projeto (assuntos, coautores, comissões e votações). Supervisor ou superior, ou o responsável: regra do serviço',
    nivelMinimo: 2,
    habilitacao: ['LG'],
  },
  'projetos.supervisionar': {
    descricao: 'Reatribuir e cancelar projeto de lei',
    nivelMinimo: 3,
    habilitacao: ['LG'],
  },
  'projetos.vocabularios': {
    descricao: 'Manter os vocabulários do legislativo (tipos de proposição e assuntos)',
    nivelMinimo: 3,
    habilitacao: ['LG'],
  },
  'beneficiarios.consultar': {
    descricao: 'Consultar e buscar beneficiários',
    nivelMinimo: 2,
    habilitacao: ['LG', 'FI'],
  },
  'beneficiarios.manter': {
    descricao: 'Cadastrar e alterar beneficiários',
    nivelMinimo: 2,
    habilitacao: ['LG', 'FI'],
  },
  'beneficiarios.inativar': {
    descricao: 'Inativar e reativar beneficiários',
    nivelMinimo: 3,
    habilitacao: ['LG', 'FI'],
  },

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
