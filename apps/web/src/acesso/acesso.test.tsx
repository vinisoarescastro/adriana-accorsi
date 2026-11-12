import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderizar, semSessao, sessaoDe, simularApi } from '../teste/auxiliares';

describe('entrar', () => {
  it('sem sessão, qualquer endereço leva à tela de entrada', async () => {
    simularApi({ 'GET /api/acesso/sessao': semSessao });
    renderizar('/g/equipe');
    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
  });

  it('mostra a mensagem única de credenciais inválidas e não entra', async () => {
    const chamadas = simularApi({
      'GET /api/acesso/sessao': semSessao,
      'POST /api/acesso/entrar': {
        status: 401,
        corpo: {
          codigo: 'credenciais_invalidas',
          mensagem:
            'E-mail ou senha incorretos, ou acesso temporariamente bloqueado. Tente novamente em alguns minutos.',
        },
      },
    });
    const usuario = userEvent.setup();
    renderizar('/entrar');

    await usuario.type(await screen.findByLabelText('E-mail'), 'alguem@exemplo.test');
    await usuario.type(screen.getByLabelText('Senha'), 'errada');
    await usuario.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/E-mail ou senha incorretos/);
    expect(screen.getByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
    const envio = chamadas.find((c) => c.metodo === 'POST');
    expect(envio?.corpo).toEqual({ email: 'alguem@exemplo.test', senha: 'errada' });
  });

  it('entra e vai para o painel, com a barra do perfil', async () => {
    simularApi({
      'GET /api/acesso/sessao': semSessao,
      'POST /api/acesso/entrar': { corpo: sessaoDe('chefe') },
      'GET /api/gabinete': {
        corpo: {
          nome: 'Gabinete de Exemplo',
          parlamentarNome: 'Parlamentar de Exemplo',
          cargo: 'Deputado(a) Federal',
          temFoto: false,
        },
      },
      'GET /api/equipe': { corpo: [] },
    });
    const usuario = userEvent.setup();
    renderizar('/entrar');

    await usuario.type(await screen.findByLabelText('E-mail'), 'chefe@exemplo.test');
    await usuario.type(screen.getByLabelText('Senha'), 'uma-senha-boa-123');
    await usuario.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByRole('heading', { name: 'Painel' })).toBeInTheDocument();
    expect(await screen.findByText('Gabinete de Exemplo')).toBeInTheDocument();
  });
});

describe('primeiro acesso', () => {
  it('a sessão com senha inicial só chega à troca de senha, de qualquer endereço', async () => {
    simularApi({
      'GET /api/acesso/sessao': { corpo: sessaoDe('supervisor', { trocaObrigatoria: true }) },
    });
    renderizar('/g/equipe');
    expect(
      await screen.findByRole('heading', { name: 'Troque a senha inicial' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('confere a repetição da senha antes de enviar', async () => {
    simularApi({
      'GET /api/acesso/sessao': { corpo: sessaoDe('supervisor', { trocaObrigatoria: true }) },
    });
    const usuario = userEvent.setup();
    renderizar('/trocar-senha');

    await usuario.type(await screen.findByLabelText('Senha atual'), 'inicial');
    await usuario.type(screen.getByLabelText('Nova senha'), 'uma-senha-nova-2026');
    await usuario.type(screen.getByLabelText('Repita a nova senha'), 'diferente');

    expect(screen.getByText('As senhas não são iguais.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Trocar senha' })).toBeDisabled();
  });

  it('mostra os problemas que a API aponta na senha nova', async () => {
    simularApi({
      'GET /api/acesso/sessao': { corpo: sessaoDe('supervisor', { trocaObrigatoria: true }) },
      'POST /api/acesso/trocar-senha': {
        status: 422,
        corpo: {
          codigo: 'senha_fraca',
          mensagem: 'A nova senha não atende às regras.',
          detalhes: ['A senha deve ter ao menos 10 caracteres.'],
        },
      },
    });
    const usuario = userEvent.setup();
    renderizar('/trocar-senha');

    await usuario.type(await screen.findByLabelText('Senha atual'), 'inicial');
    await usuario.type(screen.getByLabelText('Nova senha'), 'curta');
    await usuario.type(screen.getByLabelText('Repita a nova senha'), 'curta');
    await usuario.click(screen.getByRole('button', { name: 'Trocar senha' }));

    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('A nova senha não atende às regras.');
    expect(alerta).toHaveTextContent('ao menos 10 caracteres');
  });

  it('depois da troca, segue para o painel', async () => {
    let trocou = false;
    simularApi({
      'GET /api/acesso/sessao': () => ({
        corpo: sessaoDe('supervisor', { trocaObrigatoria: !trocou }),
      }),
      'POST /api/acesso/trocar-senha': () => {
        trocou = true;
        return { status: 204 };
      },
      'GET /api/gabinete': {
        status: 404,
        corpo: { codigo: 'nao_encontrado', mensagem: 'Não encontrado.' },
      },
      'GET /api/equipe': { corpo: [] },
    });
    const usuario = userEvent.setup();
    renderizar('/trocar-senha');

    await usuario.type(await screen.findByLabelText('Senha atual'), 'inicial');
    await usuario.type(screen.getByLabelText('Nova senha'), 'uma-senha-nova-2026');
    await usuario.type(screen.getByLabelText('Repita a nova senha'), 'uma-senha-nova-2026');
    await usuario.click(screen.getByRole('button', { name: 'Trocar senha' }));

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Painel' })).toBeInTheDocument(),
    );
  });
});
