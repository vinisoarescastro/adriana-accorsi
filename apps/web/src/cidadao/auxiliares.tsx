import userEvent from '@testing-library/user-event';
import { screen, within } from '@testing-library/react';
import { abrirGuia, renderizar, sessaoDe } from '../teste/auxiliares';

/** Construtores de respostas simuladas da API, para os testes das telas da fase 3. */
export const naoEncontrado = {
  status: 404,
  corpo: { codigo: 'nao_encontrado', mensagem: 'Não encontrado.' },
};

export const ficha = (extra: object = {}) => ({
  id: 7,
  protocolo: 'K7M2-9PQ4-XA37',
  titulo: 'Poda de árvore',
  prioridade: 'media',
  prazo: null,
  etapa: { id: 1, nome: 'Recebida', papel: 'entrada' },
  status: 'em_andamento',
  atrasada: false,
  solicitante: { id: 10, nome: 'Maria da Silva' },
  responsavel: { id: 1, nome: 'Fulano de Tal' },
  criadoEm: '2026-11-12T15:00:00.000Z',
  descricao: null,
  autor: 'Fulano de Tal',
  solicitanteTelefone: '(67) 99999-0000',
  canceladaEm: null,
  justificativaCancelamento: null,
  completa: true,
  comentarios: [],
  documentos: [],
  movimentacoes: [],
  ...extra,
});

export const previa = {
  protocolo: 'K7M2-9PQ4-XA37',
  situacao: 'em_andamento',
  criadoEm: '2026-11-12T15:00:00.000Z',
  atualizadoEm: '2026-11-12T16:00:00.000Z',
  titulo: null,
  nome: 'Maria',
  telefone: null,
  etapas: [
    { rotulo: 'Recebida', estado: 'atual', data: '2026-11-12T15:00:00.000Z' },
    { rotulo: 'Concluída', estado: 'prevista', data: null },
  ],
  andamentos: [{ texto: 'Equipe vistoriou o local.', publicadoEm: '2026-11-12T16:00:00.000Z' }],
  gabinete: { nome: 'Gabinete', parlamentar: 'Adriana', telefone: null, email: null },
};

export const acompanhamento = (extra: object = {}) => ({
  estado: 'ativa',
  link: 'https://acompanhe.exemplo.test/a/segredo-do-link',
  previa,
  andamentos: [
    {
      id: 1,
      texto: 'Equipe vistoriou o local.',
      autor: 'Fulano de Tal',
      publicadoEm: '2026-11-12T16:00:00.000Z',
      removido: false,
      removidoPor: null,
      removidoEm: null,
    },
    {
      id: 2,
      texto: 'Texto apagado.',
      autor: 'Beltrana',
      publicadoEm: '2026-11-12T17:00:00.000Z',
      removido: true,
      removidoPor: 'Fulano de Tal',
      removidoEm: '2026-11-12T18:00:00.000Z',
    },
  ],
  notificacao: {
    pessoaId: 10,
    temEmail: true,
    emailInvalido: false,
    consentimento: false,
    registradoEm: null,
    origem: null,
  },
  ...extra,
});

export const consentimento = (situacao: object = {}) => ({
  situacao: {
    pessoaId: 10,
    temEmail: true,
    emailInvalido: false,
    consentimento: false,
    registradoEm: null,
    origem: null,
    ...situacao,
  },
  historico: [],
});

export type Perfil = 'administrador' | 'supervisor' | 'assessor_interno' | 'assessor_externo';

export const base = (perfil: Perfil = 'supervisor', extra: Record<string, unknown> = {}) => ({
  'GET /api/acesso/sessao': { corpo: sessaoDe(perfil) },
  'GET /api/gabinete': naoEncontrado,
  'GET /api/equipe': { corpo: [] },
  'GET /api/fluxos': { corpo: [] },
  'GET /api/demandas?pagina=1&porPagina=25': {
    corpo: { itens: [], total: 0, pagina: 1, porPagina: 25 },
  },
  'GET /api/demandas/7': { corpo: ficha() },
  'GET /api/demandas/7/acompanhamento': { corpo: acompanhamento() },
  'GET /api/pessoas/10/consentimento': { corpo: consentimento() },
  ...extra,
});

export const abrirFicha = async () => {
  renderizar('/g/demandas?demanda=7');
  const gaveta = await screen.findByRole('dialog');
  await within(gaveta).findByRole('tab', { name: 'Cidadão' });
  await abrirGuia(gaveta, 'Cidadão');
  await within(gaveta).findByText('Acompanhamento do cidadão');
  return gaveta;
};

/** Abre o menu "Gerenciar o link" da guia Cidadão (as ações do link ficam nele). */
export const abrirMenuDoLink = async (gaveta: HTMLElement) => {
  await userEvent.setup().click(within(gaveta).getByRole('button', { name: 'Gerenciar o link' }));
  return screen.findByRole('menu');
};
