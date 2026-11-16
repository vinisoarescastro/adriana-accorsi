import type {
  Area,
  EstadoDeEnvioDto,
  EstadoDoLink,
  EventoDeNotificacaoDto,
  NaturezaDeDocumento,
  OrigemDeConsentimentoDto,
  PapelDeEtapaDto,
  Perfil,
  Prioridade,
  RespostaDeParticipanteDto,
  StatusDeDemanda,
  TipoDeProcessoDto,
  TipoDeVinculoDeTarefaDto,
  VisibilidadeDeCompromissoDto,
} from '@gabinete/compartilhado';

/** Textos da interface para os valores técnicos. */
export const rotuloDoPerfil: Record<Perfil, string> = {
  parlamentar: 'Parlamentar',
  administrador: 'Administrador',
  chefe: 'Chefe de Gabinete',
  supervisor: 'Supervisor',
  assessor_interno: 'Assessor Interno',
  assessor_externo: 'Assessor Externo',
};

export const rotuloDaArea: Record<Area, string> = {
  AT: 'Atendimento',
  AG: 'Agenda',
  LG: 'Legislativo',
  FI: 'Financeiro',
};

export const rotuloDoPapel: Record<PapelDeEtapaDto, string> = {
  entrada: 'Entrada',
  intermediaria: 'Intermediária',
  conclusao: 'Conclusão',
  arquivamento: 'Arquivamento',
};

export const rotuloDoFluxo: Record<TipoDeProcessoDto, string> = {
  demanda: 'Demanda',
  tarefa: 'Tarefa',
  projeto_lei: 'Projeto de Lei',
  emenda: 'Emenda',
  despesa_ceap: 'Despesa da CEAP',
};

export const rotuloDaPrioridade: Record<Prioridade, string> = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
  urgente: 'Urgente',
};

export const rotuloDoStatus: Record<StatusDeDemanda, string> = {
  em_andamento: 'Em andamento',
  concluido: 'Concluída',
  arquivado: 'Arquivada',
  cancelada: 'Cancelada',
};

export const rotuloDaNatureza: Record<NaturezaDeDocumento, string> = {
  comprovante: 'Comprovante',
  nota_fiscal: 'Nota fiscal',
  minuta: 'Minuta',
  justificativa: 'Justificativa',
  parecer: 'Parecer',
  oficio: 'Ofício',
  plano_de_trabalho: 'Plano de trabalho',
  foto: 'Foto',
  lista_assinada: 'Lista assinada',
  outro: 'Outro',
};

export const rotuloDoEstadoDoLink: Record<EstadoDoLink, string> = {
  ativa: 'Link ativo',
  suspensa: 'Link suspenso',
  revogada: 'Link revogado',
};

export const rotuloDoEventoDeEmail: Record<EventoDeNotificacaoDto, string> = {
  andamento_publicado: 'Andamento publicado',
  etapa_visivel: 'Mudança de situação',
  conclusao: 'Conclusão',
  cancelamento: 'Cancelamento',
};

export const rotuloDoEstadoDeEnvio: Record<EstadoDeEnvioDto, string> = {
  pendente: 'Na fila',
  enviando: 'Enviando',
  enviado: 'Enviado',
  falhou: 'Falhou',
  cancelado: 'Cancelado',
};

export const rotuloDaOrigemDoConsentimento: Record<OrigemDeConsentimentoDto, string> = {
  atendimento_telefonico: 'Atendimento por telefone',
  atendimento_presencial: 'Atendimento presencial',
  pedido_ao_gabinete: 'Pedido feito ao gabinete',
  descadastro_cidadao: 'Descadastro pelo próprio cidadão',
  dados_eliminados: 'Dados pessoais eliminados',
};

export const rotuloDaExibicaoDeNome: Record<'completo' | 'primeiro_nome' | 'nao_exibir', string> = {
  completo: 'Nome completo',
  primeiro_nome: 'Só o primeiro nome',
  nao_exibir: 'Não exibir',
};

export const rotuloDaExibicaoDeTelefone: Record<'completo' | 'mascarado' | 'nao_exibir', string> = {
  completo: 'Telefone completo',
  mascarado: 'Telefone parcialmente oculto',
  nao_exibir: 'Não exibir',
};

export const rotuloDaVisibilidade: Record<VisibilidadeDeCompromissoDto, string> = {
  aberto: 'Aberto (todos veem o compromisso)',
  participantes: 'Participantes (os demais veem só o horário ocupado)',
  restrito: 'Restrito (some para quem não participa)',
};

/** A mesma visibilidade em uma frase curta, para o resumo do compromisso. */
export const rotuloCurtoDaVisibilidade: Record<VisibilidadeDeCompromissoDto, string> = {
  aberto: 'Todos veem os detalhes',
  participantes: 'Os demais veem só o horário ocupado',
  restrito: 'Só os participantes veem',
};

export const rotuloDaResposta: Record<RespostaDeParticipanteDto, string> = {
  sem_resposta: 'Sem resposta',
  confirmado: 'Confirmado',
  recusado: 'Recusado',
};

/** O vínculo de uma tarefa, em uma frase curta para a lista e o quadro. */
export const rotuloDoVinculo: Record<TipoDeVinculoDeTarefaDto, string> = {
  demanda: 'Vinculada a uma demanda',
  pessoa: 'Vinculada a uma pessoa',
  compromisso: 'Vinculada a um compromisso',
  evento: 'Vinculada a um evento',
};
