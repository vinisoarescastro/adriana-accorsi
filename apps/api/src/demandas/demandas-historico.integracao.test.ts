/* eslint-disable @typescript-eslint/no-explicit-any -- corpos JSON das respostas, sem tipo */
import { afterEach, describe, expect, it } from 'vitest';
import { a, etapaPor, novaDemanda, preparar, registrar } from './auxiliares-de-demandas.js';

afterEach(async () => {
  await a.encerrar();
});

describe('histórico por registro', () => {
  it('a trilha da demanda é consultável pelo Assessor Interno, só de entidades liberadas', async () => {
    const { cookie } = await preparar();
    const { demanda } = await registrar(cookie.interno);
    await a.chamar('POST', `/api/demandas/${demanda.id}/mover`, {
      cookie: cookie.interno,
      corpo: { etapaId: await etapaPor(cookie.interno, 'Em triagem') },
    });

    const h = (
      await a.chamar('GET', `/api/historico/demanda/${demanda.id}`, { cookie: cookie.interno })
    ).json();
    expect(h.map((e: any) => e.operacao).sort()).toEqual(['demanda.mover', 'demanda.registrar']);
    expect(
      (await a.chamar('GET', `/api/historico/demanda/${demanda.id}`, { cookie: cookie.externo }))
        .statusCode,
    ).toBe(404);
    expect(
      (
        await a.chamar('GET', `/api/historico/pessoa/${demanda.solicitante.id}`, {
          cookie: cookie.interno,
        })
      ).statusCode,
    ).toBe(200);
  });
});

describe('eliminar dados da pessoa preserva protocolo e histórico (critério 9)', () => {
  it('a demanda segue de pé, com o solicitante despersonalizado', async () => {
    const { cookie } = await preparar();
    const { demanda } = await registrar(cookie.interno);
    await a.chamar('POST', `/api/pessoas/${demanda.solicitante.id}/eliminar-dados`, {
      cookie: cookie.admin,
      corpo: { confirmo: true },
    });

    const ficha = (
      await a.chamar('GET', `/api/demandas/${demanda.id}`, { cookie: cookie.interno })
    ).json();
    expect(ficha.protocolo).toBe(demanda.protocolo);
    expect(ficha.solicitante.nome).toBeNull();
    expect(ficha.solicitanteTelefone).toBeNull();
    expect(ficha.movimentacoes).toHaveLength(1);
    expect(JSON.stringify(await a.trilha())).not.toMatch(/Maria da Silva|99999/);
  });
});

describe('atomicidade (RN-DEM-01)', () => {
  it('se o protocolo não puder ser emitido, nada é criado: nem pessoa, nem demanda, nem trilha', async () => {
    const { cookie } = await preparar({ gerarProtocolo: () => 'K7M29PQ4XA3N' });
    await registrar(
      cookie.interno,
      novaDemanda({ solicitante: { nome: 'Joana', telefone: '67988887777' } }),
    );

    const antes = await contagens();
    // O gerador só produz um protocolo já emitido: a emissão falha depois de a pessoa ser criada.
    const r = await a.chamar('POST', '/api/demandas', {
      cookie: cookie.interno,
      corpo: novaDemanda(),
    });
    expect(r.statusCode).toBe(500);
    expect(await contagens()).toEqual(antes);
  });

  async function contagens() {
    const [l] = await a.banco.conectar('api').cliente<
      { p: string; d: string; t: string; m: string; e: string }[]
    >`
      SELECT (SELECT count(*) FROM pessoa) AS p, (SELECT count(*) FROM demanda) AS d,
             (SELECT count(*) FROM trilha) AS t, (SELECT count(*) FROM movimentacao) AS m,
             (SELECT count(*) FROM protocolo_emitido) AS e`;
    return l;
  }
});

describe('demanda cancelada é só de leitura (RN-DEM-09)', () => {
  it('não recebe comentário nem documento, não perde os existentes, e o download segue valendo', async () => {
    const { cookie } = await preparar();
    const { demanda } = await registrar(cookie.interno);
    const pdf = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');
    const anexo = (cookieDe: string) =>
      a.chamar('POST', `/api/demandas/${demanda.id}/documentos?nome=a.pdf&natureza=outro`, {
        cookie: cookieDe,
        corpo: pdf,
        cabecalhos: { 'content-type': 'application/pdf' },
      });
    const comentario = (
      await a.chamar('POST', `/api/demandas/${demanda.id}/comentarios`, {
        cookie: cookie.interno,
        corpo: { texto: 'antes do cancelamento', mencoes: [] },
      })
    ).json();
    const documentos = (await anexo(cookie.interno)).json();
    expect(documentos).toHaveLength(1);

    await a.chamar('POST', `/api/demandas/${demanda.id}/cancelar`, {
      cookie: cookie.supervisor,
      corpo: { justificativa: 'Pedido duplicado do cidadão' },
    });

    const novo = await a.chamar('POST', `/api/demandas/${demanda.id}/comentarios`, {
      cookie: cookie.interno,
      corpo: { texto: 'depois', mencoes: [] },
    });
    expect(novo.statusCode).toBe(409);
    expect((await anexo(cookie.interno)).statusCode).toBe(409);
    expect(
      (
        await a.chamar('DELETE', `/api/comentarios/${comentario[0].id}`, {
          cookie: cookie.supervisor,
        })
      ).statusCode,
    ).toBe(409);
    expect(
      (
        await a.chamar('DELETE', `/api/documentos/${documentos[0].id}`, {
          cookie: cookie.supervisor,
        })
      ).statusCode,
    ).toBe(409);

    const ficha = (
      await a.chamar('GET', `/api/demandas/${demanda.id}`, { cookie: cookie.interno })
    ).json();
    expect(ficha.comentarios).toHaveLength(1);
    expect(ficha.comentarios[0].removido).toBe(false);
    expect(ficha.documentos).toHaveLength(1);
    const baixar = await a.chamar('GET', `/api/documentos/${documentos[0].id}/conteudo`, {
      cookie: cookie.interno,
    });
    expect(baixar.statusCode).toBe(200);
  });
});
