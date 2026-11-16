/* eslint-disable @typescript-eslint/no-explicit-any -- corpos JSON das respostas, sem tipo */
import { afterEach, describe, expect, it } from 'vitest';
import { a, preparar } from '../demandas/auxiliares-de-demandas.js';

afterEach(async () => {
  await a.encerrar();
});

const novoEvento = (cookie: string, corpo: object = {}) =>
  a.chamar('POST', '/api/eventos', {
    cookie,
    corpo: { nome: 'Audiência pública', inicio: '2026-11-20T19:00:00-03:00', ...corpo },
  });

const presenca = (cookie: string, eventoId: number, corpo: object) =>
  a.chamar('POST', `/api/eventos/${eventoId}/presencas`, { cookie, corpo });

const ficha = async (cookie: string, eventoId: number) =>
  (await a.chamar('GET', `/api/eventos/${eventoId}`, { cookie })).json();

describe('eventos', () => {
  it('Assessor Interno organiza; o Externo só acompanha; sem Atendimento a rota some', async () => {
    const e = await preparar();
    const r = await novoEvento(e.cookie.interno, { local: 'Câmara' });
    expect(r.statusCode, r.body).toBe(201);
    expect(r.json()).toMatchObject({ nome: 'Audiência pública', situacao: 'aberto', presentes: 0 });
    expect((await novoEvento(e.cookie.externo)).statusCode).toBe(404);
    expect((await novoEvento(e.cookie.semAtendimento)).statusCode).toBe(404);
    expect((await novoEvento(e.cookie.interno, { nome: '  ' })).statusCode).toBe(400);

    const lista = (await a.chamar('GET', '/api/eventos', { cookie: e.cookie.externo })).json();
    expect(lista.total).toBe(1);

    const alterado = await a.chamar('PATCH', `/api/eventos/${r.json().id}`, {
      cookie: e.cookie.interno,
      corpo: { nome: 'Audiência na Câmara' },
    });
    expect(alterado.json().nome).toBe('Audiência na Câmara');
    expect((await a.trilha('evento.criar')).length).toBe(1);
  });

  it('encerrar é do Supervisor e nunca vem da data (critério 6)', async () => {
    const e = await preparar();
    const ev = (await novoEvento(e.cookie.interno)).json();
    expect(
      (await a.chamar('POST', `/api/eventos/${ev.id}/encerrar`, { cookie: e.cookie.interno }))
        .statusCode,
    ).toBe(404);

    // Passam-se 40 dias do evento: ele continua aberto e aceita presença.
    a.relogio.avancar(40 * 24 * 3600 * 1000);
    const cookie = await a.sessaoDe(e.contas.interno.email);
    expect((await ficha(cookie, ev.id)).situacao).toBe('aberto');
    expect(
      (await presenca(cookie, ev.id, { telefone: '(67) 99999-0000', nome: 'Maria' })).statusCode,
    ).toBe(201);

    const supervisor = await a.sessaoDe(e.contas.supervisor.email);
    const r = await a.chamar('POST', `/api/eventos/${ev.id}/encerrar`, { cookie: supervisor });
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().situacao).toBe('encerrado');
    expect((await a.trilha('evento.encerrar')).length).toBe(1);
    // Encerrado, nada muda.
    expect(
      (await a.chamar('POST', `/api/eventos/${ev.id}/encerrar`, { cookie: supervisor })).statusCode,
    ).toBe(409);
    expect(
      (
        await a.chamar('PATCH', `/api/eventos/${ev.id}`, {
          cookie: supervisor,
          corpo: { nome: 'x' },
        })
      ).statusCode,
    ).toBe(409);
  });

  it('o evento mais próximo é o aberto mais perto de agora', async () => {
    const e = await preparar();
    const vazio = (
      await a.chamar('GET', '/api/eventos/proximo', { cookie: e.cookie.interno })
    ).json();
    expect(vazio).toEqual({ evento: null });
    await novoEvento(e.cookie.interno, { nome: 'Longe', inicio: '2026-12-30T10:00:00-03:00' });
    const perto = (
      await novoEvento(e.cookie.interno, { nome: 'Perto', inicio: '2026-11-13T10:00:00-03:00' })
    ).json();
    const r = (await a.chamar('GET', '/api/eventos/proximo', { cookie: e.cookie.externo })).json();
    expect(r.evento.id).toBe(perto.id);
  });
});

