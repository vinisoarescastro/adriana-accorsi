import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderizar, sessaoDe, simularApi } from '../teste/auxiliares';

const pessoa = {
  id: 10,
  nomeCompleto: 'Maria da Silva',
  telefone: '(67) 99999-0000',
  email: 'maria@exemplo.test',
  emailInvalido: false,
  consentimento: true,
  contatos: 'Recado com a vizinha',
  endereco: 'Rua das Flores, 100',
  situacao: 'ativa',
  criadoEm: '2026-11-10T12:00:00.000Z',
};

const demanda = {
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
};

const base = (perfil: 'chefe' | 'assessor_externo' = 'chefe') => ({
  'GET /api/acesso/sessao': { corpo: sessaoDe(perfil) },
  'GET /api/gabinete': { status: 404, corpo: { codigo: 'nao_encontrado', mensagem: 'x' } },
  'GET /api/equipe': { corpo: [] },
  'GET /api/fluxos': { corpo: [] },
  'GET /api/demandas/quadro': { corpo: { colunas: [], limitePorColuna: 30 } },
  'GET /api/demandas/7': { corpo: demanda },
  'GET /api/pessoas/10': { corpo: pessoa },
  'GET /api/pessoas?pagina=1&porPagina=25': {
    corpo: { itens: [pessoa], total: 1, pagina: 1, porPagina: 25 },
  },
});

describe('solicitante na ficha da demanda', () => {
  it('aparece no topo (nome e telefone) e o nome abre a ficha da pessoa por cima', async () => {
    simularApi(base());
    const usuario = userEvent.setup();
    renderizar('/g/demandas?demanda=7');
    const modal = await screen.findByRole('dialog');
    const resumo = await within(modal).findByRole('list', { name: 'Resumo' });
    expect(within(resumo).getByText('(67) 99999-0000')).toBeInTheDocument();
    // Não se repete na guia Detalhes.
    expect(within(modal).queryByText('Solicitante')).not.toBeInTheDocument();

    await usuario.click(
      within(resumo).getByRole('button', { name: 'Abrir a ficha de Maria da Silva' }),
    );
    const pessoaModal = await screen.findByRole('dialog', { name: 'Maria da Silva' });
    expect(await within(pessoaModal).findByText('maria@exemplo.test')).toBeInTheDocument();
    expect(within(pessoaModal).getByText('Rua das Flores, 100')).toBeInTheDocument();
    expect(within(pessoaModal).getByText('Recado com a vizinha')).toBeInTheDocument();
    expect(within(pessoaModal).getByText('Ativados')).toBeInTheDocument();
    expect(within(pessoaModal).getByRole('link', { name: /Abrir em Pessoas/ })).toHaveAttribute(
      'href',
      '/g/pessoas?pessoa=10',
    );

    // O Esc fecha só a ficha da pessoa; a demanda continua aberta.
    await usuario.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Maria da Silva' })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Poda de árvore' })).toBeInTheDocument();
  });

  it('dados eliminados: o nome vira texto e não há ficha para abrir', async () => {
    simularApi({
      ...base(),
      'GET /api/demandas/7': {
        corpo: { ...demanda, solicitante: { id: 10, nome: null }, solicitanteTelefone: null },
      },
    });
    renderizar('/g/demandas?demanda=7');
    const modal = await screen.findByRole('dialog');
    const resumo = await within(modal).findByRole('list', { name: 'Resumo' });
    expect(within(resumo).getByText('Dados eliminados a pedido')).toBeInTheDocument();
    expect(within(resumo).queryByRole('button', { name: /Abrir a ficha/ })).not.toBeInTheDocument();
  });
});

describe('ficha da pessoa na página Pessoas', () => {
  it('abre pelo endereço (?pessoa=ID)', async () => {
    simularApi(base());
    renderizar('/g/pessoas?pessoa=10');
    const modal = await screen.findByRole('dialog', { name: 'Maria da Silva' });
    expect(await within(modal).findByText('maria@exemplo.test')).toBeInTheDocument();
    expect(within(modal).getByRole('link', { name: /Ver demandas/ })).toHaveAttribute(
      'href',
      '/g/demandas?solicitante=10&visao=lista',
    );
    // Já está em Pessoas: não oferece "Abrir em Pessoas".
    expect(within(modal).queryByRole('link', { name: /Abrir em Pessoas/ })).not.toBeInTheDocument();
  });

  it('o nome na tabela abre a ficha', async () => {
    simularApi(base());
    const usuario = userEvent.setup();
    renderizar('/g/pessoas');
    await usuario.click(await screen.findByRole('button', { name: 'Maria da Silva' }));
    expect(await screen.findByRole('dialog', { name: 'Maria da Silva' })).toBeInTheDocument();
  });
});
