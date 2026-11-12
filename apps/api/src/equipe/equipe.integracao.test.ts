import { afterEach, describe, expect, inject, it } from 'vitest';
import { iniciarAmbiente, senhaDeTeste, type Ambiente } from '../teste/auxiliares.js';

let a: Ambiente;
afterEach(async () => {
  await a.encerrar();
});

/** Ambiente com um administrador, um chefe (todas as habilitações) e cookies prontos. */
async function preparar() {
  a = await iniciarAmbiente(inject('urlAdminDeTeste'));
  const admin = await a.criarUsuario({ perfil: 'administrador' });
  const chefe = await a.criarUsuario({ perfil: 'chefe', habilitacoes: ['AT', 'AG', 'LG', 'FI'] });
  return {
    admin,
    chefe,
    cookieAdmin: await a.sessaoDe(admin.email),
    cookieChefe: await a.sessaoDe(chefe.email),
  };
}

const novoUsuario = (perfil: string, extra: object = {}) => ({
  nome: `Fulano ${perfil}`,
  email: `${perfil}.${Math.random().toString(36).slice(2, 8)}@exemplo.test`,
  perfil,
  ...extra,
});

describe('criar usuários', () => {
  it('o administrador cria um usuário de cada perfil; a senha inicial aparece só na criação', async () => {
    const { cookieAdmin } = await preparar();

    for (const perfil of ['supervisor', 'assessor_interno', 'assessor_externo', 'chefe']) {
      const resposta = await a.chamar('POST', '/api/equipe', {
        cookie: cookieAdmin,
        corpo: novoUsuario(perfil, { habilitacoes: ['AT'] }),
      });
      expect(resposta.statusCode, resposta.body).toBe(201);
      const corpo = resposta.json();
      expect(corpo.senhaInicial).toHaveLength(20);
      expect(corpo.perfil).toBe(perfil);
      expect(corpo.habilitacoes).toEqual(['AT']);

      const lido = await a.chamar('GET', `/api/equipe/${corpo.id}`, { cookie: cookieAdmin });
      expect(lido.body).not.toContain(corpo.senhaInicial);
      expect(lido.json()).not.toHaveProperty('senhaInicial');
    }
    const todos = (await a.chamar('GET', '/api/equipe', { cookie: cookieAdmin })).json();
    expect(todos).toHaveLength(6);
    expect(JSON.stringify(todos)).not.toMatch(/verificador|argon2/);
  });

  it('o novo usuário entra com a senha inicial e só consegue trocar a senha', async () => {
    const { cookieAdmin } = await preparar();
    const criado = (
      await a.chamar('POST', '/api/equipe', {
        cookie: cookieAdmin,
        corpo: novoUsuario('supervisor', { habilitacoes: ['AT'] }),
      })
    ).json();

    const entrada = await a.entrar(criado.email, criado.senhaInicial);
    expect(entrada.statusCode).toBe(200);
    expect(entrada.json().senhaTrocaObrigatoria).toBe(true);
  });

  it('administrador e parlamentar recebem todas as habilitações, não removíveis', async () => {
    const { cookieAdmin } = await preparar();
    const parlamentar = (
      await a.chamar('POST', '/api/equipe', {
        cookie: cookieAdmin,
        corpo: novoUsuario('parlamentar'),
      })
    ).json();
    expect(parlamentar.habilitacoes).toEqual(['AG', 'AT', 'FI', 'LG']);

    const remover = await a.chamar('PUT', `/api/equipe/${parlamentar.id}/habilitacoes`, {
      cookie: cookieAdmin,
      corpo: { habilitacoes: ['AT'] },
    });
    expect(remover.statusCode).toBe(403);
  });

  it('só existe um Parlamentar ativo', async () => {
    const { cookieAdmin } = await preparar();
    const primeiro = await a.chamar('POST', '/api/equipe', {
      cookie: cookieAdmin,
      corpo: novoUsuario('parlamentar'),
    });
    const segundo = await a.chamar('POST', '/api/equipe', {
      cookie: cookieAdmin,
      corpo: novoUsuario('parlamentar'),
    });
    expect(primeiro.statusCode).toBe(201);
    expect(segundo.statusCode).toBe(409);
    expect(segundo.json().mensagem).toMatch(/Parlamentar/);
  });

  it('e-mail repetido e dados inválidos são recusados', async () => {
    const { cookieAdmin, chefe } = await preparar();
    const repetido = await a.chamar('POST', '/api/equipe', {
      cookie: cookieAdmin,
      corpo: novoUsuario('supervisor', { email: chefe.email.toUpperCase() }),
    });
    expect(repetido.statusCode).toBe(409);

    const invalido = await a.chamar('POST', '/api/equipe', {
      cookie: cookieAdmin,
      corpo: { nome: '', email: 'sem-arroba', perfil: 'rei' },
    });
    expect(invalido.statusCode).toBe(400);
  });
});

