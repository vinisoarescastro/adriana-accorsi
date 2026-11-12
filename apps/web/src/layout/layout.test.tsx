import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderizar, semSessao, sessaoDe, simularApi } from '../teste/auxiliares';

const gabinete404 = {
  status: 404,
  corpo: { codigo: 'nao_encontrado', mensagem: 'Não encontrado.' },
};

describe('navegação', () => {
  it('a barra mostra só as páginas que o servidor diz que a sessão alcança', async () => {
    simularApi({
      'GET /api/acesso/sessao': {
        corpo: sessaoDe('assessor_externo', {
          paginas: ['painel', 'equipe', 'fluxos', 'configuracoes'],
        }),
      },
      'GET /api/gabinete': gabinete404,
      'GET /api/equipe': { corpo: [] },
    });
    renderizar('/g/painel');

    const menu = await screen.findByRole('navigation');
    const links = within(menu)
      .getAllByRole('link')
      .map((l) => l.textContent);
    expect(links).toEqual(['Painel', 'Equipe', 'Fluxos', 'Configurações', 'Meu perfil']);
    expect(within(menu).queryByText('Auditoria')).not.toBeInTheDocument();
  });

  it('página que o servidor não liberou responde como inexistente, mesmo digitando o endereço', async () => {
    simularApi({
      'GET /api/acesso/sessao': {
        corpo: sessaoDe('supervisor', { paginas: ['painel', 'equipe'] }),
      },
      'GET /api/gabinete': gabinete404,
      'GET /api/equipe': { corpo: [] },
    });
    renderizar('/g/auditoria');
    expect(
      await screen.findByRole('heading', { name: 'Página não encontrada' }),
    ).toBeInTheDocument();
  });

  it('sair encerra a sessão e volta para a entrada', async () => {
    let saiu = false;
    const chamadas = simularApi({
      'GET /api/acesso/sessao': () => (saiu ? semSessao : { corpo: sessaoDe('chefe') }),
      'POST /api/acesso/sair': () => {
        saiu = true;
        return { status: 204 };
      },
      'GET /api/gabinete': gabinete404,
      'GET /api/equipe': { corpo: [] },
    });
    const usuario = userEvent.setup();
    renderizar('/g/painel');

    await usuario.click(await screen.findByRole('button', { name: 'Sair' }));
    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
    expect(chamadas.some((c) => c.metodo === 'POST' && c.caminho === '/api/acesso/sair')).toBe(
      true,
    );
  });

  it('tem link para pular ao conteúdo e o menu é navegável por teclado', async () => {
    simularApi({
      'GET /api/acesso/sessao': { corpo: sessaoDe('chefe') },
      'GET /api/gabinete': gabinete404,
      'GET /api/equipe': { corpo: [] },
    });
    renderizar('/g/painel');
    expect(await screen.findByRole('link', { name: 'Pular para o conteúdo' })).toHaveAttribute(
      'href',
      '#conteudo',
    );
    expect(screen.getByRole('button', { name: 'Abrir o menu' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });
});
