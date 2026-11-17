/* eslint-disable @typescript-eslint/no-explicit-any -- corpos JSON das respostas, sem tipo */
import { afterEach, describe, expect, it } from 'vitest';
import { a, destinar, novaEmenda, preparar, tipoDeEmenda } from './auxiliares-de-emendas.js';

afterEach(async () => {
  await a.encerrar();
});

const post = (cookie: string, url: string, corpo: object) =>
  a.chamar('POST', url, { cookie, corpo });
const ficha = async (cookie: string, id: number) =>
  (await a.chamar('GET', `/api/emendas/${id}`, { cookie })).json();

describe('cadastrar emenda', () => {
  it('nasce em Disponível, só com o valor disponibilizado: o resto é derivado', async () => {
    const e = await preparar();
    const emenda = await novaEmenda(e.cookie.interno);
    expect(emenda).toMatchObject({
      identificacao: 'EMD 2026/0001',
      status: 'em_andamento',
      etapa: { nome: 'Disponível', papel: 'entrada' },
      responsavel: { id: e.id.interno },
      valores: {
        disponibilizado: '100000.00',
        comprometido: '0.00',
        utilizado: '0.00',
        disponivel: '100000.00',
        aExecutar: '0.00',
      },
    });
    expect(emenda.historicoDoValor).toHaveLength(1);
    expect((await a.trilha('emenda.criar')).length).toBe(1);
    // Não existe coluna de saldo no banco.
    const colunas = await a.banco.conectar('api').cliente<
      { column_name: string }[]
    >`SELECT column_name FROM information_schema.columns WHERE table_name IN ('emenda', 'destinacao')`;
    for (const proibida of ['saldo', 'disponivel', 'comprometido', 'utilizado', 'a_executar']) {
      expect(colunas.map((c) => c.column_name)).not.toContain(proibida);
    }
  });

  it('exige identificação e finalidade, valor positivo e exercício entre 2000 e 2100', async () => {
    const e = await preparar();
    const tipoId = await tipoDeEmenda(e.cookie.interno);
    const base = { identificacao: 'X', exercicio: 2026, tipoId, finalidade: 'Y', valor: '10.00' };
    const tenta = (extra: object) =>
      post(e.cookie.interno, '/api/emendas', { ...base, ...extra }).then((r) => r.statusCode);
    expect(await tenta({})).toBe(201);
    expect(await tenta({ identificacao: ' ', exercicio: 2027 })).toBe(400);
    expect(await tenta({ finalidade: '', exercicio: 2027 })).toBe(400);
    for (const valor of ['0', '-5', '1.234', 'abc'])
      expect(await tenta({ valor, exercicio: 2027 }), valor).toBe(400);
    for (const exercicio of [1999, 2101])
      expect(await tenta({ exercicio }), String(exercicio)).toBe(400);
  });

  it('a identificação não repete no mesmo exercício (qualquer caixa); em outro exercício, pode', async () => {
    const e = await preparar();
    await novaEmenda(e.cookie.interno);
    const tipoId = await tipoDeEmenda(e.cookie.interno);
    const base = {
      identificacao: 'emd 2026/0001',
      exercicio: 2026,
      tipoId,
      finalidade: 'Y',
      valor: '10.00',
    };
    expect((await post(e.cookie.interno, '/api/emendas', base)).statusCode).toBe(409);
    expect(
      (await post(e.cookie.interno, '/api/emendas', { ...base, exercicio: 2027 })).statusCode,
    ).toBe(201);
  });

  it('recusa prazo anterior a hoje na criação, tipo inválido e responsável sem LG', async () => {
    const e = await preparar();
    const tipoId = await tipoDeEmenda(e.cookie.interno);
    const base = { identificacao: 'A', exercicio: 2026, tipoId, finalidade: 'Y', valor: '10.00' };
    expect(
      (await post(e.cookie.interno, '/api/emendas', { ...base, prazoEmpenho: '2026-11-11' }))
        .statusCode,
    ).toBe(409);
    expect(
      (await post(e.cookie.interno, '/api/emendas', { ...base, prazoEmpenho: '2026-11-12' }))
        .statusCode,
    ).toBe(201);
    expect(
      (
        await post(e.cookie.interno, '/api/emendas', {
          ...base,
          identificacao: 'B',
          tipoId: 999999,
        })
      ).statusCode,
    ).toBe(409);
    expect(
      (
        await post(e.cookie.interno, '/api/emendas', {
          ...base,
          identificacao: 'C',
          responsavelId: e.id.semLegislativo,
        })
      ).statusCode,
    ).toBe(409);
  });
});

