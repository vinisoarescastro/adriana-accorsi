/* eslint-disable @typescript-eslint/no-explicit-any -- corpos JSON das respostas, sem tipo */
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
  const outroInterno = await a.criarUsuario({ perfil: 'assessor_interno', habilitacoes: ['AT'] });
  const externo = await a.criarUsuario({ perfil: 'assessor_externo', habilitacoes: ['AT'] });
  const semAtendimento = await a.criarUsuario({ perfil: 'assessor_interno', habilitacoes: ['AG'] });
  const uid = async (email: string) =>
    Number(
      (
        await a.banco.conectar('api').cliente<
          { id: string }[]
        >`SELECT u.id FROM usuario u JOIN conta_acesso c ON c.id = u.conta_id WHERE c.email = ${email}`
      )[0]?.id,
    );
  const cookie = {
    admin: await a.sessaoDe(admin.email),
    supervisor: await a.sessaoDe(supervisor.email),
    interno: await a.sessaoDe(interno.email),
    outroInterno: await a.sessaoDe(outroInterno.email),
    externo: await a.sessaoDe(externo.email),
  };
  const id = {
    supervisor: await uid(supervisor.email),
    outroInterno: await uid(outroInterno.email),
    semAtendimento: await uid(semAtendimento.email),
    admin: await uid(admin.email),
    interno: await uid(interno.email),
  };
  const demanda = (
    await a.chamar('POST', '/api/demandas', {
      cookie: cookie.interno,
      corpo: { solicitante: { nome: 'Maria', telefone: '67999990000' }, titulo: 'Poda' },
    })
  ).json().demanda;
  return { cookie, id, demanda };
}

describe('comentários internos', () => {
  it('comenta, lista em ordem e menciona colegas (só os que alcançam o registro)', async () => {
    const { cookie, id, demanda } = await preparar();
    const r = await a.chamar('POST', `/api/demandas/${demanda.id}/comentarios`, {
      cookie: cookie.interno,
      // O de AG não tem AT, o 999999 não existe, o repetido conta uma vez.
      corpo: {
        texto: 'Falei com o @Supervisor sobre isso',
        mencoes: [id.supervisor, id.supervisor, id.semAtendimento, 999999, id.admin],
      },
    });
    expect(r.statusCode, r.body).toBe(201);
    const [comentario] = r.json();
    expect(comentario).toMatchObject({
      texto: 'Falei com o @Supervisor sobre isso',
      removido: false,
    });
    expect(comentario.mencoes.map((m: any) => m.id).sort()).toEqual(
      [id.supervisor, id.admin].sort(),
    );

    await a.chamar('POST', `/api/demandas/${demanda.id}/comentarios`, {
      cookie: cookie.supervisor,
      corpo: { texto: 'Ok, acompanhe' },
    });
    const ficha = (
      await a.chamar('GET', `/api/demandas/${demanda.id}`, { cookie: cookie.supervisor })
    ).json();
    expect(ficha.comentarios.map((c: any) => c.texto)).toEqual([
      'Falei com o @Supervisor sobre isso',
      'Ok, acompanhe',
    ]);

    // A trilha guarda o id e quem foi mencionado, nunca o texto.
    const trilha = JSON.stringify(await a.trilha('demanda.comentar'));
    expect(trilha).not.toMatch(/Falei com|Supervisor sobre/);
  });

  it('o Assessor Externo não comenta (a ficha completa é do Interno em diante)', async () => {
    const { cookie, demanda } = await preparar();
    expect(
      (
        await a.chamar('POST', `/api/demandas/${demanda.id}/comentarios`, {
          cookie: cookie.externo,
          corpo: { texto: 'oi' },
        })
      ).statusCode,
    ).toBe(404);
  });

  it('recusa texto vazio ou longo demais, e demanda inexistente', async () => {
    const { cookie, demanda } = await preparar();
    for (const texto of ['', '   ', 'x'.repeat(5001)]) {
      expect(
        (
          await a.chamar('POST', `/api/demandas/${demanda.id}/comentarios`, {
            cookie: cookie.interno,
            corpo: { texto },
          })
        ).statusCode,
      ).toBe(400);
    }
    expect(
      (
        await a.chamar('POST', '/api/demandas/999999/comentarios', {
          cookie: cookie.interno,
          corpo: { texto: 'oi' },
        })
      ).statusCode,
    ).toBe(404);
  });

  it('cada um remove o próprio; o de terceiro exige Supervisor; remover deixa marca e esconde o texto', async () => {
    const { cookie, demanda } = await preparar();
    const novo = async (quem: 'interno' | 'outroInterno', texto: string) =>
      (
        await a.chamar('POST', `/api/demandas/${demanda.id}/comentarios`, {
          cookie: cookie[quem],
          corpo: { texto },
        })
      )
        .json()
        .at(-1).id as number;

    const doInterno = await novo('interno', 'Segredo do gabinete');
    expect(
      (await a.chamar('DELETE', `/api/comentarios/${doInterno}`, { cookie: cookie.outroInterno }))
        .statusCode,
    ).toBe(403);

    const removido = await a.chamar('DELETE', `/api/comentarios/${doInterno}`, {
      cookie: cookie.interno,
    });
    expect(removido.statusCode).toBe(200);
    const [marca] = removido.json();
    expect(marca).toMatchObject({
      removido: true,
      texto: null,
      removidoPor: expect.stringMatching(/Usuário/) as string,
    });
    expect(marca.removidoEm).toBeTruthy();
    expect(
      JSON.stringify(
        (await a.chamar('GET', `/api/demandas/${demanda.id}`, { cookie: cookie.interno })).json(),
      ),
    ).not.toContain('Segredo do gabinete');
    expect(
      (await a.chamar('DELETE', `/api/comentarios/${doInterno}`, { cookie: cookie.interno }))
        .statusCode,
    ).toBe(409);

    // O Supervisor remove o de terceiro.
    const doOutro = await novo('outroInterno', 'Comentário de terceiro');
    expect(
      (await a.chamar('DELETE', `/api/comentarios/${doOutro}`, { cookie: cookie.supervisor }))
        .statusCode,
    ).toBe(200);
    // O texto continua guardado (auditoria), mas a API nunca o devolve.
    const [linha] = await a.banco.conectar('api').cliente<
      { texto: string }[]
    >`SELECT texto FROM comentario_interno WHERE id = ${doOutro}`;
    expect(linha?.texto).toBe('Comentário de terceiro');
  });

  it('não existe rota que publique um comentário (critério 7)', async () => {
    await preparar();
    const rotas = a.app.printRoutes({ commonPrefix: false });
    const decomentario = rotas.split('\n').filter((l) => /comentario/i.test(l));
    expect(decomentario.length).toBeGreaterThan(0);
    for (const linha of decomentario) {
      expect(linha).not.toMatch(/public|andamento|compart|divulg/i);
    }
    // E a única rota que altera um comentário é a de remoção (DELETE).
    expect(a.app.hasRoute({ method: 'PUT', url: '/api/comentarios/:id' })).toBe(false);
    expect(a.app.hasRoute({ method: 'PATCH', url: '/api/comentarios/:id' })).toBe(false);
  });
});
