/* eslint-disable @typescript-eslint/no-explicit-any -- corpos JSON das respostas, sem tipo */
import { afterEach, describe, expect, it } from 'vitest';
import { a, destinar, etapaDeEmenda, novaEmenda, preparar } from './auxiliares-de-emendas.js';

afterEach(async () => {
  await a.encerrar();
});

const post = (cookie: string, url: string, corpo: object) =>
  a.chamar('POST', url, { cookie, corpo });
const ficha = async (cookie: string, id: number) =>
  (await a.chamar('GET', `/api/emendas/${id}`, { cookie })).json();

describe('fluxo, cancelamento e consolidado', () => {
  it('percorre o fluxo da emenda; etapa de outro fluxo é recusada; reabrir é do Supervisor', async () => {
    const e = await preparar();
    const emenda = await novaEmenda(e.cookie.interno);
    const mover = (cookie: string, etapaId: number) =>
      post(cookie, `/api/emendas/${emenda.id}/mover`, { etapaId });
    expect(
      (await mover(e.cookie.interno, await etapaDeEmenda(e.cookie.interno, 'Indicada'))).statusCode,
    ).toBe(200);
    expect((await mover(e.cookie.interno, 1)).statusCode).toBe(400);
    const executada = await mover(
      e.cookie.interno,
      await etapaDeEmenda(e.cookie.interno, 'Executada'),
    );
    expect(executada.json()).toMatchObject({ status: 'concluida', etapa: { nome: 'Executada' } });
    const reabrir = await etapaDeEmenda(e.cookie.interno, 'Empenhada');
    expect((await mover(e.cookie.interno, reabrir)).statusCode).toBe(403);
    expect((await mover(e.cookie.supervisor, reabrir)).statusCode).toBe(200);
    expect((await a.trilha('emenda.reabrir')).length).toBe(1);
  });

  it('cancelar exige justificativa e que não haja valor destinado; a cancelada não se altera', async () => {
    const e = await preparar();
    const emenda = await novaEmenda(e.cookie.interno);
    await destinar(e.cookie.interno, emenda.id, e.beneficiario, '10.00');
    const cancelar = (cookie: string, justificativa: string) =>
      post(cookie, `/api/emendas/${emenda.id}/cancelar`, { justificativa });
    expect((await cancelar(e.cookie.interno, 'Lançada em duplicidade')).statusCode).toBe(404);
    expect((await cancelar(e.cookie.supervisor, 'curta')).statusCode).toBe(400);
    expect((await cancelar(e.cookie.supervisor, 'Lançada em duplicidade')).statusCode).toBe(409);
    const d = (await ficha(e.cookie.interno, emenda.id)).destinacoes[0].id;
    await post(e.cookie.supervisor, `/api/emendas/${emenda.id}/destinacoes/${d}/cancelar`, {
      justificativa: 'Retirada do beneficiário',
    });
    expect((await cancelar(e.cookie.supervisor, 'Lançada em duplicidade')).json()).toMatchObject({
      status: 'cancelada',
    });
    expect(
      (await destinar(e.cookie.supervisor, emenda.id, e.beneficiario, '1.00')).statusCode,
    ).toBe(409);
    expect(
      (
        await a.chamar('PATCH', `/api/emendas/${emenda.id}`, {
          cookie: e.cookie.supervisor,
          corpo: { finalidade: 'Outra' },
        })
      ).statusCode,
    ).toBe(409);
  });

  it('o consolidado soma os valores das não canceladas, e o atraso é derivado do prazo', async () => {
    const e = await preparar();
    const um = await novaEmenda(e.cookie.interno, { prazoExecucao: '2026-11-20' });
    await novaEmenda(e.cookie.interno, { identificacao: 'EMD 2026/0002', valor: '50000.00' });
    const cancelada = await novaEmenda(e.cookie.interno, {
      identificacao: 'EMD 2026/0003',
      valor: '1000.00',
    });
    await post(e.cookie.supervisor, `/api/emendas/${cancelada.id}/cancelar`, {
      justificativa: 'Lançada por engano mesmo',
    });
    await destinar(e.cookie.interno, um.id, e.beneficiario, '40000.00');

    a.relogio.avancar(10 * 24 * 3600 * 1000);
    const cookie = await a.sessaoDe(e.contas.interno.email);
    const c = (await a.chamar('GET', '/api/emendas/consolidado', { cookie })).json();
    expect(c).toMatchObject({ emAndamento: 2, atrasadas: 1, canceladas: 1 });
    expect(c.valores).toMatchObject({
      disponibilizado: '150000.00',
      comprometido: '40000.00',
      disponivel: '110000.00',
    });
    const atrasadas = (await a.chamar('GET', '/api/emendas?atrasadas=true', { cookie })).json();
    expect(atrasadas.itens.map((i: any) => i.id)).toEqual([um.id]);
  });
});

