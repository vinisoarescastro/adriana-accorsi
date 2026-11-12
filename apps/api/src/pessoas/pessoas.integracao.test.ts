import { afterEach, describe, expect, inject, it } from 'vitest';
import { iniciarAmbiente, type Ambiente } from '../teste/auxiliares.js';

let a: Ambiente;
afterEach(async () => {
  await a.encerrar();
});

async function preparar() {
  a = await iniciarAmbiente(inject('urlAdminDeTeste'));
  const admin = await a.criarUsuario({ perfil: 'administrador' });
  const supervisor = await a.criarUsuario({ perfil: 'supervisor', habilitacoes: ['AT'] });
  const interno = await a.criarUsuario({ perfil: 'assessor_interno', habilitacoes: ['AT'] });
  const externo = await a.criarUsuario({ perfil: 'assessor_externo', habilitacoes: ['AT'] });
  const semAtendimento = await a.criarUsuario({ perfil: 'supervisor', habilitacoes: ['AG'] });
  return {
    cookieAdmin: await a.sessaoDe(admin.email),
    cookieSupervisor: await a.sessaoDe(supervisor.email),
    cookieInterno: await a.sessaoDe(interno.email),
    cookieExterno: await a.sessaoDe(externo.email),
    cookieSemAtendimento: await a.sessaoDe(semAtendimento.email),
  };
}

const maria = { nome: 'Maria da Silva', telefone: '(67) 99999-0000' };

describe('cadastro', () => {
  it('cadastra com o telefone normalizado e aceita qualquer forma de escrever o número', async () => {
    const { cookieInterno } = await preparar();
    const criada = await a.chamar('POST', '/api/pessoas', { cookie: cookieInterno, corpo: maria });
    expect(criada.statusCode, criada.body).toBe(201);
    expect(criada.json()).toMatchObject({
      nomeCompleto: 'Maria da Silva',
      telefone: '(67) 99999-0000',
      situacao: 'ativa',
    });

    for (const forma of ['67999990000', '+55 67 99999-0000', '067 99999 0000']) {
      const achada = await a.chamar(
        'GET',
        `/api/pessoas/por-telefone?telefone=${encodeURIComponent(forma)}`,
        { cookie: cookieInterno },
      );
      expect(achada.json().pessoa?.id, forma).toBe(criada.json().id);
    }
    const nenhuma = await a.chamar('GET', '/api/pessoas/por-telefone?telefone=67988887777', {
      cookie: cookieInterno,
    });
    expect(nenhuma.json()).toEqual({ pessoa: null });
  });

  it('não há duas pessoas ativas com o mesmo telefone', async () => {
    const { cookieInterno } = await preparar();
    await a.chamar('POST', '/api/pessoas', { cookie: cookieInterno, corpo: maria });
    const repetida = await a.chamar('POST', '/api/pessoas', {
      cookie: cookieInterno,
      corpo: { nome: 'Outra Maria', telefone: '+55 67 99999-0000' },
    });
    expect(repetida.statusCode).toBe(409);
    expect(repetida.json().mensagem).toMatch(/telefone/);
  });

  it('recusa telefone e dados inválidos', async () => {
    const { cookieInterno } = await preparar();
    for (const corpo of [
      { nome: 'Maria', telefone: '123' },
      { nome: '', telefone: '67999990000' },
      { nome: 'Maria', telefone: '67999990000', email: 'sem-arroba' },
    ]) {
      expect(
        (await a.chamar('POST', '/api/pessoas', { cookie: cookieInterno, corpo })).statusCode,
      ).toBe(400);
    }
  });

  it('o Assessor Externo consulta mas não mantém; quem não tem AT recebe 404', async () => {
    const { cookieExterno, cookieSemAtendimento, cookieInterno } = await preparar();
    expect(
      (await a.chamar('POST', '/api/pessoas', { cookie: cookieExterno, corpo: maria })).statusCode,
    ).toBe(404);
    expect((await a.chamar('GET', '/api/pessoas', { cookie: cookieExterno })).statusCode).toBe(200);
    expect(
      (await a.chamar('GET', '/api/pessoas', { cookie: cookieSemAtendimento })).statusCode,
    ).toBe(404);
    await a.chamar('POST', '/api/pessoas', { cookie: cookieInterno, corpo: maria });
    expect(
      (
        await a.chamar('GET', '/api/pessoas/por-telefone?telefone=67999990000', {
          cookie: cookieExterno,
        })
      ).statusCode,
    ).toBe(200);
  });
});

