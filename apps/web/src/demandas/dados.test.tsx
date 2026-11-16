import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { abrirGuia, renderizar, sessaoDe, simularApi } from '../teste/auxiliares';

const usuario = (id: number, nome: string) => ({
  id,
  nome,
  email: `${id}@exemplo.test`,
  contato: null,
  perfil: 'assessor_interno',
  situacao: 'ativo',
  habilitacoes: ['AT'],
  temFoto: false,
  criadoEm: '2026-11-01T12:00:00.000Z',
});

const equipe = [
  usuario(1, 'Fulano de Tal'),
  usuario(2, 'Beltrana Souza Lima'),
  usuario(3, 'Carlos Eduardo Pereira'),
];

const ficha = (extra: object = {}) => ({
  id: 7,
  protocolo: 'K7M2-9PQ4-XA37',
  titulo: 'Poda de árvore',
  prioridade: 'media',
  prazo: '2026-12-10',
  etapa: { id: 1, nome: 'Recebida', papel: 'entrada' },
  status: 'em_andamento',
  atrasada: false,
  solicitante: { id: 10, nome: 'Maria da Silva' },
  responsavel: { id: 1, nome: 'Fulano de Tal' },
  corresponsaveis: [{ id: 2, nome: 'Beltrana Souza Lima' }],
  criadoEm: '2026-11-12T15:00:00.000Z',
  descricao: 'Texto',
  autor: 'Fulano de Tal',
  solicitanteTelefone: null,
  canceladaEm: null,
  justificativaCancelamento: null,
  completa: true,
  comentarios: [],
  documentos: [
    {
      id: 5,
      nome: 'comprovante.pdf',
      natureza: 'comprovante',
      tamanho: 2048,
      enviadoPor: 'Fulano de Tal',
      enviadoEm: '2026-11-12T15:00:00.000Z',
      removido: false,
      removidoEm: null,
    },
  ],
  movimentacoes: [],
  ...extra,
});

const base = (perfil: 'chefe' | 'assessor_interno' = 'chefe') => ({
  'GET /api/acesso/sessao': { corpo: sessaoDe(perfil) },
  'GET /api/gabinete': { status: 404, corpo: { codigo: 'nao_encontrado', mensagem: 'x' } },
  'GET /api/equipe': { corpo: equipe },
  'GET /api/fluxos': { corpo: [] },
  'GET /api/demandas/quadro': { corpo: { colunas: [], limitePorColuna: 30 } },
  'GET /api/demandas/7': { corpo: ficha() },
});

describe('responsáveis e nomes curtos', () => {
  it('o topo da ficha e o menu da conta mostram só o primeiro e o segundo nome', async () => {
    simularApi(base());
    renderizar('/g/demandas?demanda=7');
    const modal = await screen.findByRole('dialog');
    const resumo = await within(modal).findByRole('list', { name: 'Resumo' });
    expect(within(resumo).getByText(/Fulano Tal, Beltrana Souza/)).toBeInTheDocument();
    expect(within(resumo).queryByText(/Lima/)).not.toBeInTheDocument();
    // O menu da conta: só o nome curto, sem o perfil entre parênteses.
    const conta = screen.getByRole('button', { name: 'Menu da conta' });
    expect(conta).toHaveTextContent('Fulano Tal');
    expect(conta).not.toHaveTextContent('(');
  });
});

