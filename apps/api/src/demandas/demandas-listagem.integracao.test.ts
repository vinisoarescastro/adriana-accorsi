/* eslint-disable @typescript-eslint/no-explicit-any -- corpos JSON das respostas, sem tipo */
import { afterEach, describe, expect, it } from 'vitest';
import { a, novaDemanda, preparar, registrar } from './auxiliares-de-demandas.js';

afterEach(async () => {
  await a.encerrar();
});

describe('listar e quadro (critério 10: nada carrega o conjunto completo)', () => {
  it('pagina no servidor (25, máximo 100) e filtra por status, etapa, busca e solicitante', async () => {
    const { cookie } = await preparar();
    for (let i = 0; i < 27; i += 1) {
      await registrar(
        cookie.interno,
        novaDemanda({
          solicitante: { nome: `Cidadão ${i}`, telefone: `6799000${String(1000 + i)}` },
          titulo: `Pedido número ${i}`,
        }),
      );
    }
    const p1 = (await a.chamar('GET', '/api/demandas', { cookie: cookie.interno })).json();
    expect(p1).toMatchObject({ total: 27, pagina: 1, porPagina: 25 });
    expect(p1.itens).toHaveLength(25);
    expect(
      (await a.chamar('GET', '/api/demandas?pagina=2', { cookie: cookie.interno })).json().itens,
    ).toHaveLength(2);
    expect(
      (await a.chamar('GET', '/api/demandas?porPagina=100', { cookie: cookie.interno })).json()
        .itens,
    ).toHaveLength(27);
    expect(
      (await a.chamar('GET', '/api/demandas?porPagina=101', { cookie: cookie.interno })).statusCode,
    ).toBe(400);

    expect(
      (await a.chamar('GET', '/api/demandas?busca=número 13', { cookie: cookie.interno })).json()
        .total,
    ).toBe(1);
    expect(
      (await a.chamar('GET', '/api/demandas?busca=Cidadão 5', { cookie: cookie.interno })).json()
        .total,
    ).toBe(1);
    expect(
      (await a.chamar('GET', '/api/demandas?busca=1007', { cookie: cookie.interno })).json().total,
    ).toBe(1);
    const protocolo = p1.itens[0].protocolo as string;
    for (const forma of [protocolo, protocolo.replaceAll('-', '').toLowerCase()]) {
      expect(
        (await a.chamar('GET', `/api/demandas?busca=${forma}`, { cookie: cookie.interno })).json()
          .total,
        forma,
      ).toBe(1);
    }
    expect(
      (
        await a.chamar('GET', `/api/demandas?solicitanteId=${p1.itens[0].solicitante.id}`, {
          cookie: cookie.interno,
        })
      ).json().total,
    ).toBe(1);
    expect(
      (await a.chamar('GET', '/api/demandas?status=concluido', { cookie: cookie.interno })).json()
        .total,
    ).toBe(0);
    expect(
      (await a.chamar('GET', '/api/demandas?status=inventado', { cookie: cookie.interno }))
        .statusCode,
    ).toBe(400);
  });

  it('o quadro tem uma coluna por etapa ativa, com total e limite por coluna', async () => {
    const { cookie } = await preparar();
    await registrar(cookie.interno);
    const quadro = (
      await a.chamar('GET', '/api/demandas/quadro', { cookie: cookie.interno })
    ).json();
    expect(quadro.colunas.map((c: any) => c.etapa.nome)).toEqual([
      'Recebida',
      'Em triagem',
      'Em andamento',
      'Aguardando terceiros',
      'Concluída',
      'Sem solução',
      'Arquivada',
    ]);
    expect(quadro.colunas[0]).toMatchObject({ total: 1 });
    expect(quadro.limitePorColuna).toBe(30);
  });
});
