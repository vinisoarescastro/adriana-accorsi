import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderizar, sessaoDe, simularApi } from '../teste/auxiliares';

const etapa = (id: number, nomeInterno: string, papel: string, ordem: number, extra = {}) => ({
  id,
  nomeInterno,
  papel,
  ordem,
  situacao: 'ativa',
  rotuloPublico: null,
  visivelPublico: false,
  prazoPadraoDias: null,
  ...extra,
});

const fluxos = [
  {
    tipo: 'demanda',
    etapas: [
      etapa(1, 'Recebida', 'entrada', 1, { rotuloPublico: 'Recebida', visivelPublico: true }),
      etapa(2, 'Em andamento', 'intermediaria', 2, { prazoPadraoDias: 15 }),
      etapa(3, 'Arquivada', 'arquivamento', 3),
    ],
  },
  {
    tipo: 'emenda',
    etapas: [
      etapa(10, 'Disponível', 'entrada', 1),
      etapa(11, 'Indicada', 'intermediaria', 2, { situacao: 'inativa' }),
    ],
  },
];

const rotas = (perfil: Parameters<typeof sessaoDe>[0]) => ({
  'GET /api/acesso/sessao': { corpo: sessaoDe(perfil) },
  'GET /api/gabinete': { status: 404, corpo: { codigo: 'nao_encontrado', mensagem: 'x' } },
  'GET /api/equipe': { corpo: [] },
  'GET /api/fluxos': { corpo: fluxos },
});

describe('fluxos', () => {
  it('mostra um fluxo por vez, com o caminho das etapas e a tabela', async () => {
    simularApi(rotas('chefe'));
    const usuario = userEvent.setup();
    renderizar('/g/fluxos');
    const trilho = await screen.findByRole('list', { name: /Caminho do fluxo de Demanda/ });
    expect(within(trilho).getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByText('3 etapas ativas')).toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: 'Emenda' }));
    const outro = await screen.findByRole('list', { name: /Caminho do fluxo de Emenda/ });
    expect(within(outro).getByText(/Indicada/)).toBeInTheDocument();
    expect(screen.getByText('1 etapa ativa')).toBeInTheDocument();
  });

  it('só o Administrador vê "Adicionar etapa"; o Chefe ajusta, mas não estrutura', async () => {
    simularApi(rotas('chefe'));
    renderizar('/g/fluxos');
    await screen.findByRole('list', { name: /Caminho do fluxo/ });
    expect(screen.getAllByRole('button', { name: 'Ajustar' }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('heading', { name: 'Adicionar etapa' })).not.toBeInTheDocument();
  });

  it('o Administrador vê o formulário de nova etapa', async () => {
    simularApi(rotas('administrador'));
    renderizar('/g/fluxos');
    expect(await screen.findByRole('heading', { name: 'Adicionar etapa' })).toBeInTheDocument();
    expect(screen.getByRole('form', { name: 'Nova etapa' })).toBeInTheDocument();
  });
});
