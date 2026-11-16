/* eslint-disable @typescript-eslint/no-explicit-any -- corpos JSON das respostas, sem tipo */
import { afterEach, describe, expect, it } from 'vitest';
import { a, novaDemanda, preparar } from './demandas/auxiliares-de-demandas.js';

afterEach(async () => {
  await a.encerrar();
});

const registrar = (cookie: string, extra: object) =>
  a.chamar('POST', '/api/demandas', { cookie, corpo: novaDemanda(extra) });

const avisosDe = async (natureza: string) =>
  a.banco.conectar('api').cliente<{ destinatario_id: string; registro_tipo: string }[]>`
    SELECT destinatario_id, registro_tipo FROM aviso WHERE natureza = ${natureza} ORDER BY id`;

describe('mais de um responsável: demandas', () => {
  it('o corresponsável vê e altera a demanda; quem não é responsável não a vê; o aviso chega', async () => {
    const e = await preparar();
    const r = await registrar(e.cookie.supervisor, {
      responsavelId: e.id.interno,
      corresponsaveis: [e.id.externo],
    });
    expect(r.statusCode, r.body).toBe(201);
    const id = r.json().demanda.id;
    expect(r.json().demanda.corresponsaveis.map((c: any) => c.id)).toEqual([e.id.externo]);
    expect(r.json().demanda.responsavel.id).toBe(e.id.interno);

    // O corresponsável (Assessor Externo) alcança; o outro Externo, não.
    expect(
      (await a.chamar('GET', `/api/demandas/${id}`, { cookie: e.cookie.externo })).statusCode,
    ).toBe(200);
    expect(
      (await a.chamar('GET', `/api/demandas/${id}`, { cookie: e.cookie.externo2 })).statusCode,
    ).toBe(404);
    const lista = (await a.chamar('GET', '/api/demandas', { cookie: e.cookie.externo })).json();
    expect(lista.itens.map((d: any) => d.id)).toContain(id);

    // E pode alterar, como o principal.
    const alterada = await a.chamar('PATCH', `/api/demandas/${id}`, {
      cookie: e.cookie.externo,
      corpo: { titulo: 'Título ajustado pelo corresponsável' },
    });
    expect(alterada.statusCode, alterada.body).toBe(200);
    expect((await avisosDe('demanda_designada')).map((x) => Number(x.destinatario_id))).toEqual([
      e.id.externo,
    ]);
  });

  it('reatribuir troca a lista; a mesma lista de quem já é principal é conflito; sem Atendimento é recusado', async () => {
    const e = await preparar();
    const id = (
      await registrar(e.cookie.supervisor, {
        responsavelId: e.id.interno,
        corresponsaveis: [e.id.externo],
      })
    ).json().demanda.id;

    const troca = await a.chamar('POST', `/api/demandas/${id}/reatribuir`, {
      cookie: e.cookie.supervisor,
      corpo: { corresponsaveis: [e.id.externo2] },
    });
    expect(troca.statusCode, troca.body).toBe(200);
    expect(troca.json().corresponsaveis.map((c: any) => c.id)).toEqual([e.id.externo2]);
    expect(
      (await a.chamar('GET', `/api/demandas/${id}`, { cookie: e.cookie.externo })).statusCode,
    ).toBe(404);
    expect(
      (await a.chamar('GET', `/api/demandas/${id}`, { cookie: e.cookie.externo2 })).statusCode,
    ).toBe(200);

    // Só o mesmo principal, sem lista: nada mudou.
    expect(
      (
        await a.chamar('POST', `/api/demandas/${id}/reatribuir`, {
          cookie: e.cookie.supervisor,
          corpo: { responsavelId: e.id.interno },
        })
      ).statusCode,
    ).toBe(409);
    // O principal nunca entra na lista; quem não tem Atendimento é recusado.
    const comPrincipal = await a.chamar('POST', `/api/demandas/${id}/reatribuir`, {
      cookie: e.cookie.supervisor,
      corpo: { corresponsaveis: [e.id.interno] },
    });
    expect(comPrincipal.json().corresponsaveis).toEqual([]);
    expect(
      (
        await a.chamar('POST', `/api/demandas/${id}/reatribuir`, {
          cookie: e.cookie.supervisor,
          corpo: { corresponsaveis: [e.id.semAtendimento] },
        })
      ).statusCode,
    ).toBe(409);
  });
});

describe('mais de um responsável: tarefas', () => {
  it('o corresponsável vê a tarefa, ela entra em "minhas" e ele é avisado', async () => {
    const e = await preparar();
    const r = await a.chamar('POST', '/api/tarefas', {
      cookie: e.cookie.interno,
      corpo: { titulo: 'Revisar o ofício', corresponsaveis: [e.id.externo] },
    });
    expect(r.statusCode, r.body).toBe(201);
    const id = r.json().id;
    expect(r.json().corresponsaveis.map((c: any) => c.id)).toEqual([e.id.externo]);

    expect(
      (await a.chamar('GET', `/api/tarefas/${id}`, { cookie: e.cookie.externo })).statusCode,
    ).toBe(200);
    expect(
      (await a.chamar('GET', `/api/tarefas/${id}`, { cookie: e.cookie.externo2 })).statusCode,
    ).toBe(404);
    const minhas = (
      await a.chamar('GET', '/api/tarefas?minhas=true', { cookie: e.cookie.externo })
    ).json();
    expect(minhas.itens.map((t: any) => t.id)).toEqual([id]);
    expect((await avisosDe('tarefa_designada')).map((x) => Number(x.destinatario_id))).toEqual([
      e.id.externo,
    ]);

    // Passar o principal e trocar a lista numa só chamada.
    const troca = await a.chamar('POST', `/api/tarefas/${id}/reatribuir`, {
      cookie: e.cookie.supervisor,
      corpo: { responsavelId: e.id.supervisor, corresponsaveis: [e.id.interno] },
    });
    expect(troca.statusCode, troca.body).toBe(200);
    expect(troca.json().responsavel.id).toBe(e.id.supervisor);
    expect(troca.json().corresponsaveis.map((c: any) => c.id)).toEqual([e.id.interno]);
  });
});
