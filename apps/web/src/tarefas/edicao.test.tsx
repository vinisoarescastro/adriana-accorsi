import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { abrirGuia, renderizar, sessaoDe, simularApi } from '../teste/auxiliares';

const tarefa = (descricao: string | null) => ({
  id: 1,
  titulo: 'Ligar para a prefeitura',
  prioridade: 'media',
  prazo: null,
  etapa: { id: 1, nome: 'A fazer', papel: 'entrada' },
  status: 'em_andamento',
  atrasada: false,
  responsavel: { id: 1, nome: 'Fulano de Tal' },
  corresponsaveis: [{ id: 2, nome: 'Beltrana Souza Lima' }],
  criador: 'Fulano de Tal',
  vinculo: null,
  criadoEm: '2026-11-12T15:00:00.000Z',
  descricao,
  canceladaEm: null,
  justificativaCancelamento: null,
  movimentacoes: [
    {
      id: 1,
      de: null,
      para: 'A fazer',
      autor: 'Fulano de Tal',
      criadaEm: '2026-11-12T15:00:00.000Z',
      observacao: null,
    },
  ],
});

const base = () => ({
  'GET /api/acesso/sessao': { corpo: sessaoDe('chefe') },
  'GET /api/gabinete': { status: 404, corpo: { codigo: 'nao_encontrado', mensagem: 'x' } },
  'GET /api/equipe': {
    corpo: [
      {
        id: 1,
        nome: 'Fulano de Tal',
        email: 'a@x.test',
        contato: null,
        perfil: 'chefe',
        situacao: 'ativo',
        habilitacoes: ['AT'],
        temFoto: false,
        criadoEm: '2026-11-01T12:00:00.000Z',
      },
      {
        id: 2,
        nome: 'Beltrana Souza Lima',
        email: 'b@x.test',
        contato: null,
        perfil: 'assessor_interno',
        situacao: 'ativo',
        habilitacoes: ['AT'],
        temFoto: false,
        criadoEm: '2026-11-01T12:00:00.000Z',
      },
    ],
  },
  'GET /api/tarefas/etapas': { corpo: [{ id: 1, nome: 'A fazer', papel: 'entrada', ordem: 1 }] },
});

describe('ficha da tarefa: descrição e abas', () => {
  it('edita a descrição na guia Detalhes e a ficha mostra o texto salvo', async () => {
    let atual: string | null = 'Antiga';
    const chamadas = simularApi({
      ...base(),
      'GET /api/tarefas/1': () => ({ corpo: tarefa(atual) }),
      'PATCH /api/tarefas/1': () => {
        atual = 'Nova descrição da tarefa';
        return { corpo: tarefa(atual) };
      },
    });
    const usuario = userEvent.setup();
    renderizar('/g/tarefas?tarefa=1');
    const modal = await screen.findByRole('dialog');
    expect(modal).toHaveClass('modal--ficha');
    await usuario.click(await within(modal).findByRole('button', { name: 'Editar descrição' }));
    const campo = within(modal).getByLabelText('Descrição');
    await usuario.clear(campo);
    await usuario.type(campo, 'Nova descrição da tarefa');
    await usuario.click(within(modal).getByRole('button', { name: 'Salvar descrição' }));
    await waitFor(() =>
      expect(chamadas.find((c) => c.metodo === 'PATCH')?.corpo).toEqual({
        descricao: 'Nova descrição da tarefa',
        mencoes: [],
      }),
    );
    expect(await within(modal).findByText('Nova descrição da tarefa')).toBeInTheDocument();
  });

  it('as abas Detalhes, Histórico e Ações mostram cada conteúdo na mesma moldura', async () => {
    simularApi({ ...base(), 'GET /api/tarefas/1': { corpo: tarefa('Texto') } });
    renderizar('/g/tarefas?tarefa=1');
    const modal = await screen.findByRole('dialog');
    await within(modal).findByText('Texto');
    const rolagem = modal.querySelector('.ficha-rolagem') as HTMLElement;
    for (const [aba, conteudo] of [
      ['Detalhes', 'Texto'],
      [/^Histórico/, /Criada em/],
      ['Ações', 'Mover para a etapa'],
    ] as const) {
      await abrirGuia(modal, aba);
      const painel = within(modal)
        .getAllByRole('tabpanel')
        .find((p) => !p.hidden) as HTMLElement;
      expect(rolagem.contains(painel)).toBe(true);
      expect(within(painel).getAllByText(conteudo).length).toBeGreaterThan(0);
    }
  });
});

describe('ficha da tarefa: dados e responsáveis', () => {
  it('mostra os responsáveis com nome curto e salva título e responsáveis', async () => {
    let atual = tarefa('Texto');
    const chamadas = simularApi({
      ...base(),
      'GET /api/tarefas/1': () => ({ corpo: atual }),
      'PATCH /api/tarefas/1': () => {
        atual = { ...tarefa('Texto'), titulo: 'Ligar de novo' };
        return { corpo: atual };
      },
      'POST /api/tarefas/1/reatribuir': () => {
        atual = { ...atual, corresponsaveis: [] };
        return { corpo: atual };
      },
    });
    const usuario = userEvent.setup();
    renderizar('/g/tarefas?tarefa=1');
    const modal = await screen.findByRole('dialog');
    const resumo = await within(modal).findByRole('list', { name: 'Resumo' });
    expect(within(resumo).getByText(/Fulano Tal, Beltrana Souza/)).toBeInTheDocument();

    await usuario.click(within(modal).getByRole('button', { name: 'Editar dados' }));
    const titulo = within(modal).getByLabelText('Título');
    await usuario.clear(titulo);
    await usuario.type(titulo, 'Ligar de novo');
    // Retira a corresponsável pelo X da etiqueta.
    await usuario.click(within(modal).getByRole('button', { name: 'Retirar Beltrana Souza Lima' }));
    await usuario.click(within(modal).getByRole('button', { name: 'Salvar dados' }));

    await waitFor(() => expect(chamadas.some((c) => c.caminho.endsWith('/reatribuir'))).toBe(true));
    expect(chamadas.find((c) => c.metodo === 'PATCH')?.corpo).toMatchObject({
      titulo: 'Ligar de novo',
    });
    expect(chamadas.find((c) => c.caminho.endsWith('/reatribuir'))?.corpo).toEqual({
      corresponsaveis: [],
    });
  });
});
