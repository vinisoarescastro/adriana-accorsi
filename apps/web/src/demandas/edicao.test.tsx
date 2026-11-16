import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { abrirGuia, renderizar, sessaoDe, simularApi } from '../teste/auxiliares';

const ficha = (descricao: string | null) => ({
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
  descricao,
  autor: 'Fulano de Tal',
  solicitanteTelefone: null,
  canceladaEm: null,
  justificativaCancelamento: null,
  completa: true,
  comentarios: [],
  documentos: [],
  movimentacoes: [],
});

const base = (perfil: 'chefe' | 'assessor_interno' = 'chefe') => ({
  'GET /api/acesso/sessao': { corpo: sessaoDe(perfil) },
  'GET /api/gabinete': { status: 404, corpo: { codigo: 'nao_encontrado', mensagem: 'x' } },
  'GET /api/equipe': { corpo: [] },
  'GET /api/fluxos': { corpo: [] },
  'GET /api/demandas/quadro': { corpo: { colunas: [], limitePorColuna: 30 } },
});

describe('editar a descrição na guia Detalhes', () => {
  it('da demanda: o lápis abre o campo, salva e a ficha mostra o texto novo', async () => {
    let atual: string | null = 'Descrição antiga';
    const chamadas = simularApi({
      ...base(),
      'GET /api/demandas/7': () => ({ corpo: ficha(atual) }),
      'PATCH /api/demandas/7': () => {
        atual = 'Descrição nova e completa';
        return { corpo: ficha(atual) };
      },
    });
    const usuario = userEvent.setup();
    renderizar('/g/demandas?demanda=7');
    const modal = await screen.findByRole('dialog');
    expect(await within(modal).findByText('Descrição antiga')).toBeInTheDocument();

    await usuario.click(within(modal).getByRole('button', { name: 'Editar descrição' }));
    const campo = within(modal).getByLabelText('Descrição');
    expect(campo).toHaveValue('Descrição antiga');
    await usuario.clear(campo);
    await usuario.type(campo, 'Descrição nova e completa');
    await usuario.click(within(modal).getByRole('button', { name: 'Salvar descrição' }));

    await waitFor(() => expect(chamadas.some((c) => c.metodo === 'PATCH')).toBe(true));
    expect(chamadas.find((c) => c.metodo === 'PATCH')?.corpo).toEqual({
      descricao: 'Descrição nova e completa',
      mencoes: [],
    });
    // O campo fecha e a ficha mostra o texto salvo.
    await waitFor(() =>
      expect(within(modal).queryByLabelText('Descrição')).not.toBeInTheDocument(),
    );
    expect(within(modal).getByText('Descrição nova e completa')).toBeInTheDocument();
  });

  it('apagar o texto envia descrição nula', async () => {
    const chamadas = simularApi({
      ...base(),
      'GET /api/demandas/7': { corpo: ficha('Para apagar') },
      'PATCH /api/demandas/7': { corpo: ficha(null) },
    });
    const usuario = userEvent.setup();
    renderizar('/g/demandas?demanda=7');
    const modal = await screen.findByRole('dialog');
    await usuario.click(await within(modal).findByRole('button', { name: 'Editar descrição' }));
    await usuario.clear(within(modal).getByLabelText('Descrição'));
    await usuario.click(within(modal).getByRole('button', { name: 'Salvar descrição' }));
    await waitFor(() =>
      expect(chamadas.find((c) => c.metodo === 'PATCH')?.corpo).toEqual({
        descricao: null,
        mencoes: [],
      }),
    );
  });

  it('se a API recusar, o motivo aparece e o campo continua aberto com o que foi digitado', async () => {
    simularApi({
      ...base(),
      'GET /api/demandas/7': { corpo: ficha('Antiga') },
      'PATCH /api/demandas/7': {
        status: 409,
        corpo: { codigo: 'conflito', mensagem: 'Demanda cancelada não se altera.' },
      },
    });
    const usuario = userEvent.setup();
    renderizar('/g/demandas?demanda=7');
    const modal = await screen.findByRole('dialog');
    await usuario.click(await within(modal).findByRole('button', { name: 'Editar descrição' }));
    await usuario.type(within(modal).getByLabelText('Descrição'), ' mais');
    await usuario.click(within(modal).getByRole('button', { name: 'Salvar descrição' }));
    expect((await screen.findAllByText(/Demanda cancelada não se altera/)).length).toBeGreaterThan(
      0,
    );
    expect(within(modal).getByLabelText('Descrição')).toHaveValue('Antiga mais');
  });

  it('quem não é supervisor nem o responsável só lê a descrição', async () => {
    simularApi({
      ...base('assessor_interno'),
      'GET /api/demandas/7': {
        corpo: { ...ficha('Texto'), responsavel: { id: 99, nome: 'Outra Pessoa' } },
      },
    });
    renderizar('/g/demandas?demanda=7');
    const modal = await screen.findByRole('dialog');
    expect(await within(modal).findByText('Texto')).toBeInTheDocument();
    expect(
      within(modal).queryByRole('button', { name: 'Editar descrição' }),
    ).not.toBeInTheDocument();
  });
});

