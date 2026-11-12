import type { Area, PapelDeEtapaDto, Perfil, TipoDeProcessoDto } from '@gabinete/compartilhado';

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
