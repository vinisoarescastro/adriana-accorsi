import { afterEach, describe, expect, it } from 'vitest';
import { a, preparar, registrar } from './demandas/auxiliares-de-demandas.js';

afterEach(async () => {
  await a.encerrar();
});

describe('editar a descrição', () => {
  it('da demanda: grava, devolve na ficha e permite apagar', async () => {
    const e = await preparar();
    const d = (await registrar(e.cookie.supervisor)).demanda;
    const r = await a.chamar('PATCH', `/api/demandas/${d.id}`, {
      cookie: e.cookie.supervisor,
      corpo: {
        titulo: d.titulo,
        descricao: 'Nova descrição',
        mencoes: [],
        prioridade: 'media',
        prazo: null,
      },
    });
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().descricao).toBe('Nova descrição');
    const ficha = (
      await a.chamar('GET', `/api/demandas/${d.id}`, { cookie: e.cookie.supervisor })
    ).json();
    expect(ficha.descricao).toBe('Nova descrição');
    const apagada = await a.chamar('PATCH', `/api/demandas/${d.id}`, {
      cookie: e.cookie.supervisor,
      corpo: { descricao: null, mencoes: [] },
    });
    expect(apagada.statusCode, apagada.body).toBe(200);
    expect(apagada.json().descricao).toBeNull();
  });

  it('da tarefa: grava e devolve na ficha', async () => {
    const e = await preparar();
    const t = (
      await a.chamar('POST', '/api/tarefas', { cookie: e.cookie.interno, corpo: { titulo: 'T' } })
    ).json();
    const r = await a.chamar('PATCH', `/api/tarefas/${t.id}`, {
      cookie: e.cookie.interno,
      corpo: {
        titulo: 'T',
        descricao: 'Nova descrição',
        mencoes: [],
        prioridade: 'media',
        prazo: null,
      },
    });
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().descricao).toBe('Nova descrição');
  });
});