describe('destinações, execuções e os valores derivados', () => {
  it('destinar reduz o disponível; passar dele é recusado; cancelar devolve', async () => {
    const e = await preparar();
    const emenda = await novaEmenda(e.cookie.interno);
    const r = await destinar(e.cookie.interno, emenda.id, e.beneficiario, '75000.00');
    expect(r.statusCode, r.body).toBe(201);
    expect(r.json().valores).toMatchObject({
      comprometido: '75000.00',
      disponivel: '25000.00',
      aExecutar: '75000.00',
    });
    expect(r.json().destinacoes[0]).toMatchObject({
      valor: '75000.00',
      etapa: { nome: 'Indicada' },
      cancelada: false,
    });

    expect(
      (await destinar(e.cookie.interno, emenda.id, e.beneficiario, '25000.01')).statusCode,
    ).toBe(409);
    expect(
      (await destinar(e.cookie.interno, emenda.id, e.beneficiario, '25000.00')).statusCode,
    ).toBe(201);

    const antes = (await ficha(e.cookie.interno, emenda.id)).destinacoes[0].id;
    const cancelar = await post(
      e.cookie.supervisor,
      `/api/emendas/${emenda.id}/destinacoes/${antes}/cancelar`,
      {
        justificativa: 'O beneficiário desistiu do projeto',
      },
    );
    expect(cancelar.statusCode, cancelar.body).toBe(200);
    expect(cancelar.json().valores).toMatchObject({
      comprometido: '25000.00',
      disponivel: '75000.00',
    });
    expect(
      (await destinar(e.cookie.interno, emenda.id, e.beneficiario, '75000.00')).statusCode,
    ).toBe(201);
  });

  it('a execução não passa da destinação, não tem data futura e soma no utilizado', async () => {
    const e = await preparar();
    const emenda = await novaEmenda(e.cookie.interno);
    const d = (await destinar(e.cookie.interno, emenda.id, e.beneficiario, '1000.00')).json()
      .destinacoes[0].id;
    const executar = (valor: string, data = '2026-11-10') =>
      post(e.cookie.interno, `/api/emendas/${emenda.id}/destinacoes/${d}/execucoes`, {
        valor,
        data,
      });

    const ok = await executar('600.00');
    expect(ok.statusCode, ok.body).toBe(201);
    expect(ok.json().valores).toMatchObject({ utilizado: '600.00', aExecutar: '400.00' });
    expect(ok.json().destinacoes[0]).toMatchObject({ executado: '600.00', aExecutar: '400.00' });
    expect((await executar('400.01')).statusCode).toBe(409);
    expect((await executar('100.00', '2026-11-13')).statusCode).toBe(409); // depois de "hoje" (12/11)
    expect((await executar('0')).statusCode).toBe(400);
    expect((await executar('400.00')).statusCode).toBe(201);
    expect((await ficha(e.cookie.interno, emenda.id)).valores.aExecutar).toBe('0.00');
  });

  it('destinação com execução não se cancela; a cancelada não recebe execução', async () => {
    const e = await preparar();
    const emenda = await novaEmenda(e.cookie.interno);
    const executada = (
      await destinar(e.cookie.interno, emenda.id, e.beneficiario, '1000.00')
    ).json().destinacoes[0].id;
    await post(e.cookie.interno, `/api/emendas/${emenda.id}/destinacoes/${executada}/execucoes`, {
      valor: '100.00',
      data: '2026-11-10',
    });
    const cancelar = (id: number) =>
      post(e.cookie.supervisor, `/api/emendas/${emenda.id}/destinacoes/${id}/cancelar`, {
        justificativa: 'Tentativa de cancelar a destinação',
      });
    expect((await cancelar(executada)).statusCode).toBe(409);

    await destinar(e.cookie.interno, emenda.id, e.beneficiario, '500.00');
    const livre = (await ficha(e.cookie.interno, emenda.id)).destinacoes[1].id;
    expect((await cancelar(livre)).statusCode).toBe(200);
    expect(
      (
        await post(e.cookie.interno, `/api/emendas/${emenda.id}/destinacoes/${livre}/execucoes`, {
          valor: '10.00',
          data: '2026-11-10',
        })
      ).statusCode,
    ).toBe(409);
  });

  it('o valor da emenda não fica abaixo do comprometido; o histórico guarda os valores', async () => {
    const e = await preparar();
    const emenda = await novaEmenda(e.cookie.interno);
    await destinar(e.cookie.interno, emenda.id, e.beneficiario, '60000.00');
    const editar = (valor: string) =>
      a.chamar('PATCH', `/api/emendas/${emenda.id}`, {
        cookie: e.cookie.interno,
        corpo: { valor },
      });
    expect((await editar('59999.99')).statusCode).toBe(409);
    const ok = await editar('60000.00');
    expect(ok.statusCode, ok.body).toBe(200);
    expect(ok.json().valores).toMatchObject({ disponibilizado: '60000.00', disponivel: '0.00' });
    expect(ok.json().historicoDoValor.map((h: any) => h.valor)).toEqual(['60000.00', '100000.00']);
  });

  it('somente quem acompanha destina: outro Assessor Interno é recusado; o Financeiro só consulta', async () => {
    const e = await preparar();
    const emenda = await novaEmenda(e.cookie.interno);
    expect((await destinar(e.cookie.interno2, emenda.id, e.beneficiario, '10.00')).statusCode).toBe(
      403,
    );
    expect(
      (await destinar(e.cookie.supervisor, emenda.id, e.beneficiario, '10.00')).statusCode,
    ).toBe(201);
    expect(
      (await destinar(e.cookie.financeiro, emenda.id, e.beneficiario, '10.00')).statusCode,
    ).toBe(404);
    expect(
      (await a.chamar('GET', `/api/emendas/${emenda.id}`, { cookie: e.cookie.financeiro }))
        .statusCode,
    ).toBe(200);
  });

  it('beneficiário inativo ou inexistente não recebe destinação', async () => {
    const e = await preparar();
    const emenda = await novaEmenda(e.cookie.interno);
    await a.chamar('PUT', `/api/beneficiarios/${e.outroBeneficiario}/situacao`, {
      cookie: e.cookie.supervisor,
      corpo: { situacao: 'inativo' },
    });
    expect(
      (await destinar(e.cookie.interno, emenda.id, e.outroBeneficiario, '10.00')).statusCode,
    ).toBe(409);
    expect((await destinar(e.cookie.interno, emenda.id, 999999, '10.00')).statusCode).toBe(409);
  });
});

