/* eslint-disable @typescript-eslint/no-explicit-any -- corpos JSON das respostas, sem tipo */
import { afterEach, describe, expect, it } from 'vitest';
import { a, agenda, encerrar, hora, marcar, preparar } from './auxiliares-de-agenda.js';

afterEach(encerrar);

describe('participantes, respostas e avisos', () => {
  it('só participantes ativos com Agenda; quem não tem a habilitação é recusado', async () => {
    const e = await preparar();
    expect(
      (await marcar(e.cookie.interno, { participantesInternos: [e.id.semAgenda] })).statusCode,
    ).toBe(409);
    expect((await marcar(e.cookie.interno, { participantesInternos: [999_999] })).statusCode).toBe(
      409,
    );
    expect((await marcar(e.cookie.interno, { participantesExternos: [999_999] })).statusCode).toBe(
      409,
    );
  });

  it('participante externo é uma pessoa cadastrada, sem aviso nem acesso', async () => {
    const e = await preparar();
    const { cliente } = a.banco.conectar('api');
    const [p] = await cliente<{ id: string }[]>`
      INSERT INTO pessoa (nome_completo, telefone_normalizado) VALUES ('Maria da Silva', '67999990000') RETURNING id`;
    const r = await marcar(e.cookie.interno, { participantesExternos: [Number(p!.id)] });
    expect(r.statusCode, r.body).toBe(201);
    expect(r.json().compromisso.participantesExternos).toEqual([
      { id: Number(p!.id), nome: 'Maria da Silva' },
    ]);
    expect(await cliente`SELECT 1 FROM aviso`).toHaveLength(0);
  });

  it('recusar não cancela o compromisso nem remove o participante (critério 2)', async () => {
    const e = await preparar();
    const c = (
      await marcar(e.cookie.supervisor, {
        visibilidade: 'aberto',
        participantesInternos: [e.id.interno],
      })
    ).json().compromisso;
    const r = await a.chamar('POST', `/api/agenda/compromissos/${c.id}/resposta`, {
      cookie: e.cookie.interno,
      corpo: { resposta: 'recusado' },
    });
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().compromisso.cancelado).toBe(false);
    expect(r.json().compromisso.participantesInternos).toEqual([
      { id: e.id.interno, nome: expect.any(String), resposta: 'recusado' },
    ]);
    expect((await agenda(e.cookie.interno)).itens).toHaveLength(1);
    // Quem não foi indicado não responde.
    expect(
      (
        await a.chamar('POST', `/api/agenda/compromissos/${c.id}/resposta`, {
          cookie: e.cookie.interno2,
          corpo: { resposta: 'confirmado' },
        })
      ).statusCode,
    ).toBe(404);
  });

  it('remarcar avisa quem já estava; trocar participantes avisa só os novos e preserva as respostas', async () => {
    const e = await preparar();
    const c = (
      await marcar(e.cookie.supervisor, {
        visibilidade: 'aberto',
        participantesInternos: [e.id.interno],
      })
    ).json().compromisso;
    await a.chamar('POST', `/api/agenda/compromissos/${c.id}/resposta`, {
      cookie: e.cookie.interno,
      corpo: { resposta: 'confirmado' },
    });
    const { cliente } = a.banco.conectar('api');
    await cliente`DELETE FROM aviso`.catch(() => undefined); // a API não apaga: só conferimos os novos abaixo
    const antes = (await cliente`SELECT id FROM aviso`).length;

    const r = await a.chamar('PATCH', `/api/agenda/compromissos/${c.id}`, {
      cookie: e.cookie.supervisor,
      corpo: {
        inicio: hora(15),
        fim: hora(16),
        participantesInternos: [e.id.interno, e.id.interno2],
      },
    });
    expect(r.statusCode, r.body).toBe(200);
    const novos = await cliente<{ destinatario_id: string; natureza: string }[]>`
      SELECT destinatario_id, natureza FROM aviso ORDER BY id OFFSET ${antes}`;
    expect(novos.map((v) => [Number(v.destinatario_id), v.natureza]).sort()).toEqual(
      [
        [e.id.interno, 'compromisso_remarcado'],
        [e.id.interno2, 'compromisso_indicacao'],
      ].sort(),
    );
    const interno = r
      .json()
      .compromisso.participantesInternos.find((p: any) => p.id === e.id.interno);
    expect(interno.resposta).toBe('confirmado');
    expect((await a.trilha('compromisso.remarcar')).length).toBe(1);
  });

  it('cancelar avisa os participantes (não quem cancela) e deixa o compromisso só de leitura', async () => {
    const e = await preparar();
    const c = (
      await marcar(e.cookie.supervisor, {
        visibilidade: 'aberto',
        participantesInternos: [e.id.interno, e.id.supervisor],
      })
    ).json().compromisso;
    const r = await a.chamar('POST', `/api/agenda/compromissos/${c.id}/cancelar`, {
      cookie: e.cookie.supervisor,
    });
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().compromisso.cancelado).toBe(true);
    const { cliente } = a.banco.conectar('api');
    const cancelados = await cliente<
      { destinatario_id: string }[]
    >`SELECT destinatario_id FROM aviso WHERE natureza = 'compromisso_cancelado'`;
    expect(cancelados.map((x) => Number(x.destinatario_id))).toEqual([e.id.interno]);
    expect((await agenda(e.cookie.interno)).itens).toHaveLength(0);
    expect(
      (
        await a.chamar('PATCH', `/api/agenda/compromissos/${c.id}`, {
          cookie: e.cookie.supervisor,
          corpo: { titulo: 'x' },
        })
      ).statusCode,
    ).toBe(409);
    expect(
      (
        await a.chamar('POST', `/api/agenda/compromissos/${c.id}/cancelar`, {
          cookie: e.cookie.supervisor,
        })
      ).statusCode,
    ).toBe(409);
    expect(
      (
        await a.chamar('POST', `/api/agenda/compromissos/${c.id}/resposta`, {
          cookie: e.cookie.interno,
          corpo: { resposta: 'confirmado' },
        })
      ).statusCode,
    ).toBe(409);
  });

  it('o aviso de indicação some para quem perde o alcance do compromisso Restrito', async () => {
    const e = await preparar();
    const c = (
      await marcar(e.cookie.supervisor, {
        visibilidade: 'restrito',
        participantesInternos: [e.id.interno],
      })
    ).json().compromisso;
    const caixa = async () =>
      (await a.chamar('GET', '/api/avisos', { cookie: e.cookie.interno })).json();
    expect((await caixa()).itens).toHaveLength(1);
    await a.chamar('PATCH', `/api/agenda/compromissos/${c.id}`, {
      cookie: e.cookie.supervisor,
      corpo: { participantesInternos: [] },
    });
    expect((await caixa()).itens).toHaveLength(0);
  });
});

