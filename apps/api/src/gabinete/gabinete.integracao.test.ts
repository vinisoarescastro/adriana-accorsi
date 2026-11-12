import { afterEach, describe, expect, inject, it } from 'vitest';
import { iniciarAmbiente, type Ambiente } from '../teste/auxiliares.js';

let a: Ambiente;
afterEach(async () => {
  await a.encerrar();
});

const png = (extra = 16) =>
  Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.alloc(extra, 7),
  ]);
const jpeg = () => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(16, 3)]);

async function preparar() {
  a = await iniciarAmbiente(inject('urlAdminDeTeste'));
  await a.criarUsuario({ perfil: 'administrador' });
  const chefe = await a.criarUsuario({ perfil: 'chefe' });
  const supervisor = await a.criarUsuario({ perfil: 'supervisor' });
  const externo = await a.criarUsuario({ perfil: 'assessor_externo' });
  const interno = await a.criarUsuario({ perfil: 'assessor_interno' });
  return {
    chefe,
    cookieChefe: await a.sessaoDe(chefe.email),
    cookieSupervisor: await a.sessaoDe(supervisor.email),
    cookieExterno: await a.sessaoDe(externo.email),
    cookieInterno: await a.sessaoDe(interno.email),
  };
}

const identidade = {
  nome: 'Gabinete de Exemplo',
  parlamentarNome: 'Parlamentar de Exemplo',
  cargo: 'Deputado(a) Federal',
  partido: 'SIGLA',
  mandato: '2027 a 2031',
  contatoTelefone: '(61) 3000-0000',
};

describe('identidade do gabinete', () => {
  it('antes de configurar, a consulta responde como inexistente; o Chefe configura e todos consultam', async () => {
    const { cookieChefe, cookieExterno } = await preparar();
    expect((await a.chamar('GET', '/api/gabinete', { cookie: cookieChefe })).statusCode).toBe(404);

    const salvo = await a.chamar('PUT', '/api/gabinete', {
      cookie: cookieChefe,
      corpo: identidade,
    });
    expect(salvo.statusCode).toBe(200);
    expect(salvo.json()).toMatchObject({
      nome: 'Gabinete de Exemplo',
      temFoto: false,
      fuso: 'America/Sao_Paulo',
    });

    const lido = await a.chamar('GET', '/api/gabinete', { cookie: cookieExterno });
    expect(lido.json().parlamentarNome).toBe('Parlamentar de Exemplo');

    const atualizado = await a.chamar('PUT', '/api/gabinete', {
      cookie: cookieChefe,
      corpo: { ...identidade, partido: 'OUTRA' },
    });
    expect(atualizado.json().partido).toBe('OUTRA');

    const trilha = await a.trilha();
    expect(trilha.map((t) => t.operacao)).toEqual(
      expect.arrayContaining(['gabinete.criar', 'gabinete.atualizar']),
    );
  });

  it('só Chefe e Administrador editam', async () => {
    const { cookieSupervisor, cookieInterno } = await preparar();
    for (const cookie of [cookieSupervisor, cookieInterno]) {
      expect(
        (await a.chamar('PUT', '/api/gabinete', { cookie, corpo: identidade })).statusCode,
      ).toBe(404);
    }
  });
});

