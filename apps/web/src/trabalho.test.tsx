import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { abrirGuia, renderizar, sessaoDe, simularApi } from './teste/auxiliares';

const naoEncontrado = {
  status: 404,
  corpo: { codigo: 'nao_encontrado', mensagem: 'Não encontrado.' },
};

type Perfil = 'chefe' | 'assessor_externo' | 'assessor_interno' | 'parlamentar';

const base = (perfil: Perfil = 'assessor_interno') => ({
  'GET /api/acesso/sessao': { corpo: sessaoDe(perfil) },
  'GET /api/gabinete': naoEncontrado,
  'GET /api/avisos': { corpo: { itens: [], naoLidos: 0 } },
  'GET /api/equipe': {
    corpo: [
      { id: 1, nome: 'Fulano de Tal', perfil, situacao: 'ativo', habilitacoes: ['AT', 'AG'] },
      {
        id: 2,
        nome: 'Beltrana',
        perfil: 'assessor_interno',
        situacao: 'ativo',
        habilitacoes: ['AG'],
      },
    ],
  },
});

const tarefa = (id: number, extra: object = {}) => ({
  id,
  titulo: `Ligar para a prefeitura ${id}`,
  prioridade: 'media',
  prazo: null,
  etapa: { id: 1, nome: 'A fazer', papel: 'entrada' },
  status: 'em_andamento',
  atrasada: false,
  responsavel: { id: 1, nome: 'Fulano de Tal' },
  criador: 'Fulano de Tal',
  vinculo: null,
  criadoEm: '2026-11-12T15:00:00.000Z',
  ...extra,
});

const fichaDaTarefa = (id: number, extra: object = {}) => ({
  ...tarefa(id),
  descricao: null,
  canceladaEm: null,
  justificativaCancelamento: null,
  movimentacoes: [
    {
      id: 1,
      de: null,
      para: 'A fazer',
      papelDoDestino: 'entrada',
      autor: 'Fulano de Tal',
      observacao: null,
      criadaEm: '2026-11-12T15:00:00.000Z',
    },
  ],
  ...extra,
});

const etapasDeTarefa = [
  { id: 1, nome: 'A fazer', papel: 'entrada', ordem: 1 },
  { id: 2, nome: 'Em andamento', papel: 'intermediaria', ordem: 2 },
  { id: 3, nome: 'Concluída', papel: 'conclusao', ordem: 3 },
];

const pagina = (itens: object[]) => ({
  corpo: { itens, total: itens.length, pagina: 1, porPagina: 25 },
});