describe('regras de concessão', () => {
  it('o Chefe não concede Administrador nem Parlamentar, mas concede perfis abaixo e iguais', async () => {
    const { cookieChefe } = await preparar();
    for (const perfil of ['administrador', 'parlamentar']) {
      const r = await a.chamar('POST', '/api/equipe', {
        cookie: cookieChefe,
        corpo: novoUsuario(perfil),
      });
      expect(r.statusCode, perfil).toBe(403);
    }
    for (const perfil of ['chefe', 'supervisor', 'assessor_interno', 'assessor_externo']) {
      const r = await a.chamar('POST', '/api/equipe', {
        cookie: cookieChefe,
        corpo: novoUsuario(perfil, { habilitacoes: ['AT'] }),
      });
      expect(r.statusCode, perfil).toBe(201);
    }
  });

  it('ninguém concede habilitação que não possui', async () => {
    const { cookieAdmin } = await preparar();
    const limitado = await a.criarUsuario({ perfil: 'chefe', habilitacoes: ['AT'] });
    const cookieLimitado = await a.sessaoDe(limitado.email);

    const recusada = await a.chamar('POST', '/api/equipe', {
      cookie: cookieLimitado,
      corpo: novoUsuario('supervisor', { habilitacoes: ['AT', 'FI'] }),
    });
    expect(recusada.statusCode).toBe(403);
    expect(recusada.json().mensagem).toMatch(/não possui/);

    const aceita = await a.chamar('POST', '/api/equipe', {
      cookie: cookieAdmin,
      corpo: novoUsuario('supervisor', { habilitacoes: ['FI'] }),
    });
    expect(aceita.statusCode).toBe(201);
  });

  it('quem não administra a equipe recebe 404, e o Parlamentar também', async () => {
    const { admin, cookieAdmin } = await preparar();
    const supervisor = await a.criarUsuario({ perfil: 'supervisor' });
    const parlamentar = await a.criarUsuario({ perfil: 'parlamentar' });
    for (const email of [supervisor.email, parlamentar.email]) {
      const cookie = await a.sessaoDe(email);
      const r = await a.chamar('POST', '/api/equipe', {
        cookie,
        corpo: novoUsuario('assessor_externo'),
      });
      expect(r.statusCode).toBe(404);
      // Mas veem a equipe.
      expect((await a.chamar('GET', '/api/equipe', { cookie })).statusCode).toBe(200);
    }
    void admin;
    void cookieAdmin;
  });

  it('o Chefe não altera Administrador nem Parlamentar, e ninguém altera o próprio perfil', async () => {
    const { admin, chefe, cookieAdmin, cookieChefe } = await preparar();
    const parlamentar = (
      await a.chamar('POST', '/api/equipe', {
        cookie: cookieAdmin,
        corpo: novoUsuario('parlamentar'),
      })
    ).json();

    const contraAdmin = await a.chamar(
      'PUT',
      `/api/equipe/${(await usuarioPorEmail(admin.email)).id}/situacao`,
      {
        cookie: cookieChefe,
        corpo: { situacao: 'inativo' },
      },
    );
    expect(contraAdmin.statusCode).toBe(403);
    expect(
      (
        await a.chamar('POST', `/api/equipe/${parlamentar.id}/redefinir-senha`, {
          cookie: cookieChefe,
        })
      ).statusCode,
    ).toBe(403);

    const proprio = await a.chamar(
      'PUT',
      `/api/equipe/${(await usuarioPorEmail(chefe.email)).id}/perfil`,
      {
        cookie: cookieChefe,
        corpo: { perfil: 'administrador' },
      },
    );
    expect(proprio.statusCode).toBe(403);
  });
});