describe('editar os dados na guia Detalhes', () => {
  it('muda título, prazo, prioridade e responsáveis: um PATCH e uma reatribuição', async () => {
    // O servidor passa a devolver a ficha já alterada depois de cada gravação.
    let atual = ficha();
    const chamadas = simularApi({
      ...base(),
      'GET /api/demandas/7': () => ({ corpo: atual }),
      'PATCH /api/demandas/7': () => {
        atual = ficha({ titulo: 'Poda urgente' });
        return { corpo: atual };
      },
      'POST /api/demandas/7/reatribuir': () => {
        atual = ficha({
          titulo: 'Poda urgente',
          responsavel: { id: 3, nome: 'Carlos Eduardo Pereira' },
          corresponsaveis: [{ id: 1, nome: 'Fulano de Tal' }],
        });
        return { corpo: atual };
      },
    });
    const usuarioDeTeste = userEvent.setup();
    renderizar('/g/demandas?demanda=7');
    const modal = await screen.findByRole('dialog');
    await usuarioDeTeste.click(await within(modal).findByRole('button', { name: 'Editar dados' }));

    const titulo = within(modal).getByLabelText('Título');
    await usuarioDeTeste.clear(titulo);
    await usuarioDeTeste.type(titulo, 'Poda urgente');
    await usuarioDeTeste.selectOptions(within(modal).getByLabelText('Prioridade'), 'urgente');
    await usuarioDeTeste.selectOptions(
      within(modal).getByLabelText('Responsável principal'),
      'Carlos Eduardo Pereira',
    );
    // O novo principal sai da lista dos demais; Fulano passa a ser um dos outros responsáveis.
    await usuarioDeTeste.click(within(modal).getByRole('button', { name: /Outros responsáveis/ }));
    const lista = await screen.findByRole('group', { name: /Outros responsáveis/ });
    await usuarioDeTeste.click(within(lista).getByRole('checkbox', { name: /Fulano de Tal/ }));
    await usuarioDeTeste.click(within(lista).getByRole('checkbox', { name: /Beltrana/ }));
    await usuarioDeTeste.click(within(modal).getByRole('button', { name: 'Salvar dados' }));

    await waitFor(() => expect(chamadas.some((c) => c.caminho.endsWith('/reatribuir'))).toBe(true));
    expect(chamadas.find((c) => c.metodo === 'PATCH')?.corpo).toEqual({
      titulo: 'Poda urgente',
      prioridade: 'urgente',
      prazo: '2026-12-10',
    });
    expect(chamadas.find((c) => c.caminho.endsWith('/reatribuir'))?.corpo).toEqual({
      responsavelId: 3,
      corresponsaveis: [1],
    });
    // A ficha mostra os novos responsáveis (nomes curtos), e a edição fecha.
    await waitFor(() => expect(within(modal).queryByLabelText('Título')).not.toBeInTheDocument());
    expect(within(modal).getAllByText(/Carlos Eduardo/).length).toBeGreaterThan(0);
  });

  it('quem só altera (não reatribui) edita os dados, mas não vê os campos de responsáveis', async () => {
    simularApi(base('assessor_interno'));
    const usuarioDeTeste = userEvent.setup();
    renderizar('/g/demandas?demanda=7');
    const modal = await screen.findByRole('dialog');
    await usuarioDeTeste.click(await within(modal).findByRole('button', { name: 'Editar dados' }));
    expect(within(modal).getByLabelText('Título')).toBeInTheDocument();
    expect(within(modal).queryByLabelText('Responsável principal')).not.toBeInTheDocument();
  });
});

describe('editar um documento', () => {
  it('renomeia e muda a natureza pela aba Documentos', async () => {
    const chamadas = simularApi({
      ...base(),
      'PATCH /api/documentos/5': { corpo: [] },
    });
    const usuarioDeTeste = userEvent.setup();
    renderizar('/g/demandas?demanda=7');
    const modal = await screen.findByRole('dialog');
    await within(modal).findByRole('tab', { name: /^Documentos/ });
    await abrirGuia(modal, /^Documentos/);
    await usuarioDeTeste.click(
      await within(modal).findByRole('button', { name: 'Editar comprovante.pdf' }),
    );
    const edicao = await screen.findByRole('dialog', { name: 'Editar documento' });
    const nome = within(edicao).getByLabelText('Nome do documento');
    await usuarioDeTeste.clear(nome);
    await usuarioDeTeste.type(nome, 'oficio-saude.pdf');
    await usuarioDeTeste.selectOptions(within(edicao).getByLabelText('Natureza'), 'oficio');
    await usuarioDeTeste.click(within(edicao).getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(chamadas.some((c) => c.metodo === 'PATCH')).toBe(true));
    expect(chamadas.find((c) => c.caminho === '/api/documentos/5')?.corpo).toEqual({
      nome: 'oficio-saude.pdf',
      natureza: 'oficio',
    });
  });
});
