import type {
  Area,
  NaturezaDeDocumento,
  PapelDeEtapaDto,
  Perfil,
  Prioridade,
  StatusDeDemanda,
  TipoDeProcessoDto,
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
