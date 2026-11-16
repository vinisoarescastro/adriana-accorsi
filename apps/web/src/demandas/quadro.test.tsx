import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { abrirGuia, renderizar, sessaoDe, simularApi } from '../teste/auxiliares';

const resumo = (id: number, responsavelId: number) => ({
  id,
  protocolo: `K7M2-9PQ4-XA3${id}`,
  titulo: `Poda de árvore ${id}`,
  prioridade: 'media',
  prazo: null,
  etapa: { id: 1, nome: 'Recebida', papel: 'entrada' },
  status: 'em_andamento',
  atrasada: false,
  solicitante: { id: 10, nome: 'Maria da Silva' },
  responsavel: { id: responsavelId, nome: 'Fulano de Tal' },
  criadoEm: '2026-11-12T15:00:00.000Z',
});

const quadro = (itens: object[]) => ({
  corpo: {
    limitePorColuna: 30,
    colunas: [
      {
        etapa: { id: 1, nome: 'Recebida', papel: 'entrada', ordem: 1 },
        total: itens.length,
        itens,
      },
      {
        etapa: { id: 2, nome: 'Em andamento', papel: 'intermediaria', ordem: 3 },
        total: 0,
        itens: [],
      },
    ],
  },
});

const base = (
  perfil: 'chefe' | 'assessor_externo',
  itens: object[],
  aoMover = () => undefined,
) => ({
  'GET /api/acesso/sessao': { corpo: sessaoDe(perfil) },
  'GET /api/gabinete': { status: 404, corpo: { codigo: 'nao_encontrado', mensagem: 'x' } },
  'GET /api/equipe': { corpo: [] },
  'GET /api/demandas/quadro': quadro(itens),
  'POST /api/demandas/7/mover': () => {
    aoMover();
    return { corpo: {} };
  },
});

describe('quadro de demandas: mover entre etapas', () => {
  it('arrastar o cartão para outra coluna move a demanda (e a coluna de destino se destaca)', async () => {
    let movida = false;
    const chamadas = simularApi({
      ...base('chefe', [resumo(7, 1)], () => {
        movida = true;
      }),
      // Depois do POST, o servidor já devolve a demanda na etapa nova.
      'GET /api/demandas/quadro': () =>
        movida
          ? {
              corpo: {
                limitePorColuna: 30,
                colunas: [
                  {
                    etapa: { id: 1, nome: 'Recebida', papel: 'entrada', ordem: 1 },
                    total: 0,
                    itens: [],
                  },
                  {
                    etapa: { id: 2, nome: 'Em andamento', papel: 'intermediaria', ordem: 3 },
                    total: 1,
                    itens: [
                      {
                        ...resumo(7, 1),
                        etapa: { id: 2, nome: 'Em andamento', papel: 'intermediaria' },
                      },
                    ],
                  },
                ],
              },
            }
          : quadro([resumo(7, 1)]),
    });
    renderizar('/g/demandas');
    const cartao = (await screen.findByRole('button', { name: /Poda de árvore 7/ })).closest(
      'article',
    ) as HTMLElement;
    expect(cartao).toHaveAttribute('draggable', 'true');

    const destino = screen.getByRole('listitem', { name: 'Em andamento' });
    const dataTransfer = { effectAllowed: '', dropEffect: '', setData: () => undefined };
    fireEvent.dragStart(cartao, { dataTransfer });
    fireEvent.dragOver(destino, { dataTransfer });
    expect(destino).toHaveClass('is-over');
    fireEvent.drop(destino, { dataTransfer });

    await waitFor(() =>
      expect(chamadas.some((c) => c.caminho === '/api/demandas/7/mover')).toBe(true),
    );
    expect(chamadas.find((c) => c.caminho === '/api/demandas/7/mover')?.corpo).toEqual({
      etapaId: 2,
    });
    // O cartão já aparece na coluna de destino.
    await waitFor(() =>
      expect(
        within(screen.getByRole('listitem', { name: 'Em andamento' })).getByRole('button', {
          name: /Poda de árvore 7/,
        }),
      ).toBeInTheDocument(),
    );
  });

  it('o menu "Mover para…" faz o mesmo pelo teclado e no toque', async () => {
    const chamadas = simularApi(base('chefe', [resumo(7, 1)]));
    const usuario = userEvent.setup();
    renderizar('/g/demandas');
    await screen.findByRole('button', { name: /Poda de árvore 7/ });
    await usuario.click(screen.getByRole('button', { name: 'Mover para outra etapa' }));
    await usuario.click(await screen.findByRole('menuitem', { name: 'Mover para Em andamento' }));
    await waitFor(() =>
      expect(chamadas.find((c) => c.caminho === '/api/demandas/7/mover')?.corpo).toEqual({
        etapaId: 2,
      }),
    );
  });

  it('quem não é supervisor nem o responsável não arrasta nem vê o menu de mover', async () => {
    simularApi(base('assessor_externo', [resumo(7, 999)]));
    renderizar('/g/demandas');
    const cartao = (await screen.findByRole('button', { name: /Poda de árvore 7/ })).closest(
      'article',
    ) as HTMLElement;
    expect(cartao).toHaveAttribute('draggable', 'false');
    expect(
      screen.queryByRole('button', { name: 'Mover para outra etapa' }),
    ).not.toBeInTheDocument();
  });
});

describe('guias da ficha', () => {
  it('as setas trocam de guia e só a guia ativa fica visível', async () => {
    simularApi({
      ...base('chefe', []),
      'GET /api/demandas?pagina=1&porPagina=25': {
        corpo: { itens: [], total: 0, pagina: 1, porPagina: 25 },
      },
    });
    // A ficha da demanda precisa de dados completos; basta conferir a barra de guias de uma tarefa.
    simularApi({
      'GET /api/acesso/sessao': { corpo: sessaoDe('chefe') },
      'GET /api/gabinete': { status: 404, corpo: { codigo: 'nao_encontrado', mensagem: 'x' } },
      'GET /api/equipe': { corpo: [] },
      'GET /api/tarefas/etapas': {
        corpo: [{ id: 1, nome: 'A fazer', papel: 'entrada', ordem: 1 }],
      },
      'GET /api/tarefas/1': {
        corpo: {
          id: 1,
          titulo: 'Ligar para a prefeitura',
          prioridade: 'media',
          prazo: null,
          etapa: { id: 1, nome: 'A fazer', papel: 'entrada' },
          status: 'em_andamento',
          atrasada: false,
          responsavel: { id: 1, nome: 'Fulano de Tal' },
          criador: 'Fulano de Tal',
          vinculo: null,
          criadoEm: '2026-11-12T15:00:00.000Z',
          descricao: 'Pedir a poda',
          canceladaEm: null,
          justificativaCancelamento: null,
          movimentacoes: [],
        },
      },
    });
    const usuario = userEvent.setup();
    renderizar('/g/tarefas?tarefa=1');
    const modal = await screen.findByRole('dialog');
    const detalhes = await within(modal).findByRole('tab', { name: 'Detalhes' });
    expect(detalhes).toHaveAttribute('aria-selected', 'true');
    expect(within(modal).getByText('Pedir a poda')).toBeVisible();

    detalhes.focus();
    await usuario.keyboard('{ArrowRight}');
    expect(within(modal).getByRole('tab', { name: /^Histórico/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(within(modal).getByText('Pedir a poda')).not.toBeVisible();

    await abrirGuia(modal, 'Detalhes');
    expect(within(modal).getByText('Pedir a poda')).toBeVisible();
  });
});