describe('reconstituição por data', () => {
  it('devolve os valores de uma data passada, pela mesma conta, e só ao Administrador e à Parlamentar', async () => {
    const e = await preparar();
    const emenda = await novaEmenda(e.cookie.interno);
    const d = (await destinar(e.cookie.interno, emenda.id, e.beneficiario, '30000.00')).json()
      .destinacoes[0].id;
    a.relogio.avancar(2 * 24 * 3600 * 1000); // 14/11
    const interno = await a.sessaoDe(e.contas.interno.email); // a sessão antiga expirou com o tempo
    await post(interno, `/api/emendas/${emenda.id}/destinacoes/${d}/execucoes`, {
      valor: '10000.00',
      data: '2026-11-14',
    });
    await destinar(interno, emenda.id, e.beneficiario, '20000.00');

    const admin = await a.sessaoDe(e.contas.admin.email);
    const em = (dia: string) =>
      a
        .chamar('GET', `/api/emendas/reconstituicao?em=${dia}`, { cookie: admin })
        .then((r) => r.json());
    const antes = await em('2026-11-12');
    expect(antes.itens[0].valores).toMatchObject({
      comprometido: '30000.00',
      utilizado: '0.00',
      disponivel: '70000.00',
    });
    const depois = await em('2026-11-14');
    expect(depois.itens[0].valores).toMatchObject({
      comprometido: '50000.00',
      utilizado: '10000.00',
      disponivel: '50000.00',
    });
    expect(antes.total.disponibilizado).toBe('100000.00');
    expect((await em('2026-11-01')).itens).toHaveLength(0); // ainda não existia

    const parlamentar = await a.sessaoDe(e.contas.parlamentar.email);
    expect(
      (await a.chamar('GET', '/api/emendas/reconstituicao?em=2026-11-12', { cookie: parlamentar }))
        .statusCode,
    ).toBe(200);
    for (const quem of ['chefe', 'supervisor', 'interno', 'financeiro'] as const) {
      const r = await a.chamar('GET', '/api/emendas/reconstituicao?em=2026-11-12', {
        cookie: await a.sessaoDe(e.contas[quem].email),
      });
      expect(r.statusCode, quem).toBe(404);
    }
  });
});

describe('quem alcança as emendas', () => {
  it('LG ou FI consultam; sem elas, ou sem nível, responde não encontrado; a área pública não vê nada', async () => {
    const e = await preparar();
    const emenda = await novaEmenda(e.cookie.interno);
    const ler = (cookie: string, url: string) =>
      a.chamar('GET', url, { cookie }).then((r) => r.statusCode);
    for (const url of [
      '/api/emendas',
      '/api/emendas/etapas',
      '/api/emendas/tipos',
      '/api/emendas/consolidado',
      `/api/emendas/${emenda.id}`,
    ]) {
      expect(await ler(e.cookie.interno, url), url).toBe(200);
      expect(await ler(e.cookie.financeiro, url), url).toBe(200);
      expect(await ler(e.cookie.semLegislativo, url), url).toBe(404);
      expect(await ler(e.cookie.externo, url), url).toBe(404);
    }
    const publico = a.banco.conectar('publico').cliente;
    await expect(publico`SELECT 1 FROM emenda`).rejects.toThrow(/permission denied/);
  });
});
