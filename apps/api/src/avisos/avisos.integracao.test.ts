/* eslint-disable @typescript-eslint/no-explicit-any -- corpos JSON das respostas, sem tipo */
import { afterEach, describe, expect, it } from 'vitest';
import { a, preparar, registrar } from '../demandas/auxiliares-de-demandas.js';

afterEach(async () => {
  await a.encerrar();
});

const criarTarefa = (cookie: string, corpo: object = {}) =>
  a.chamar('POST', '/api/tarefas', {
    cookie,
    corpo: { titulo: 'Ligar para a prefeitura', ...corpo },
  });

const caixa = async (cookie: string) =>
  (await a.chamar('GET', '/api/avisos', { cookie })).json() as {
    itens: any[];
    naoLidos: number;
  };

describe('a caixa de avisos', () => {
  it('quem recebe uma tarefa vê o aviso, com a frase da natureza e o título do registro', async () => {
    const e = await preparar();
    const t = (await criarTarefa(e.cookie.supervisor, { responsavelId: e.id.interno })).json();
    const c = await caixa(e.cookie.interno);
    expect(c.naoLidos).toBe(1);
    expect(c.itens[0]).toMatchObject({
      natureza: 'tarefa_designada',
      frase: 'Uma tarefa foi designada a você',
      registro: { tipo: 'tarefa', id: t.id, titulo: 'Ligar para a prefeitura' },
      lido: false,
    });
    // Quem designou não é avisado.
    expect((await caixa(e.cookie.supervisor)).itens).toHaveLength(0);
  });

  it('cada um vê só a própria caixa', async () => {
    const e = await preparar();
    await criarTarefa(e.cookie.supervisor, { responsavelId: e.id.interno });
    expect((await caixa(e.cookie.externo)).itens).toHaveLength(0);
    expect((await caixa(e.cookie.admin)).itens).toHaveLength(0);
  });

  it('marcar como lido: um, todos, e só os próprios', async () => {
    const e = await preparar();
    await criarTarefa(e.cookie.supervisor, { responsavelId: e.id.interno });
    await criarTarefa(e.cookie.supervisor, { responsavelId: e.id.interno, titulo: 'Outra' });
    const c = await caixa(e.cookie.interno);
    expect(c.naoLidos).toBe(2);

    // Marcar o aviso de outra pessoa não faz nada.
    await a.chamar('POST', '/api/avisos/lidos', {
      cookie: e.cookie.externo,
      corpo: { todos: true },
    });
    expect((await caixa(e.cookie.interno)).naoLidos).toBe(2);

    const um = await a.chamar('POST', '/api/avisos/lidos', {
      cookie: e.cookie.interno,
      corpo: { ids: [c.itens[0].id] },
    });
    expect(um.json().naoLidos).toBe(1);
    const todos = await a.chamar('POST', '/api/avisos/lidos', {
      cookie: e.cookie.interno,
      corpo: { todos: true },
    });
    expect(todos.json().naoLidos).toBe(0);
    expect(todos.json().itens.every((i: any) => i.lido)).toBe(true);
    expect(
      (await a.chamar('POST', '/api/avisos/lidos', { cookie: e.cookie.interno, corpo: {} }))
        .statusCode,
    ).toBe(400);
  });

  it('lido, o aviso passa a expirar em 30 dias; o aviso novo expira em 60', async () => {
    const e = await preparar();
    await criarTarefa(e.cookie.supervisor, { responsavelId: e.id.interno });
    const { cliente } = a.banco.conectar('api');
    const dias = async () =>
      Number(
        (
          await cliente<{ d: string }[]>`
            SELECT round(extract(epoch FROM (expira_em - gerado_em)) / 86400) AS d FROM aviso`
        )[0]!.d,
      );
    expect(await dias()).toBeCloseTo(60, 0);
    a.relogio.avancar(24 * 3600 * 1000);
    // A sessão não atravessa um dia: entra de novo.
    const cookie = await a.sessaoDe(e.contas.interno.email);
    const marcado = await a.chamar('POST', '/api/avisos/lidos', {
      cookie,
      corpo: { todos: true },
    });
    expect(marcado.statusCode, marcado.body).toBe(200);
    const [r] = await cliente<{ d: string }[]>`
      SELECT round(extract(epoch FROM (expira_em - lido_em)) / 86400) AS d FROM aviso`;
    expect(Number(r!.d)).toBe(30);
  });

  it('aviso expirado não aparece', async () => {
    const e = await preparar();
    await criarTarefa(e.cookie.supervisor, { responsavelId: e.id.interno });
    a.relogio.avancar(61 * 24 * 3600 * 1000);
    expect((await caixa(await a.sessaoDe(e.contas.interno.email))).itens).toHaveLength(0);
  });
});

