import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderizar, sessaoDe, simularApi } from '../teste/auxiliares';

const equipe = [
  {
    id: 1,
    nome: 'Fulano de Tal',
    email: 'fulano@exemplo.test',
    contato: null,
    perfil: 'chefe',
    situacao: 'ativo',
    habilitacoes: ['AT', 'AG'],
    temFoto: false,
    criadoEm: '2026-11-12T12:00:00.000Z',
  },
  {
    id: 2,
    nome: 'Beltrana',
    email: 'beltrana@exemplo.test',
    contato: null,
    perfil: 'assessor_interno',
    situacao: 'ativo',
    habilitacoes: ['AT'],
    temFoto: false,
    criadoEm: '2026-11-12T12:00:00.000Z',
  },
  {
    id: 3,
    nome: 'Administrador',
    email: 'adm@exemplo.test',
    contato: null,
    perfil: 'administrador',
    situacao: 'ativo',
    habilitacoes: ['AT', 'AG', 'LG', 'FI'],
    temFoto: false,
    criadoEm: '2026-11-12T12:00:00.000Z',
  },
];

const base = (perfil: 'chefe' | 'supervisor') => ({
  'GET /api/acesso/sessao': { corpo: sessaoDe(perfil) },
  'GET /api/gabinete': {
    status: 404,
    corpo: { codigo: 'nao_encontrado', mensagem: 'Não encontrado.' },
  },
  'GET /api/equipe': { corpo: equipe },
});

describe('equipe', () => {
  it('lista a equipe com perfis e habilitações em português', async () => {
    simularApi(base('chefe'));
    renderizar('/g/equipe');

    const tabela = await screen.findByRole('table', { name: 'Usuários do gabinete' });
    expect(within(tabela).getByText('Chefe de Gabinete')).toBeInTheDocument();
    expect(within(tabela).getByText('Atendimento, Agenda')).toBeInTheDocument();
    expect(within(tabela).getByText('Fulano de Tal (você)', { exact: false })).toBeInTheDocument();
  });

  it('quem não administra a equipe não vê cadastro nem ações', async () => {
    simularApi(base('supervisor'));
    renderizar('/g/equipe');
    await screen.findByRole('table', { name: 'Usuários do gabinete' });
    expect(screen.queryByRole('button', { name: 'Novo usuário' })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Ações' })).not.toBeInTheDocument();
  });

  it('o Chefe só vê "Gerenciar" para quem pode alterar (não o Administrador nem ele mesmo)', async () => {
    simularApi(base('chefe'));
    renderizar('/g/equipe');
    await screen.findByRole('table', { name: 'Usuários do gabinete' });
    expect(screen.getAllByRole('button', { name: 'Gerenciar' })).toHaveLength(1);
  });

  it('o cadastro só oferece os perfis que o Chefe pode conceder', async () => {
    simularApi(base('chefe'));
    const usuario = userEvent.setup();
    renderizar('/g/equipe');

    await usuario.click(await screen.findByRole('button', { name: 'Novo usuário' }));
    const opcoes = within(screen.getByLabelText('Perfil'))
      .getAllByRole('option')
      .map((o) => o.textContent);
    expect(opcoes).toEqual([
      'Chefe de Gabinete',
      'Supervisor',
      'Assessor Interno',
      'Assessor Externo',
    ]);
  });

  it('mostra a senha inicial uma única vez, e some ao fechar', async () => {
    simularApi({
      ...base('chefe'),
      'POST /api/equipe': {
        status: 201,
        corpo: {
          ...equipe[1],
          id: 9,
          nome: 'Novo Usuário',
          senhaInicial: 'SenhaInicial1234567890',
          senhaInicialValidaAte: '2026-11-15T12:00:00.000Z',
        },
      },
    });
    const usuario = userEvent.setup();
    renderizar('/g/equipe');

    await usuario.click(await screen.findByRole('button', { name: 'Novo usuário' }));
    await usuario.type(screen.getByLabelText('Nome completo'), 'Novo Usuário');
    await usuario.type(screen.getByLabelText('E-mail'), 'novo@exemplo.test');
    await usuario.click(screen.getByRole('button', { name: 'Criar usuário' }));

    expect(await screen.findByText('SenhaInicial1234567890')).toBeInTheDocument();
    expect(screen.getByText(/uma única vez/)).toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: 'Já anotei, fechar' }));
    expect(screen.queryByText('SenhaInicial1234567890')).not.toBeInTheDocument();
  });

  it('mostra o erro da API ao cadastrar e-mail repetido', async () => {
    simularApi({
      ...base('chefe'),
      'POST /api/equipe': {
        status: 409,
        corpo: { codigo: 'conflito', mensagem: 'Já existe um usuário com esse e-mail.' },
      },
    });
    const usuario = userEvent.setup();
    renderizar('/g/equipe');

    await usuario.click(await screen.findByRole('button', { name: 'Novo usuário' }));
    await usuario.type(screen.getByLabelText('Nome completo'), 'Repetido');
    await usuario.type(screen.getByLabelText('E-mail'), 'fulano@exemplo.test');
    await usuario.click(screen.getByRole('button', { name: 'Criar usuário' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Já existe um usuário com esse e-mail.',
    );
  });
});
