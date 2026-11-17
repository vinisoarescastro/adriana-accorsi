import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderizar, sessaoDe, simularApi } from '../teste/auxiliares';

const item = (id: number, extra: object = {}) => ({
  id,
  ocorridaEm: '2026-11-12T15:30:00.000Z',
  autorId: 1,
  autorNome: 'Helena Vasconcelos',
  origem: 'usuario',
  operacao: 'demanda.mover',
  entidade: 'demanda',
  registroId: '9',
  valorAnterior: { etapa: 'Recebida', prazo: '2026-11-20' },
  valorNovo: { etapa: 'Em andamento', prazo: '2026-11-20' },
  justificativa: null,
  ...extra,
});

const rotas = (
  itens: unknown[] = [
    item(2),
    item(1, {
      operacao: 'acesso.entrada',
      entidade: 'usuario',
      valorAnterior: null,
      valorNovo: null,
    }),
  ],
) => ({
  'GET /api/acesso/sessao': { corpo: sessaoDe('chefe') },
  'GET /api/gabinete': { status: 404, corpo: { codigo: 'nao_encontrado', mensagem: 'x' } },
  'GET /api/equipe': {
    corpo: [
      {
        id: 1,
        nome: 'Helena Vasconcelos',
        email: 'h@x.test',
        perfil: 'chefe',
        situacao: 'ativo',
        habilitacoes: [],
        temFoto: false,
        contato: null,
        criadoEm: '2026-01-01T00:00:00.000Z',
      },
    ],
  },
  'GET /api/auditoria/opcoes': {
    corpo: { operacoes: ['acesso.entrada', 'demanda.mover'], entidades: ['demanda', 'usuario'] },
  },
  'GET /api/auditoria?pagina=1&porPagina=25': {
    corpo: { itens, total: itens.length, pagina: 1, porPagina: 25 },
  },
});

describe('auditoria', () => {
  it('mostra quem fez o quê, em palavras, com o código da operação', async () => {
    simularApi(rotas());
    renderizar('/g/auditoria');
    const tabela = await screen.findByRole('table');
    expect(within(tabela).getByText('Moveu')).toBeInTheDocument();
    expect(within(tabela).getByText('demanda.mover')).toBeInTheDocument();
    expect(within(tabela).getByText('Entrou no sistema')).toBeInTheDocument();
    expect(within(tabela).getAllByText('Helena Vasconcelos')).toHaveLength(2);
    expect(within(tabela).getByText('Demanda')).toBeInTheDocument();
  });

  it('abre o antes e depois campo a campo, marcando só o que mudou', async () => {
    simularApi(rotas());
    renderizar('/g/auditoria');
    const tabela = await screen.findByRole('table');
    expect(within(tabela).getAllByRole('button', { name: /Detalhes/ })).toHaveLength(1);
    await userEvent.setup().click(within(tabela).getByRole('button', { name: /Detalhes/ }));
    const diferenca = within(tabela).getByRole('table');
    const linhaDaEtapa = within(diferenca).getByRole('row', { name: /Etapa/ });
    expect(linhaDaEtapa).toHaveClass('trilha-detalhes__mudou');
    expect(within(linhaDaEtapa).getByText('Recebida')).toBeInTheDocument();
    expect(within(linhaDaEtapa).getByText('Em andamento')).toBeInTheDocument();
    expect(within(diferenca).getByRole('row', { name: /Prazo/ })).not.toHaveClass(
      'trilha-detalhes__mudou',
    );
  });

  it('sem registros, diz que não há nada com os filtros', async () => {
    simularApi(rotas([]));
    renderizar('/g/auditoria');
    expect(await screen.findByText('Nenhum registro')).toBeInTheDocument();
  });
});
