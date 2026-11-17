/** Dados de exemplo do legislativo para os testes de interface. */

export const etapasDeProjeto = [
  { id: 1, nome: 'Em redação', papel: 'entrada', ordem: 1 },
  { id: 2, nome: 'Protocolado', papel: 'intermediaria', ordem: 2 },
  { id: 9, nome: 'Sancionado', papel: 'conclusao', ordem: 9 },
];

export const categorias = [
  { id: 10, natureza: 'tipo_proposicao', nome: 'Projeto de lei', situacao: 'ativa' },
  { id: 11, natureza: 'tipo_proposicao', nome: 'Requerimento', situacao: 'ativa' },
  { id: 20, natureza: 'assunto_projeto', nome: 'Saúde', situacao: 'ativa' },
  { id: 21, natureza: 'assunto_projeto', nome: 'Educação', situacao: 'ativa' },
];

export const resumoDeProjeto = (extra: object = {}) => ({
  id: 1,
  titulo: 'Programa de poda segura',
  numero: 'PL 100/2026',
  tipoProposicao: { id: 10, nome: 'Projeto de lei' },
  autoria: 'Dep. Adriana Accorsi',
  prazo: '2026-12-01',
  etapa: { id: 1, nome: 'Em redação', papel: 'entrada' },
  status: 'em_andamento',
  atrasado: false,
  responsavel: { id: 1, nome: 'Fulano de Tal' },
  assuntos: [{ id: 20, nome: 'Saúde' }],
  criadoEm: '2026-11-12T15:00:00.000Z',
  ...extra,
});

export const fichaDeProjeto = (extra: object = {}) => ({
  ...resumoDeProjeto(),
  ementa: 'Institui o programa municipal de poda segura.',
  criador: 'Fulano de Tal',
  coautores: [{ id: 1, nome: 'Beltrano da Silva' }],
  tramitacoes: [
    {
      id: 5,
      comissao: 'CCJC',
      data: '2026-11-10',
      parecer: 'Favorável.',
      registradoPor: 'Fulano de Tal',
      registradoEm: '2026-11-10T15:00:00.000Z',
    },
  ],
  votacoes: [
    {
      id: 7,
      data: '2026-11-11',
      resultado: 'aprovado',
      local: 'Plenário',
      registradoPor: 'Fulano de Tal',
      registradoEm: '2026-11-11T15:00:00.000Z',
    },
  ],
  canceladoEm: null,
  justificativaCancelamento: null,
  movimentacoes: [
    {
      id: 1,
      de: null,
      para: 'Em redação',
      papelDoDestino: 'entrada',
      autor: 'Fulano de Tal',
      criadaEm: '2026-11-12T15:00:00.000Z',
      observacao: null,
    },
  ],
  ...extra,
});

export const consolidado = {
  emAndamento: 3,
  atrasados: 1,
  concluidos: 2,
  arquivados: 0,
  cancelados: 1,
  minhasEmAndamento: 2,
  porEtapa: [],
};
