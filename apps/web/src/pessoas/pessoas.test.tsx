import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderizar, sessaoDe, simularApi } from '../teste/auxiliares';

const pessoa = (id: number, extra: object = {}) => ({
  id,
  nomeCompleto: `Pessoa ${id}`,
  telefone: '(67) 99999-0000',
  email: null,
  contatos: null,
  endereco: null,
  situacao: 'ativa',
  criadoEm: '2026-11-12T15:00:00.000Z',
  ...extra,
});

const base = (perfil: 'administrador' | 'assessor_interno' | 'supervisor') => ({
  'GET /api/acesso/sessao': { corpo: sessaoDe(perfil) },
  'GET /api/gabinete': {
    status: 404,
    corpo: { codigo: 'nao_encontrado', mensagem: 'Não encontrado.' },
  },
  'GET /api/pessoas?pagina=1&porPagina=25': {
    corpo: {
      itens: [
        pessoa(1),
        pessoa(2, { situacao: 'inativa' }),
        pessoa(3, { nomeCompleto: null, telefone: null, situacao: 'dados_eliminados' }),
      ],
      total: 3,
      pagina: 1,
      porPagina: 25,
    },
  },
});

describe('pessoas', () => {
  it('lista com situação em texto; dados eliminados aparecem despersonalizados e sem ações', async () => {
    simularApi(base('supervisor'));
    renderizar('/g/pessoas');
    const tabela = await screen.findByRole('table');
    expect(within(tabela).getByText('Pessoa 1')).toBeInTheDocument();
    expect(within(tabela).getAllByText('Dados eliminados').length).toBeGreaterThanOrEqual(2);
    expect(within(tabela).getByText('Sem ações')).toBeInTheDocument();
    expect(within(tabela).getByText('Inativa')).toBeInTheDocument();
  });

  it('só o Administrador vê "Eliminar dados"; o Supervisor inativa; o Assessor Interno só altera', async () => {
    simularApi(base('administrador'));
    renderizar('/g/pessoas');
    await screen.findByRole('table');
    expect(screen.getAllByRole('button', { name: 'Eliminar dados' }).length).toBe(2);
  });

  it('o Supervisor não vê eliminar, mas vê inativar', async () => {
    simularApi(base('supervisor'));
    renderizar('/g/pessoas');
    await screen.findByRole('table');
    expect(screen.queryByRole('button', { name: 'Eliminar dados' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Inativar|Reativar/ }).length).toBeGreaterThan(0);
  });

  it('o Assessor Interno cadastra e altera, mas não inativa', async () => {
    simularApi(base('assessor_interno'));
    renderizar('/g/pessoas');
    await screen.findByRole('table');
    expect(screen.getByRole('button', { name: 'Nova pessoa' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Alterar' }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /Inativar|Reativar/ })).not.toBeInTheDocument();
  });
});

describe('painel de atendimento', () => {
  it('mostra os números com link para a lista e a tabela equivalente', async () => {
    simularApi({
      'GET /api/acesso/sessao': { corpo: sessaoDe('supervisor') },
      'GET /api/gabinete': {
        status: 404,
        corpo: { codigo: 'nao_encontrado', mensagem: 'Não encontrado.' },
      },
      'GET /api/equipe': { corpo: [] },
      'GET /api/painel/atendimento': {
        corpo: {
          abertas: 12,
          atrasadas: 3,
          paradas: 2,
          limiteParadoDias: 14,
          novasNaSemana: 5,
          concluidasNoMes: 7,
          minhasAbertas: 4,
          porEtapa: [
            { id: 1, nome: 'Recebida', papel: 'entrada', total: 8 },
            { id: 2, nome: 'Em andamento', papel: 'intermediaria', total: 4 },
          ],
        },
      },
    });
    renderizar('/g/painel');

    expect(await screen.findByText('12')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Atrasadas/ })).toHaveAttribute(
      'href',
      '/g/demandas?atrasadas=true',
    );
    expect(screen.getByText(/Paradas há mais de 14 dias/)).toBeInTheDocument();
    const tabela = screen.getByRole('table', { name: 'Demandas por etapa' });
    expect(within(tabela).getByText('Recebida').nextSibling).toHaveTextContent('8');
  });
});