async function usuarioPorEmail(email: string): Promise<{ id: number }> {
  const [linha] = await a.banco.conectar('api').cliente<{ id: string }[]>`
    SELECT u.id FROM usuario u JOIN conta_acesso c ON c.id = u.conta_id WHERE c.email = ${email}`;
  return { id: Number(linha?.id) };
}

describe('alterações encerram as sessões do usuário no ato', () => {
  it('mudar perfil, situação ou habilitações derruba as sessões dele', async () => {
    const { cookieAdmin } = await preparar();
    const alvo = await a.criarUsuario({ perfil: 'assessor_interno', habilitacoes: ['AT'] });
    const { id } = await usuarioPorEmail(alvo.email);

    const abrir = async () => {
      const cookie = await a.sessaoDe(alvo.email);
      expect((await a.chamar('GET', '/api/acesso/sessao', { cookie })).statusCode).toBe(200);
      return cookie;
    };

    let cookie = await abrir();
    expect(
      (
        await a.chamar('PUT', `/api/equipe/${id}/perfil`, {
          cookie: cookieAdmin,
          corpo: { perfil: 'supervisor' },
        })
      ).statusCode,
    ).toBe(200);
    expect((await a.chamar('GET', '/api/acesso/sessao', { cookie })).statusCode).toBe(401);

    cookie = await abrir();
    expect(
      (
        await a.chamar('PUT', `/api/equipe/${id}/habilitacoes`, {
          cookie: cookieAdmin,
          corpo: { habilitacoes: ['AT', 'AG'] },
        })
      ).statusCode,
    ).toBe(200);
    expect((await a.chamar('GET', '/api/acesso/sessao', { cookie })).statusCode).toBe(401);

    cookie = await abrir();
    expect(
      (
        await a.chamar('PUT', `/api/equipe/${id}/situacao`, {
          cookie: cookieAdmin,
          corpo: { situacao: 'inativo' },
        })
      ).statusCode,
    ).toBe(200);
    expect((await a.chamar('GET', '/api/acesso/sessao', { cookie })).statusCode).toBe(401);
    expect((await a.entrar(alvo.email, senhaDeTeste)).statusCode).toBe(401);
  });

  it('redefinir a senha gera nova senha inicial, derruba sessões e exige a troca', async () => {
    const { cookieAdmin } = await preparar();
    const alvo = await a.criarUsuario({ perfil: 'supervisor' });
    const { id } = await usuarioPorEmail(alvo.email);
    const cookie = await a.sessaoDe(alvo.email);

    const redefinida = await a.chamar('POST', `/api/equipe/${id}/redefinir-senha`, {
      cookie: cookieAdmin,
    });
    expect(redefinida.statusCode).toBe(200);
    const { senhaInicial } = redefinida.json();

    expect((await a.chamar('GET', '/api/acesso/sessao', { cookie })).statusCode).toBe(401);
    expect((await a.entrar(alvo.email, senhaDeTeste)).statusCode).toBe(401);
    const novaEntrada = await a.entrar(alvo.email, senhaInicial);
    expect(novaEntrada.statusCode).toBe(200);
    expect(novaEntrada.json().senhaTrocaObrigatoria).toBe(true);
    expect(JSON.stringify(await a.trilha())).not.toContain(senhaInicial);
  });

  it('atualizar nome e contato; e o histórico mostra quem fez o quê', async () => {
    const { admin, cookieAdmin, cookieChefe } = await preparar();
    const alvo = await a.criarUsuario({ perfil: 'assessor_externo' });
    const { id } = await usuarioPorEmail(alvo.email);

    const r = await a.chamar('PATCH', `/api/equipe/${id}`, {
      cookie: cookieAdmin,
      corpo: { nome: 'Novo Nome', contato: '(67) 99999-0000' },
    });
    expect(r.json()).toMatchObject({ nome: 'Novo Nome', contato: '(67) 99999-0000' });

    const historico = (
      await a.chamar('GET', `/api/equipe/${id}/historico`, { cookie: cookieChefe })
    ).json();
    const atualizacao = historico.find(
      (h: { operacao: string }) => h.operacao === 'equipe.atualizar',
    );
    expect(atualizacao.valorAnterior).toMatchObject({ nome: expect.any(String) as unknown });
    expect(atualizacao.valorNovo).toMatchObject({ nome: 'Novo Nome' });
    expect(atualizacao.autorId).toBe((await usuarioPorEmail(admin.email)).id);
  });
});