describe('bloqueios e conflitos', () => {
  it('o bloqueio entra na agenda e no conflito, sem motivo, e se cancela', async () => {
    const e = await preparar();
    const b = await a.chamar('POST', '/api/agenda/bloqueios', {
      cookie: e.cookie.interno,
      corpo: { inicio: hora(9), fim: hora(12) },
    });
    expect(b.statusCode, b.body).toBe(201);
    const naAgenda = await agenda(e.cookie.externo);
    expect(naAgenda.itens).toEqual([
      { tipo: 'bloqueio', id: b.json().id, inicio: expect.any(String), fim: expect.any(String) },
    ]);

    const c = await marcar(e.cookie.interno);
    expect(c.json().conflitos).toEqual([
      { tipo: 'bloqueio', inicio: expect.any(String), fim: expect.any(String) },
    ]);

    expect(
      (
        await a.chamar('POST', `/api/agenda/bloqueios/${b.json().id}/cancelar`, {
          cookie: e.cookie.interno,
        })
      ).statusCode,
    ).toBe(204);
    expect(
      (await agenda(e.cookie.externo)).itens.filter((i) => i.tipo === 'bloqueio'),
    ).toHaveLength(0);
    expect(
      (
        await a.chamar('POST', `/api/agenda/bloqueios/${b.json().id}/cancelar`, {
          cookie: e.cookie.interno,
        })
      ).statusCode,
    ).toBe(409);
    expect(
      (
        await a.chamar('POST', '/api/agenda/bloqueios', {
          cookie: e.cookie.interno,
          corpo: { inicio: hora(12), fim: hora(9) },
        })
      ).statusCode,
    ).toBe(400);
  });

  it('avisa conflito com quem compartilha participante ou a Parlamentar, sem vazar o Restrito alheio', async () => {
    const e = await preparar();
    await marcar(e.cookie.supervisor, {
      titulo: 'Sigiloso',
      visibilidade: 'restrito',
      participantesInternos: [e.id.interno2],
    });
    // O Interno marca no mesmo horário, também com a Parlamentar: o Restrito alheio não vira "conflito" para ele.
    const doInterno = await marcar(e.cookie.interno, { titulo: 'Outro' });
    expect(doInterno.json().conflitos).toEqual([]);
    // O Chefe, que vê tudo, é avisado do conflito (ambos envolvem a Parlamentar).
    const doChefe = await marcar(e.cookie.chefe, { titulo: 'Terceiro' });
    expect(doChefe.json().conflitos.length).toBe(2);
    // Sem a marca e sem gente em comum, não há conflito.
    const livre = await marcar(e.cookie.chefe, {
      titulo: 'Livre',
      envolveParlamentar: false,
      participantesInternos: [e.id.externo],
    });
    expect(livre.json().conflitos).toEqual([]);
  });
});