describe('propriedade: as somas sempre fecham', () => {
  it('depois de uma sequência de operações, os números respeitam os limites', async () => {
    const e = await preparar();
    const emenda = await novaEmenda(e.cookie.interno, { valor: '1000.00' });
    let semente = 20261117;
    const sorteio = (n: number) => {
      semente = (semente * 1664525 + 1013904223) % 4294967296;
      return semente % n;
    };
    for (let i = 0; i < 40; i += 1) {
      const atual = await ficha(e.cookie.interno, emenda.id);
      const passo = sorteio(4);
      if (passo === 0 || atual.destinacoes.filter((d: any) => !d.cancelada).length === 0) {
        await destinar(e.cookie.interno, emenda.id, e.beneficiario, `${(sorteio(400) + 1) / 2}`);
      } else if (passo === 1) {
        const d = atual.destinacoes.filter((x: any) => !x.cancelada)[0];
        await post(e.cookie.interno, `/api/emendas/${emenda.id}/destinacoes/${d.id}/execucoes`, {
          valor: `${(sorteio(300) + 1) / 2}`,
          data: '2026-11-10',
        });
      } else if (passo === 2) {
        const d = atual.destinacoes.filter((x: any) => !x.cancelada)[0];
        await post(e.cookie.supervisor, `/api/emendas/${emenda.id}/destinacoes/${d.id}/cancelar`, {
          justificativa: 'Cancelamento para o teste de propriedade',
        });
      } else {
        await a.chamar('PATCH', `/api/emendas/${emenda.id}`, {
          cookie: e.cookie.interno,
          corpo: { valor: `${500 + sorteio(1500)}` },
        });
      }
      const v = (await ficha(e.cookie.interno, emenda.id)).valores;
      const c = (s: string) => Math.round(Number(s) * 100);
      expect(c(v.comprometido), `passo ${i}`).toBeLessThanOrEqual(c(v.disponibilizado));
      expect(c(v.utilizado)).toBeLessThanOrEqual(c(v.comprometido));
      expect(c(v.disponivel)).toBe(c(v.disponibilizado) - c(v.comprometido));
      expect(c(v.aExecutar)).toBe(c(v.comprometido) - c(v.utilizado));
      expect(c(v.disponivel)).toBeGreaterThanOrEqual(0);
    }
  });
});