describe('estrutura fixa da ficha e navegação pelas abas', () => {
  it('percorre todas as abas: só a ativa aparece, o histórico mostra tudo e a moldura não muda', async () => {
    simularApi({
      ...base(),
      'GET /api/demandas/7': {
        corpo: {
          ...ficha('Texto da descrição'),
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
          movimentacoes: [
            {
              id: 1,
              de: null,
              para: 'Recebida',
              autor: 'Fulano de Tal',
              criadaEm: '2026-11-12T15:00:00.000Z',
              observacao: null,
            },
            {
              id: 2,
              de: 'Recebida',
              para: 'Em andamento',
              autor: 'Beltrana',
              criadaEm: '2026-11-13T15:00:00.000Z',
              observacao: 'Observação comprida '.repeat(12),
            },
          ],
        },
      },
    });
    renderizar('/g/demandas?demanda=7');
    const modal = await screen.findByRole('dialog');
    expect(modal).toHaveClass('modal--ficha');
    await within(modal).findByText('Texto da descrição');

    const rolagem = modal.querySelector('.ficha-rolagem') as HTMLElement;
    const abas = within(modal).getByRole('tablist');
    // As abas ficam fora da área que rola, então sempre à vista.
    expect(rolagem.contains(abas)).toBe(false);

    const guias: [string | RegExp, RegExp | string][] = [
      ['Detalhes', 'Texto da descrição'],
      [/^Comentários/, 'Comentários internos'],
      [/^Documentos/, 'comprovante.pdf'],
      ['Cidadão', 'Acompanhamento do cidadão'],
      [/^Histórico/, 'Em andamento'],
      ['Ações', 'Mover para a etapa'],
    ];
    for (const [aba, conteudo] of guias) {
      await abrirGuia(modal, aba);
      const painel = within(modal)
        .getAllByRole('tabpanel')
        .find((p) => !p.hidden) as HTMLElement;
      // Cada aba mostra o seu conteúdo, dentro da mesma área rolável.
      expect(rolagem.contains(painel)).toBe(true);
      expect(within(painel).getAllByText(conteudo).length).toBeGreaterThan(0);
      expect(
        within(modal)
          .getAllByRole('tabpanel')
          .filter((p) => !p.hidden),
      ).toHaveLength(1);
    }

    // Histórico: a observação longa aparece inteira (não é cortada).
    await abrirGuia(modal, /^Histórico/);
    expect(within(modal).getByText(/Observação comprida/)).toHaveTextContent(
      'Observação comprida '.repeat(12).trim(),
    );
    expect(within(modal).getByText(/Registrada em/)).toBeInTheDocument();
  });
});