describe('alterar, listar e inativar', () => {
  it('altera dados (a trilha guarda só os nomes dos campos, nunca os valores)', async () => {
    const { cookieInterno } = await preparar();
    const { id } = (
      await a.chamar('POST', '/api/pessoas', { cookie: cookieInterno, corpo: maria })
    ).json();
    const r = await a.chamar('PATCH', `/api/pessoas/${id}`, {
      cookie: cookieInterno,
      corpo: {
        nome: 'Maria S. Souza',
        telefone: '(67) 98888-7777',
        endereco: 'Rua das Flores, 10',
      },
    });
    expect(r.json()).toMatchObject({ nomeCompleto: 'Maria S. Souza', telefone: '(67) 98888-7777' });

    const trilha = JSON.stringify(await a.trilha());
    expect(trilha).not.toMatch(/Maria|9999|8888|Flores/);
    const [atualizacao] = await a.trilha('pessoa.atualizar');
    expect(atualizacao?.valor_novo).toEqual({
      campos: ['nomeCompleto', 'telefoneNormalizado', 'endereco'],
    });
  });

  it('trocar para um telefone de outra pessoa ativa é recusado', async () => {
    const { cookieInterno } = await preparar();
    await a.chamar('POST', '/api/pessoas', { cookie: cookieInterno, corpo: maria });
    const outra = (
      await a.chamar('POST', '/api/pessoas', {
        cookie: cookieInterno,
        corpo: { nome: 'Joana', telefone: '67988887777' },
      })
    ).json();
    const r = await a.chamar('PATCH', `/api/pessoas/${outra.id}`, {
      cookie: cookieInterno,
      corpo: { telefone: '67999990000' },
    });
    expect(r.statusCode).toBe(409);
  });

  it('lista com busca por nome e por pedaço do telefone, paginada', async () => {
    const { cookieInterno } = await preparar();
    for (let i = 0; i < 30; i += 1) {
      await a.chamar('POST', '/api/pessoas', {
        cookie: cookieInterno,
        corpo: {
          nome: `Pessoa ${String(i).padStart(2, '0')}`,
          telefone: `6799000${String(1000 + i)}`,
        },
      });
    }
    const pagina1 = (await a.chamar('GET', '/api/pessoas', { cookie: cookieInterno })).json();
    expect(pagina1).toMatchObject({ total: 30, pagina: 1, porPagina: 25 });
    expect(pagina1.itens).toHaveLength(25);
    expect(
      (await a.chamar('GET', '/api/pessoas?pagina=2', { cookie: cookieInterno })).json().itens,
    ).toHaveLength(5);
    expect(
      (await a.chamar('GET', '/api/pessoas?busca=Pessoa 07', { cookie: cookieInterno })).json()
        .total,
    ).toBe(1);
    expect(
      (await a.chamar('GET', '/api/pessoas?busca=1015', { cookie: cookieInterno })).json().total,
    ).toBe(1);
    expect(
      (await a.chamar('GET', '/api/pessoas?busca=%25', { cookie: cookieInterno })).json().total,
    ).toBe(0);
    expect(
      (await a.chamar('GET', '/api/pessoas?porPagina=500', { cookie: cookieInterno })).statusCode,
    ).toBe(400);
  });

  it('só o Supervisor inativa; inativa libera o telefone, e reativar conflita se ele foi reutilizado', async () => {
    const { cookieInterno, cookieSupervisor } = await preparar();
    const { id } = (
      await a.chamar('POST', '/api/pessoas', { cookie: cookieInterno, corpo: maria })
    ).json();

    expect(
      (
        await a.chamar('PUT', `/api/pessoas/${id}/situacao`, {
          cookie: cookieInterno,
          corpo: { situacao: 'inativa' },
        })
      ).statusCode,
    ).toBe(404);
    const inativa = await a.chamar('PUT', `/api/pessoas/${id}/situacao`, {
      cookie: cookieSupervisor,
      corpo: { situacao: 'inativa' },
    });
    expect(inativa.json().situacao).toBe('inativa');
    expect(
      (
        await a.chamar('GET', '/api/pessoas/por-telefone?telefone=67999990000', {
          cookie: cookieInterno,
        })
      ).json().pessoa,
    ).toBeNull();

    expect(
      (await a.chamar('POST', '/api/pessoas', { cookie: cookieInterno, corpo: maria })).statusCode,
    ).toBe(201);
    const reativar = await a.chamar('PUT', `/api/pessoas/${id}/situacao`, {
      cookie: cookieSupervisor,
      corpo: { situacao: 'ativa' },
    });
    expect(reativar.statusCode).toBe(409);
  });
});

describe('eliminar dados pessoais', () => {
  it('só o Administrador, com confirmação; esvazia tudo e é irreversível', async () => {
    const { cookieAdmin, cookieSupervisor, cookieInterno } = await preparar();
    const { id } = (
      await a.chamar('POST', '/api/pessoas', {
        cookie: cookieInterno,
        corpo: {
          ...maria,
          email: 'maria@exemplo.test',
          contatos: 'whatsapp',
          endereco: 'Rua das Flores',
        },
      })
    ).json();

    expect(
      (
        await a.chamar('POST', `/api/pessoas/${id}/eliminar-dados`, {
          cookie: cookieSupervisor,
          corpo: { confirmo: true },
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (
        await a.chamar('POST', `/api/pessoas/${id}/eliminar-dados`, {
          cookie: cookieAdmin,
          corpo: {},
        })
      ).statusCode,
    ).toBe(400);

    const eliminada = await a.chamar('POST', `/api/pessoas/${id}/eliminar-dados`, {
      cookie: cookieAdmin,
      corpo: { confirmo: true },
    });
    expect(eliminada.statusCode).toBe(200);
    expect(eliminada.json()).toMatchObject({
      situacao: 'dados_eliminados',
      nomeCompleto: null,
      telefone: null,
      email: null,
      contatos: null,
      endereco: null,
    });

    expect(
      (
        await a.chamar('PATCH', `/api/pessoas/${id}`, {
          cookie: cookieInterno,
          corpo: { nome: 'Volta' },
        })
      ).statusCode,
    ).toBe(409);
    expect(
      (
        await a.chamar('GET', '/api/pessoas/por-telefone?telefone=67999990000', {
          cookie: cookieInterno,
        })
      ).json().pessoa,
    ).toBeNull();
    // O telefone volta a ficar livre para outra pessoa.
    expect(
      (await a.chamar('POST', '/api/pessoas', { cookie: cookieInterno, corpo: maria })).statusCode,
    ).toBe(201);
  });
});