describe('alcance do registro de origem', () => {
  it('quem perde o alcance deixa de ver o aviso', async () => {
    const e = await preparar();
    const t = (await criarTarefa(e.cookie.supervisor, { responsavelId: e.id.externo })).json();
    expect((await caixa(e.cookie.externo)).itens).toHaveLength(1);
    // Reatribuída a outra pessoa, a tarefa deixa de ser do Externo: o aviso some para ele.
    await a.chamar('POST', `/api/tarefas/${t.id}/reatribuir`, {
      cookie: e.cookie.supervisor,
      corpo: { responsavelId: e.id.interno },
    });
    const depois = await caixa(e.cookie.externo);
    expect(depois.itens).toHaveLength(0);
    expect(depois.naoLidos).toBe(0);
  });

  it('o aviso de menção só aparece a quem alcança a demanda', async () => {
    const e = await preparar();
    const d = (await registrar(e.cookie.interno)).demanda;
    const r = await a.chamar('POST', `/api/demandas/${d.id}/comentarios`, {
      cookie: e.cookie.interno,
      corpo: {
        texto: 'Veja isto @supervisor',
        mencoes: [e.id.supervisor, e.id.externo, e.id.semAtendimento],
      },
    });
    expect(r.statusCode, r.body).toBe(201);

    const doSupervisor = await caixa(e.cookie.supervisor);
    expect(doSupervisor.itens).toHaveLength(1);
    expect(doSupervisor.itens[0]).toMatchObject({
      natureza: 'mencao',
      registro: { tipo: 'demanda', id: d.id },
    });
    // O texto do comentário nunca vai no aviso.
    expect(JSON.stringify(doSupervisor)).not.toContain('Veja isto');
    // O Externo (demanda não é dele) e quem não tem Atendimento não recebem nem veem.
    expect((await caixa(e.cookie.externo)).itens).toHaveLength(0);
    const { cliente } = a.banco.conectar('api');
    const destinatarios = await cliente<{ destinatario_id: string }[]>`
      SELECT destinatario_id FROM aviso WHERE natureza = 'mencao'`;
    expect(destinatarios.map((x) => Number(x.destinatario_id))).not.toContain(e.id.semAtendimento);
  });

  it('o aviso não leva texto, dado pessoal nem valor', async () => {
    const e = await preparar();
    const d = (await registrar(e.cookie.interno)).demanda;
    await a.chamar('POST', `/api/demandas/${d.id}/comentarios`, {
      cookie: e.cookie.interno,
      corpo: { texto: 'segredo do comentário', mencoes: [e.id.supervisor] },
    });
    const { cliente } = a.banco.conectar('api');
    const colunas = await cliente<{ column_name: string; data_type: string }[]>`
      SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'aviso'`;
    const texto = colunas.filter((c) => c.data_type === 'text').map((c) => c.column_name);
    expect(texto.sort()).toEqual(['chave_unica', 'natureza', 'registro_tipo']);
    const linhas = JSON.stringify(await cliente`SELECT * FROM aviso`);
    expect(linhas).not.toContain('segredo');
    expect(linhas).not.toContain('Maria');
  });
});

describe('antecedência do aviso de prazo', () => {
  it('padrão de 3 dias, configurável de 1 a 30 pelo Chefe, com trilha', async () => {
    const e = await preparar();
    const get = async (cookie: string) => a.chamar('GET', '/api/avisos/configuracao', { cookie });
    expect((await get(e.cookie.chefe)).json()).toEqual({ antecedenciaDias: 3 });

    const ok = await a.chamar('PUT', '/api/avisos/configuracao', {
      cookie: e.cookie.chefe,
      corpo: { antecedenciaDias: 7 },
    });
    expect(ok.statusCode, ok.body).toBe(200);
    expect((await get(e.cookie.chefe)).json()).toEqual({ antecedenciaDias: 7 });
    expect((await a.trilha('avisos.configurar')).length).toBe(1);

    for (const invalido of [0, 31, 2.5]) {
      expect(
        (
          await a.chamar('PUT', '/api/avisos/configuracao', {
            cookie: e.cookie.chefe,
            corpo: { antecedenciaDias: invalido },
          })
        ).statusCode,
      ).toBe(400);
    }
    // O Supervisor não alcança: a rota responde como inexistente.
    expect((await get(e.cookie.supervisor)).statusCode).toBe(404);
  });
});