describe('presença', () => {
  it('por telefone: pessoa cadastrada entra direto; a nova pede o nome e é criada no ato', async () => {
    const e = await preparar();
    const ev = (await novoEvento(e.cookie.interno)).json();
    await a.chamar('POST', '/api/pessoas', {
      cookie: e.cookie.interno,
      corpo: { nome: 'José Antunes', telefone: '67988887777' },
    });

    const cadastrada = await presenca(e.cookie.externo, ev.id, { telefone: '(67) 98888-7777' });
    expect(cadastrada.statusCode, cadastrada.body).toBe(201);
    expect(cadastrada.json().pessoaCriada).toBe(false);

    const semNome = await presenca(e.cookie.externo, ev.id, { telefone: '(67) 99999-0000' });
    expect(semNome.statusCode).toBe(409);
    expect(semNome.json().detalhes).toEqual(['nome']);

    const nova = await presenca(e.cookie.externo, ev.id, {
      telefone: '(67) 99999-0000',
      nome: 'Maria da Silva',
      observacao: 'Veio com a associação',
    });
    expect(nova.statusCode, nova.body).toBe(201);
    expect(nova.json().pessoaCriada).toBe(true);
    expect(nova.json().evento.presentes).toBe(2);
    expect((await a.trilha('pessoa.criar')).length).toBe(2); // José (cadastro) e Maria (no ato)

    // A mesma pessoa não consta duas vezes.
    const repetida = await presenca(e.cookie.externo, ev.id, { telefone: '67999990000' });
    expect(repetida.statusCode).toBe(409);
    expect((await presenca(e.cookie.externo, ev.id, { telefone: '123' })).statusCode).toBe(400);
  });

  it('o Assessor Externo vê só o que registrou; o Interno vê a lista nominal', async () => {
    const e = await preparar();
    const ev = (await novoEvento(e.cookie.interno)).json();
    await presenca(e.cookie.externo, ev.id, { telefone: '67911110000', nome: 'Ana' });
    await presenca(e.cookie.externo2, ev.id, { telefone: '67922220000', nome: 'Beto' });

    const doExterno = await ficha(e.cookie.externo, ev.id);
    expect(doExterno.presentes).toBe(2);
    expect(doExterno.listaNominalCompleta).toBe(false);
    expect(doExterno.presencas.map((p: any) => p.nome)).toEqual(['Ana']);

    const doInterno = await ficha(e.cookie.interno, ev.id);
    expect(doInterno.listaNominalCompleta).toBe(true);
    expect(doInterno.presencas.map((p: any) => p.nome).sort()).toEqual(['Ana', 'Beto']);
  });

  it('quem registrou corrige em até 30 minutos; depois, só Assessor Interno ou superior (RN-EVE-03)', async () => {
    const e = await preparar();
    const ev = (await novoEvento(e.cookie.interno)).json();
    const r = await presenca(e.cookie.externo, ev.id, { telefone: '67911110000', nome: 'Ana' });
    const pessoaId = r.json().evento.presencas[0].pessoaId;

    expect(r.json().evento.presencas[0].corrigivel).toBe(true);
    const dentro = await a.chamar('PATCH', `/api/eventos/${ev.id}/presencas/${pessoaId}`, {
      cookie: e.cookie.externo,
      corpo: { observacao: 'Chegou atrasada' },
    });
    expect(dentro.statusCode, dentro.body).toBe(200);
    expect(dentro.json().presencas[0].observacao).toBe('Chegou atrasada');

    // Outro Externo não vê a presença: "não encontrada".
    expect(
      (
        await a.chamar('PATCH', `/api/eventos/${ev.id}/presencas/${pessoaId}`, {
          cookie: e.cookie.externo2,
          corpo: { observacao: 'x' },
        })
      ).statusCode,
    ).toBe(404);

    a.relogio.avancar(31 * 60 * 1000);
    const externo = await a.sessaoDe(e.contas.externo.email);
    const fora = await a.chamar('PATCH', `/api/eventos/${ev.id}/presencas/${pessoaId}`, {
      cookie: externo,
      corpo: { observacao: 'Tarde demais' },
    });
    expect(fora.statusCode).toBe(403);
    expect((await ficha(externo, ev.id)).presencas[0].corrigivel).toBe(false);

    const interno = await a.sessaoDe(e.contas.interno.email);
    const ok = await a.chamar('PATCH', `/api/eventos/${ev.id}/presencas/${pessoaId}`, {
      cookie: interno,
      corpo: { observacao: 'Corrigido pelo Interno' },
    });
    expect(ok.statusCode, ok.body).toBe(200);
  });

  it('corrigir a pessoa registrada por engano (outro telefone)', async () => {
    const e = await preparar();
    const ev = (await novoEvento(e.cookie.interno)).json();
    const r = await presenca(e.cookie.interno, ev.id, { telefone: '67911110000', nome: 'Ana' });
    const pessoaId = r.json().evento.presencas[0].pessoaId;
    const c = await a.chamar('PATCH', `/api/eventos/${ev.id}/presencas/${pessoaId}`, {
      cookie: e.cookie.interno,
      corpo: { telefone: '67933330000', nome: 'Carla' },
    });
    expect(c.statusCode, c.body).toBe(200);
    expect(c.json().presencas.map((p: any) => p.nome)).toEqual(['Carla']);
    expect(c.json().presentes).toBe(1);
  });

  it('remover exige Supervisor e justificativa; apaga a linha e deixa o motivo na trilha', async () => {
    const e = await preparar();
    const ev = (await novoEvento(e.cookie.interno)).json();
    const r = await presenca(e.cookie.interno, ev.id, { telefone: '67911110000', nome: 'Ana' });
    const pessoaId = r.json().evento.presencas[0].pessoaId;
    const url = `/api/eventos/${ev.id}/presencas/${pessoaId}/remover`;

    expect(
      (
        await a.chamar('POST', url, {
          cookie: e.cookie.interno,
          corpo: { justificativa: 'Registrada por engano' },
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (
        await a.chamar('POST', url, {
          cookie: e.cookie.supervisor,
          corpo: { justificativa: 'curta' },
        })
      ).statusCode,
    ).toBe(400);
    const ok = await a.chamar('POST', url, {
      cookie: e.cookie.supervisor,
      corpo: { justificativa: 'Registrada por engano' },
    });
    expect(ok.statusCode, ok.body).toBe(200);
    expect(ok.json().presentes).toBe(0);
    const trilha = await a.trilha('presenca.remover');
    expect(trilha).toHaveLength(1);
    const { cliente } = a.banco.conectar('api');
    const [linha] =
      await cliente`SELECT justificativa FROM trilha WHERE operacao = 'presenca.remover'`;
    expect(linha!.justificativa).toBe('Registrada por engano');
    expect(
      (
        await a.chamar('POST', url, {
          cookie: e.cookie.supervisor,
          corpo: { justificativa: 'Registrada por engano' },
        })
      ).statusCode,
    ).toBe(404);
  });

  it('não se registra, corrige nem remove presença em evento encerrado', async () => {
    const e = await preparar();
    const ev = (await novoEvento(e.cookie.interno)).json();
    const r = await presenca(e.cookie.interno, ev.id, { telefone: '67911110000', nome: 'Ana' });
    const pessoaId = r.json().evento.presencas[0].pessoaId;
    await a.chamar('POST', `/api/eventos/${ev.id}/encerrar`, { cookie: e.cookie.supervisor });

    expect(
      (await presenca(e.cookie.interno, ev.id, { telefone: '67922220000', nome: 'Beto' }))
        .statusCode,
    ).toBe(409);
    expect(
      (
        await a.chamar('PATCH', `/api/eventos/${ev.id}/presencas/${pessoaId}`, {
          cookie: e.cookie.interno,
          corpo: { observacao: 'x' },
        })
      ).statusCode,
    ).toBe(409);
    expect(
      (
        await a.chamar('POST', `/api/eventos/${ev.id}/presencas/${pessoaId}/remover`, {
          cookie: e.cookie.supervisor,
          corpo: { justificativa: 'Registrada por engano' },
        })
      ).statusCode,
    ).toBe(409);
    // A pessoa não foi criada no ato falho.
    const { cliente } = a.banco.conectar('api');
    expect(await cliente`SELECT 1 FROM pessoa WHERE nome_completo = 'Beto'`).toHaveLength(0);
  });
});