describe('tarefas', () => {
  it('lista com situação e atraso em texto, e filtra no servidor', async () => {
    const chamadas = simularApi({
      ...base(),
      'GET /api/tarefas?pagina=1&porPagina=25': pagina([
        tarefa(1),
        tarefa(2, { atrasada: true, prazo: '2026-11-01' }),
      ]),
      'GET /api/tarefas?pagina=1&porPagina=25&atrasadas=true&minhas=true': pagina([]),
    });
    const usuario = userEvent.setup();
    renderizar('/g/tarefas?visao=lista');

    const tabela = await screen.findByRole('table');
    expect(within(tabela).getByText(/2 tarefa\(s\), página 1 de 1/)).toBeInTheDocument();
    expect(within(tabela).getByText('Atrasada')).toBeInTheDocument();
    expect(within(tabela).getAllByText('A fazer')).toHaveLength(2);

    await usuario.click(screen.getByRole('button', { name: 'Minhas' }));
    await usuario.click(screen.getByRole('button', { name: 'Atrasadas' }));
    expect(await screen.findByText('Nenhuma tarefa encontrada.')).toBeInTheDocument();
    expect(chamadas.some((c) => c.caminho.includes('atrasadas=true&minhas=true'))).toBe(true);
  });

  it('o quadro é a visão padrão: uma coluna por etapa, sem as canceladas', async () => {
    simularApi({
      ...base(),
      'GET /api/tarefas/etapas': { corpo: etapasDeTarefa },
      'GET /api/tarefas?pagina=1&porPagina=100': pagina([
        tarefa(1),
        tarefa(2, { etapa: { id: 3, nome: 'Concluída', papel: 'conclusao' }, status: 'concluido' }),
        tarefa(3, { status: 'cancelada' }),
      ]),
    });
    renderizar('/g/tarefas');

    const quadro = await screen.findByRole('list', { name: 'Quadro de tarefas por etapa' });
    expect(within(quadro).getAllByRole('listitem')).toHaveLength(3);
    expect(within(quadro).getByRole('button', { name: /prefeitura 1/ })).toBeInTheDocument();
    expect(within(quadro).getByRole('button', { name: /prefeitura 2/ })).toBeInTheDocument();
    expect(within(quadro).queryByRole('button', { name: /prefeitura 3/ })).not.toBeInTheDocument();
  });

  it('o Assessor Externo cria só para si: a escolha do responsável não aparece', async () => {
    simularApi({
      ...base('assessor_externo'),
      'GET /api/tarefas?pagina=1&porPagina=25': pagina([]),
    });
    const usuario = userEvent.setup();
    renderizar('/g/tarefas');
    await usuario.click(await screen.findByRole('button', { name: 'Nova tarefa' }));
    const form = await screen.findByRole('form', { name: 'Nova tarefa' });
    expect(within(form).queryByLabelText('Responsável', { exact: false })).not.toBeInTheDocument();
  });

  it('o Assessor Interno designa outra pessoa, e o corpo leva o responsável', async () => {
    const chamadas = simularApi({
      ...base(),
      'GET /api/tarefas?pagina=1&porPagina=25': pagina([]),
      'POST /api/tarefas': { status: 201, corpo: fichaDaTarefa(7) },
      'GET /api/tarefas/7': { corpo: fichaDaTarefa(7) },
      'GET /api/tarefas/etapas': { corpo: etapasDeTarefa },
    });
    const usuario = userEvent.setup();
    renderizar('/g/tarefas');
    await usuario.click(await screen.findByRole('button', { name: 'Nova tarefa' }));
    const form = await screen.findByRole('form', { name: 'Nova tarefa' });

    await usuario.type(within(form).getByLabelText('Título'), 'Ligar para a prefeitura');
    await usuario.selectOptions(within(form).getByLabelText('Responsável', { exact: false }), '2');
    await usuario.click(within(form).getByRole('button', { name: 'Criar tarefa' }));

    await waitFor(() => expect(chamadas.some((c) => c.metodo === 'POST')).toBe(true));
    const envio = chamadas.find((c) => c.metodo === 'POST' && c.caminho === '/api/tarefas');
    expect(envio?.corpo).toMatchObject({
      titulo: 'Ligar para a prefeitura',
      responsavelId: 2,
      prioridade: 'media',
    });
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('a ficha mostra o histórico e move pelo mecanismo único (etapa de destino)', async () => {
    const chamadas = simularApi({
      ...base(),
      'GET /api/tarefas?pagina=1&porPagina=25': pagina([tarefa(1)]),
      'GET /api/tarefas/1': { corpo: fichaDaTarefa(1) },
      'GET /api/tarefas/etapas': { corpo: etapasDeTarefa },
      'POST /api/tarefas/1/mover': {
        corpo: fichaDaTarefa(1, { etapa: { id: 2, nome: 'Em andamento', papel: 'intermediaria' } }),
      },
    });
    const usuario = userEvent.setup();
    renderizar('/g/tarefas?tarefa=1');

    const gaveta = await screen.findByRole('dialog');
    expect(await within(gaveta).findByText(/Criada em/)).toBeInTheDocument();
    await abrirGuia(gaveta, 'Ações');
    await usuario.selectOptions(await within(gaveta).findByLabelText(/Mover para a etapa/), '2');
    await usuario.click(within(gaveta).getByRole('button', { name: 'Mover' }));
    await waitFor(() =>
      expect(chamadas.some((c) => c.caminho === '/api/tarefas/1/mover')).toBe(true),
    );
    expect(chamadas.find((c) => c.caminho === '/api/tarefas/1/mover')?.corpo).toEqual({
      etapaId: 2,
    });
  });

  it('cancelar só habilita com 10 caracteres, e a tarefa cancelada não oferece ação', async () => {
    simularApi({
      ...base(),
      'GET /api/tarefas?pagina=1&porPagina=25': pagina([tarefa(1)]),
      'GET /api/tarefas/1': { corpo: fichaDaTarefa(1) },
      'GET /api/tarefas/etapas': { corpo: etapasDeTarefa },
    });
    const usuario = userEvent.setup();
    renderizar('/g/tarefas?tarefa=1');
    const gaveta = await screen.findByRole('dialog');
    await within(gaveta).findByRole('tab', { name: 'Ações' });
    await abrirGuia(gaveta, 'Ações');
    await usuario.click(await within(gaveta).findByRole('button', { name: 'Cancelar tarefa' }));
    const confirmar = within(gaveta).getByRole('button', { name: 'Confirmar o cancelamento' });
    expect(confirmar).toBeDisabled();
    await usuario.type(
      within(gaveta).getByLabelText(/Justificativa do cancelamento/),
      'Já resolvido',
    );
    expect(confirmar).toBeEnabled();
  });

  it('tarefa cancelada é só de leitura', async () => {
    simularApi({
      ...base(),
      'GET /api/tarefas?pagina=1&porPagina=25': pagina([]),
      'GET /api/tarefas/1': {
        corpo: fichaDaTarefa(1, {
          status: 'cancelada',
          justificativaCancelamento: 'Já resolvido por telefone',
        }),
      },
      'GET /api/tarefas/etapas': { corpo: etapasDeTarefa },
    });
    renderizar('/g/tarefas?tarefa=1');
    const gaveta = await screen.findByRole('dialog');
    expect(await within(gaveta).findByText(/Tarefa cancelada/)).toBeInTheDocument();
    expect(within(gaveta).queryByRole('button', { name: 'Mover' })).not.toBeInTheDocument();
    expect(within(gaveta).queryByText('Ações')).not.toBeInTheDocument();
  });
});

describe('o sino de avisos', () => {
  const aviso = (id: number, extra: object = {}) => ({
    id,
    natureza: 'tarefa_designada',
    frase: 'Uma tarefa foi designada a você',
    registro: { tipo: 'tarefa', id: 9, titulo: 'Ligar para a prefeitura' },
    geradoEm: '2026-11-12T15:00:00.000Z',
    lido: false,
    ...extra,
  });

  it('mostra a contagem em texto e abre a caixa, com a frase e o título do registro', async () => {
    simularApi({
      ...base(),
      'GET /api/avisos': {
        corpo: { itens: [aviso(1), aviso(2, { lido: true })], naoLidos: 1 },
      },
      'GET /api/painel/tarefas': {
        corpo: { abertas: 0, atrasadas: 0, minhasAbertas: 0, minhasAtrasadas: 0 },
      },
      'GET /api/painel/atendimento': { status: 404, corpo: {} },
    });
    const usuario = userEvent.setup();
    renderizar('/g/painel');

    const sino = await screen.findByRole('button', { name: /Avisos \(1 novo\)/ });
    await usuario.click(sino);
    const caixa = await screen.findByRole('region', { name: 'Seus avisos' });
    expect(within(caixa).getByText(/Novo:/)).toBeInTheDocument();
    expect(within(caixa).getAllByText(/Uma tarefa foi designada a você/)).toHaveLength(2);
    expect(within(caixa).getAllByText(/Ligar para a prefeitura/).length).toBeGreaterThan(0);
    expect(within(caixa).getAllByRole('link', { name: /Abrir/ })[0]).toHaveAttribute(
      'href',
      '/g/tarefas?tarefa=9',
    );
  });

  it('marcar todos como lidos chama a API', async () => {
    const chamadas = simularApi({
      ...base(),
      'GET /api/avisos': { corpo: { itens: [aviso(1)], naoLidos: 1 } },
      'POST /api/avisos/lidos': { corpo: { itens: [aviso(1, { lido: true })], naoLidos: 0 } },
      'GET /api/painel/tarefas': {
        corpo: { abertas: 0, atrasadas: 0, minhasAbertas: 0, minhasAtrasadas: 0 },
      },
    });
    const usuario = userEvent.setup();
    renderizar('/g/painel');
    await usuario.click(await screen.findByRole('button', { name: /Avisos/ }));
    await usuario.click(await screen.findByRole('button', { name: 'Marcar todos como lidos' }));
    await waitFor(() => expect(chamadas.some((c) => c.caminho === '/api/avisos/lidos')).toBe(true));
    expect(chamadas.find((c) => c.caminho === '/api/avisos/lidos')?.corpo).toEqual({ todos: true });
  });

  it('sem avisos, diz isso', async () => {
    simularApi({
      ...base(),
      'GET /api/painel/tarefas': {
        corpo: { abertas: 0, atrasadas: 0, minhasAbertas: 0, minhasAtrasadas: 0 },
      },
    });
    const usuario = userEvent.setup();
    renderizar('/g/painel');
    await usuario.click(await screen.findByRole('button', { name: 'Avisos' }));
    expect(await screen.findByText('Nenhum aviso por enquanto.')).toBeInTheDocument();
  });
});

describe('painel de tarefas', () => {
  it('mostra os números como links para a lista já filtrada', async () => {
    simularApi({
      ...base(),
      'GET /api/painel/tarefas': {
        corpo: { abertas: 5, atrasadas: 2, minhasAbertas: 3, minhasAtrasadas: 1 },
      },
    });
    renderizar('/g/painel');
    const atrasadas = await screen.findByRole('link', { name: /Tarefas atrasadas/ });
    expect(atrasadas).toHaveAttribute('href', '/g/tarefas?atrasadas=true');
    expect(within(atrasadas).getByText('2')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Minhas tarefas atrasadas/ })).toHaveAttribute(
      'href',
      '/g/tarefas?atrasadas=true&minhas=true',
    );
  });
});