describe('fotos', () => {
  it('guarda PNG ou JPEG verificados pelo conteúdo, entrega pela API e troca a anterior', async () => {
    const { cookieChefe, cookieExterno } = await preparar();
    await a.chamar('PUT', '/api/gabinete', { cookie: cookieChefe, corpo: identidade });

    const enviar = (bytes: Buffer, tipo: string) =>
      a.app.inject({
        method: 'POST',
        url: '/api/gabinete/foto',
        payload: bytes,
        headers: { cookie: cookieChefe, 'content-type': tipo },
      });

    expect((await enviar(png(), 'image/png')).statusCode).toBe(204);
    const primeira = [...a.armazenamento.objetos.keys()];
    expect(primeira).toHaveLength(1);
    expect(primeira[0]).toMatch(/^fotos\/gabinete\/.+\.png$/);

    const lida = await a.chamar('GET', '/api/gabinete/foto', { cookie: cookieExterno });
    expect(lida.statusCode).toBe(200);
    expect(lida.headers['content-type']).toBe('image/png');
    expect(lida.headers['x-content-type-options']).toBe('nosniff');
    expect(lida.rawPayload.equals(png())).toBe(true);

    expect((await enviar(jpeg(), 'image/jpeg')).statusCode).toBe(204);
    const depois = [...a.armazenamento.objetos.keys()];
    expect(depois).toHaveLength(1);
    expect(depois[0]).toMatch(/\.jpg$/);
    expect(depois[0]).not.toBe(primeira[0]);
    expect((await a.chamar('GET', '/api/gabinete', { cookie: cookieChefe })).json().temFoto).toBe(
      true,
    );
  });

  it('recusa arquivo que não é imagem mesmo com o tipo declarado, e foto maior que 2 MB', async () => {
    const { cookieChefe } = await preparar();
    await a.chamar('PUT', '/api/gabinete', { cookie: cookieChefe, corpo: identidade });

    const enviar = (bytes: Buffer, tipo = 'image/png') =>
      a.app.inject({
        method: 'POST',
        url: '/api/gabinete/foto',
        payload: bytes,
        headers: { cookie: cookieChefe, 'content-type': tipo },
      });

    const falso = await enviar(Buffer.from('MZ\x90\x00 isto é um executável'));
    expect(falso.statusCode).toBe(400);
    expect(falso.json().codigo).toBe('arquivo_invalido');

    const grande = await enviar(png(2 * 1024 * 1024));
    expect([400, 413]).toContain(grande.statusCode);

    const json = await a.chamar('POST', '/api/gabinete/foto', {
      cookie: cookieChefe,
      corpo: { oi: 1 },
    });
    expect(json.statusCode).toBe(400);
    expect(a.armazenamento.objetos.size).toBe(0);
  });

  it('cada um troca a própria foto, e quem não tem foto responde como inexistente', async () => {
    const { chefe, cookieChefe, cookieExterno } = await preparar();
    const idChefe = (
      await a.banco.conectar('api').cliente<{ id: string }[]>`
        SELECT u.id FROM usuario u JOIN conta_acesso c ON c.id = u.conta_id WHERE c.email = ${chefe.email}`
    )[0]?.id;

    expect(
      (await a.chamar('GET', `/api/equipe/${idChefe}/foto`, { cookie: cookieExterno })).statusCode,
    ).toBe(404);

    const envio = await a.app.inject({
      method: 'POST',
      url: '/api/perfil/foto',
      payload: jpeg(),
      headers: { cookie: cookieChefe, 'content-type': 'image/jpeg' },
    });
    expect(envio.statusCode).toBe(204);

    const lida = await a.chamar('GET', `/api/equipe/${idChefe}/foto`, { cookie: cookieExterno });
    expect(lida.statusCode).toBe(200);
    expect(lida.headers['content-type']).toBe('image/jpeg');
    expect(
      (await a.chamar('GET', `/api/equipe/${idChefe}`, { cookie: cookieChefe })).json().temFoto,
    ).toBe(true);
  });
});

describe('auditoria', () => {
  it('o Chefe consulta a trilha com filtros e paginação; quem não pode recebe 404', async () => {
    const { cookieChefe, cookieSupervisor } = await preparar();
    for (let i = 0; i < 3; i += 1) {
      await a.chamar('PUT', '/api/gabinete', {
        cookie: cookieChefe,
        corpo: { ...identidade, partido: `P${i}` },
      });
    }

    const todas = (
      await a.chamar('GET', '/api/auditoria?porPagina=2&pagina=1', { cookie: cookieChefe })
    ).json();
    expect(todas.itens).toHaveLength(2);
    expect(todas.total).toBeGreaterThanOrEqual(4);
    expect(todas.itens[0].id).toBeGreaterThan(todas.itens[1].id);

    const filtradas = (
      await a.chamar('GET', '/api/auditoria?operacao=gabinete.atualizar', { cookie: cookieChefe })
    ).json();
    expect(filtradas.total).toBe(2);
    expect(filtradas.itens[0]).toMatchObject({
      operacao: 'gabinete.atualizar',
      entidade: 'gabinete',
    });
    expect(filtradas.itens[0].autorNome).toMatch(/Usuário/);

    expect((await a.chamar('GET', '/api/auditoria', { cookie: cookieSupervisor })).statusCode).toBe(
      404,
    );
    expect(
      (await a.chamar('GET', '/api/auditoria?porPagina=500', { cookie: cookieChefe })).statusCode,
    ).toBe(400);
  });

  it('o histórico de um registro serve o Assessor Interno, só para entidades liberadas', async () => {
    const { cookieChefe, cookieInterno, cookieExterno } = await preparar();
    await a.chamar('PUT', '/api/gabinete', { cookie: cookieChefe, corpo: identidade });

    const historico = await a.chamar('GET', '/api/historico/gabinete/1', { cookie: cookieInterno });
    expect(historico.statusCode).toBe(200);
    expect(historico.json()[0]).toMatchObject({ operacao: 'gabinete.criar' });

    expect(
      (await a.chamar('GET', '/api/historico/demanda/1', { cookie: cookieInterno })).statusCode,
    ).toBe(404);
    expect(
      (await a.chamar('GET', '/api/historico/gabinete/1', { cookie: cookieExterno })).statusCode,
    ).toBe(404);
  });

  it('a trilha nunca expõe senha nem verificador', async () => {
    const { cookieChefe } = await preparar();
    const corpo = (await a.chamar('GET', '/api/auditoria?porPagina=100', { cookie: cookieChefe }))
      .body;
    expect(corpo).not.toMatch(/argon2|verificador|senha_inicial|senhaInicial/i);
  });
});
