import { createHash, randomBytes } from 'node:crypto';
import { criarBancoDeTeste, type BancoDeTeste } from '@gabinete/banco/teste';
import type { FastifyInstance } from 'fastify';
import type postgres from 'postgres';
import { afterEach, beforeEach, describe, expect, inject, it } from 'vitest';
import { LimitadorDeConsultas } from './limitador.js';
import { construirServidorPublico } from './servidor.js';

declare module 'vitest' {
  export interface ProvidedContext {
    urlAdminDeTeste: string;
  }
}

let banco: BancoDeTeste;
let app: FastifyInstance;
let dono: postgres.Sql;
let api: postgres.Sql;
let agora = 1_000_000;
let usuarioId: number;
let contador = 0;

const sha = (v: string) => createHash('sha256').update(v).digest('hex');

beforeEach(async () => {
  agora = 1_000_000;
  banco = await criarBancoDeTeste(inject('urlAdminDeTeste'));
  dono = banco.conectar('migracao').cliente;
  api = banco.conectar('api').cliente;
  const [conta] = await api<{ id: number }[]>`
    INSERT INTO conta_acesso (email, verificador_senha) VALUES ('a@exemplo.test', 'h') RETURNING id`;
  const [u] = await api<{ id: number }[]>`
    INSERT INTO usuario (conta_id, nome, perfil) VALUES (${conta!.id}, 'Responsável Interno Secreto', 'administrador') RETURNING id`;
  usuarioId = Number(u!.id);
  app = await construirServidorPublico({
    cliente: banco.conectar('publico').cliente,
    limitador: new LimitadorDeConsultas({ agora: () => agora }),
    esperar: async () => undefined,
  });
});

afterEach(async () => {
  await app.close();
  await banco.encerrar();
});

const alfabeto = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

/** Uma demanda com tudo o que NÃO pode vazar: título, descrição, prioridade, responsável, etapa interna. */
async function novaDemanda(opcoes: { situacao?: string } = {}) {
  contador += 1;
  const protocolo = `K7M2${[...String(contador).padStart(8, '0')].map((c) => alfabeto[Number(c)]).join('')}`;
  const telefone = `679${String(contador).padStart(8, '0')}`;
  const segredo = randomBytes(32).toString('base64url');
  const [p] = await api<{ id: number }[]>`
    INSERT INTO pessoa (nome_completo, telefone_normalizado, email)
    VALUES ('Maria da Silva', ${telefone}, 'maria@exemplo.test') RETURNING id`;
  await api`INSERT INTO protocolo_emitido (protocolo) VALUES (${protocolo})`;
  const [e] = await api<{ id: number }[]>`
    SELECT e.id FROM etapa e JOIN tipo_processo t ON t.id = e.tipo_processo_id
    WHERE t.tipo = 'demanda' AND e.papel = 'entrada'`;
  await dono`UPDATE etapa SET nome_interno = 'ETAPA-INTERNA-SECRETA', visivel_publico = true, rotulo_publico = 'Recebida' WHERE id = ${e!.id}`;
  const [d] = await api<{ id: number }[]>`
    INSERT INTO demanda (protocolo, segredo_link_hash, segredo_link_cifrado, publicacao_link, solicitante_id, responsavel_id, autor_id, titulo, descricao, prioridade, etapa_atual_id)
    VALUES (${protocolo}, ${sha(segredo)}, 'cifrado', ${opcoes.situacao ?? 'ativa'}, ${p!.id}, ${usuarioId}, ${usuarioId},
            'TITULO-INTERNO-SECRETO', 'DESCRICAO-INTERNA-SECRETA', 'urgente', ${e!.id}) RETURNING id`;
  const [t] = await api<{ id: number }[]>`SELECT id FROM tipo_processo WHERE tipo = 'demanda'`;
  await api`INSERT INTO movimentacao (registro_tipo, registro_id, tipo_processo_id, etapa_destino_id, autor_id)
            VALUES ('demanda', ${d!.id}, ${t!.id}, ${e!.id}, ${usuarioId})`;
  await api`INSERT INTO comentario_interno (registro_tipo, registro_id, autor_id, texto)
            VALUES ('demanda', ${d!.id}, ${usuarioId}, 'COMENTARIO-INTERNO-SECRETO')`;
  await api`INSERT INTO andamento_publicado (demanda_id, texto, autor_id) VALUES (${d!.id}, 'Equipe vistoriou o local.', ${usuarioId})`;
  const formatado = `${protocolo.slice(0, 4)}-${protocolo.slice(4, 8)}-${protocolo.slice(8)}`;
  return { id: Number(d!.id), protocolo, formatado, telefone, segredo, pessoaId: Number(p!.id) };
}

const consultar = (protocolo: string, telefone: string, ip = '10.0.0.1') =>
  app.inject({
    method: 'POST',
    url: '/consultar',
    payload: `protocolo=${encodeURIComponent(protocolo)}&telefone=${encodeURIComponent(telefone)}`,
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    remoteAddress: ip,
  });

const proibidos = [
  'TITULO-INTERNO-SECRETO',
  'DESCRICAO-INTERNA-SECRETA',
  'COMENTARIO-INTERNO-SECRETO',
  'ETAPA-INTERNA-SECRETA',
  'Responsável Interno Secreto',
  'urgente',
  'prioridade',
  'maria@exemplo.test',
  'Maria da Silva', // sobrenome: a política inicial mostra só o primeiro nome
];

describe('acompanhamento pelo link (critérios 1, 2, 5)', () => {
  it('mostra só o conjunto publicável, em vocabulário de cidadão, e nenhum campo interno em lugar nenhum do HTML', async () => {
    const d = await novaDemanda();
    const r = await app.inject({ method: 'GET', url: `/a/${d.segredo}` });
    expect(r.statusCode).toBe(200);
    expect(r.headers['content-type']).toContain('text/html');
    const html = r.body;

    expect(html).toContain(d.formatado);
    expect(html).toContain('Em andamento');
    expect(html).toContain('Maria'); // primeiro nome, pela política inicial
    expect(html).toContain('Recebida');
    expect(html).toContain('Equipe vistoriou o local.');
    for (const segredo of proibidos) expect(html, segredo).not.toContain(segredo);
    // O telefone (nem inteiro, nem pedaço) não aparece com a política inicial.
    expect(html).not.toContain(d.telefone);
    expect(html).not.toContain(d.telefone.slice(2, 7));
    // Vocabulário do cidadão.
    expect(html.toLowerCase()).not.toContain('demanda');
    expect(html).toContain('quem tiver o endereço');
    // Nada de script nem estilo embutido (a CSP não os permitiria).
    expect(html).not.toMatch(/<script|<style|style=/);
  });

  it('cabeçalhos: sem cookie, sem cache, sem indexação, sem Referer, CSP fechada', async () => {
    const d = await novaDemanda();
    const r = await app.inject({ method: 'GET', url: `/a/${d.segredo}` });
    expect(r.headers['set-cookie']).toBeUndefined();
    expect(r.headers['cache-control']).toBe('no-store');
    expect(r.headers['x-robots-tag']).toContain('noindex');
    expect(r.headers['referrer-policy']).toBe('no-referrer');
    expect(r.headers['content-security-policy']).toContain("default-src 'none'");
    expect(r.headers['x-frame-options']).toBe('DENY');
    expect(r.body).toContain('noindex');
  });

  it('link inexistente, malformado, revogado, suspenso e expirado: o MESMO 404 e o MESMO corpo (critério 3)', async () => {
    const base = await app.inject({
      method: 'GET',
      url: `/a/${randomBytes(32).toString('base64url')}`,
    });
    expect(base.statusCode).toBe(404);

    const revogada = await novaDemanda();
    await api`UPDATE demanda SET publicacao_link = 'revogada' WHERE id = ${revogada.id}`;
    const suspensa = await novaDemanda();
    await api`UPDATE demanda SET publicacao_link = 'suspensa' WHERE id = ${suspensa.id}`;

    const expirada = await novaDemanda();
    const [conclusao] = await api<{ id: number }[]>`
      SELECT e.id FROM etapa e JOIN tipo_processo t ON t.id = e.tipo_processo_id
      WHERE t.tipo = 'demanda' AND e.papel = 'conclusao' LIMIT 1`;
    await api`UPDATE demanda SET etapa_atual_id = ${conclusao!.id} WHERE id = ${expirada.id}`;
    await api`INSERT INTO movimentacao (registro_tipo, registro_id, tipo_processo_id, etapa_destino_id, autor_id, criada_em)
              SELECT 'demanda', ${expirada.id}, t.id, ${conclusao!.id}, ${usuarioId}, now() - interval '100 days' FROM tipo_processo t WHERE t.tipo = 'demanda'`;

    for (const url of [
      `/a/${revogada.segredo}`,
      `/a/${suspensa.segredo}`,
      `/a/${expirada.segredo}`,
      '/a/curto',
      `/a/${'x'.repeat(200)}`,
      '/qualquer/coisa',
    ]) {
      const r = await app.inject({ method: 'GET', url });
      expect(r.statusCode, url).toBe(404);
      expect(r.body, url).toBe(base.body);
    }
    // E uma política mais longa reabre o link expirado: a expiração é aplicada, não gravada.
    await dono`UPDATE politica_publicacao SET vigente_ate = now() WHERE vigente_ate IS NULL`;
    await dono`INSERT INTO politica_publicacao (expiracao_dias) VALUES (400)`;
    expect((await app.inject({ method: 'GET', url: `/a/${expirada.segredo}` })).statusCode).toBe(
      200,
    );
  });

  it('a política decide o que aparece: título, nome completo e telefone mascarado', async () => {
    const d = await novaDemanda();
    await dono`UPDATE politica_publicacao SET vigente_ate = now() WHERE vigente_ate IS NULL`;
    await dono`INSERT INTO politica_publicacao (exibir_titulo, exibicao_nome, exibicao_telefone) VALUES (true, 'completo', 'mascarado')`;
    const html = (await app.inject({ method: 'GET', url: `/a/${d.segredo}` })).body;
    expect(html).toContain('TITULO-INTERNO-SECRETO'); // agora é publicável, por política
    expect(html).toContain('Maria da Silva');
    expect(html).toMatch(/Telefone cadastrado: 67\*{5}\d{2}/);
    expect(html).not.toContain(d.telefone);
    // Mesmo assim, nada além do publicável.
    for (const segredo of [
      'DESCRICAO-INTERNA-SECRETA',
      'COMENTARIO-INTERNO-SECRETO',
      'ETAPA-INTERNA-SECRETA',
      'Responsável Interno Secreto',
      'urgente',
    ]) {
      expect(html, segredo).not.toContain(segredo);
    }
  });

  it('cada acesso válido vira ocorrência na trilha, sem dado do visitante (RN-PUB-12)', async () => {
    const d = await novaDemanda();
    await app.inject({ method: 'GET', url: `/a/${d.segredo}`, remoteAddress: '203.0.113.9' });
    await app.inject({ method: 'GET', url: `/a/${randomBytes(32).toString('base64url')}` }); // inválido: não conta
    const linhas = await api<
      { origem: string; autor_id: string | null; registro_id: string; valor_novo: unknown }[]
    >`
      SELECT origem, autor_id, registro_id, valor_novo FROM trilha WHERE operacao = 'publico.acompanhar'`;
    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toMatchObject({
      origem: 'publico',
      autor_id: null,
      valor_novo: { via: 'link' },
    });
    expect(JSON.stringify(linhas)).not.toContain('203.0.113.9');
    expect(JSON.stringify(linhas)).not.toContain(d.segredo);
  });
});

describe('consulta por protocolo (critério 6, RN-PUB-10)', () => {
  it('protocolo + telefone certos mostram a mesma página; aceita hífens, caixa e máscara do telefone', async () => {
    const d = await novaDemanda();
    for (const [p, t] of [
      [
        d.formatado,
        '(67) 99999-0001'.replace('99999-0001', d.telefone.slice(2, 7) + '-' + d.telefone.slice(7)),
      ],
      [d.protocolo.toLowerCase(), d.telefone],
      [` ${d.formatado} `, `+55 ${d.telefone.slice(0, 2)} ${d.telefone.slice(2)}`],
    ] as const) {
      const r = await consultar(p, t);
      expect(r.statusCode, `${p} / ${t}`).toBe(200);
      expect(r.body).toContain(d.formatado);
      // Por esta via NÃO há aviso de "quem tiver o endereço", pois não há endereço com segredo.
      expect(r.body).not.toContain('quem tiver o endereço');
    }
    expect((await consultar(d.formatado, d.telefone)).headers['set-cookie']).toBeUndefined();
  });

  it('qualquer falha dá o mesmo 404 e o mesmo corpo do link inválido; nada diz o que errou', async () => {
    const d = await novaDemanda();
    const base = (await app.inject({ method: 'GET', url: '/a/curto' })).body;
    for (const [p, t] of [
      [d.formatado, '67900000000'], // telefone errado
      ['K7M2-ZZZZ-ZZZZ', d.telefone], // protocolo inexistente
      ['K7M2-0000-0000', d.telefone], // formato inválido
      ['', ''],
      [d.formatado, 'abc'],
    ] as const) {
      const r = await consultar(p, t, `10.0.0.${Math.floor(Math.random() * 200) + 1}`);
      expect(r.statusCode, `${p} / ${t}`).toBe(404);
      expect(r.body).toBe(base);
    }
  });

  it('5 falhas bloqueiam a origem por 5 minutos (429), outra origem não é afetada, e depois libera', async () => {
    const d = await novaDemanda();
    for (let i = 0; i < 5; i += 1) {
      expect((await consultar(d.formatado, '67900000000')).statusCode).toBe(404);
    }
    // Bloqueada: até o par CERTO recebe 429.
    expect((await consultar(d.formatado, d.telefone)).statusCode).toBe(429);
    // Outra origem segue normal.
    expect((await consultar(d.formatado, d.telefone, '10.9.9.9')).statusCode).toBe(200);

    agora += 4 * 60_000;
    expect((await consultar(d.formatado, d.telefone)).statusCode).toBe(429);
    agora += 61_000;
    expect((await consultar(d.formatado, d.telefone)).statusCode).toBe(200);
  });

  it('link revogado deixa a consulta por protocolo de pé; suspenso fecha as duas vias', async () => {
    const d = await novaDemanda();
    await api`UPDATE demanda SET publicacao_link = 'revogada' WHERE id = ${d.id}`;
    expect((await consultar(d.formatado, d.telefone)).statusCode).toBe(200);
    await api`UPDATE demanda SET publicacao_link = 'suspensa' WHERE id = ${d.id}`;
    expect((await consultar(d.formatado, d.telefone, '10.1.1.1')).statusCode).toBe(404);
  });

  it('pessoa com dados eliminados não é consultável por telefone', async () => {
    const d = await novaDemanda();
    await api`UPDATE pessoa SET situacao = 'dados_eliminados', nome_completo = NULL, telefone_normalizado = NULL, email = NULL WHERE id = ${d.pessoaId}`;
    expect((await consultar(d.formatado, d.telefone)).statusCode).toBe(404);
  });
});

describe('somente leitura (critério 4)', () => {
  it('só há duas escritas nominais: a consulta por protocolo e o descadastro; o resto responde 404', async () => {
    const d = await novaDemanda();
    for (const metodo of ['PUT', 'PATCH', 'DELETE'] as const) {
      for (const url of ['/', `/a/${d.segredo}`, '/consultar', '/d/x']) {
        const r = await app.inject({ method: metodo, url });
        expect(r.statusCode, `${metodo} ${url}`).toBe(404);
      }
    }
    expect((await app.inject({ method: 'POST', url: `/a/${d.segredo}` })).statusCode).toBe(404);
    expect((await app.inject({ method: 'POST', url: '/' })).statusCode).toBe(404);
    const rotas = app.printRoutes({ commonPrefix: false });
    expect(rotas).not.toMatch(/\((PUT|PATCH|DELETE)\)/);
    expect(rotas).toContain('(POST)');
  });

  it('robots.txt proíbe tudo; /saude responde; a página inicial não indexa', async () => {
    expect((await app.inject({ method: 'GET', url: '/robots.txt' })).body).toContain('Disallow: /');
    expect((await app.inject({ method: 'GET', url: '/saude' })).body).toBe('ok');
    const inicio = await app.inject({ method: 'GET', url: '/' });
    expect(inicio.statusCode).toBe(200);
    expect(inicio.body).toContain('noindex');
    expect(inicio.body).toContain('action="/consultar"');
  });
});

describe('descadastro (critério 9)', () => {
  async function comEnvio() {
    const d = await novaDemanda();
    const token = randomBytes(32).toString('base64url');
    await api`INSERT INTO consentimento_notificacao (pessoa_id, consentido, registrado_por, origem, versao_texto)
              VALUES (${d.pessoaId}, true, ${usuarioId}, 'atendimento_telefonico', 1)`;
    await api`INSERT INTO envio_notificacao (pessoa_id, demanda_id, evento, descadastro_hash)
              VALUES (${d.pessoaId}, ${d.id}, 'andamento_publicado', ${sha(token)})`;
    return { d, token };
  }

  it('o GET só mostra o botão (e-mail abre prévias); o POST cancela na hora, e é idempotente', async () => {
    const { d, token } = await comEnvio();
    const pagina = await app.inject({ method: 'GET', url: `/d/${token}` });
    expect(pagina.statusCode).toBe(200);
    expect(pagina.body).toContain('Deixar de receber avisos');
    const [antes] = await api<{ consentido: boolean }[]>`
      SELECT consentido FROM consentimento_notificacao WHERE pessoa_id = ${d.pessoaId} ORDER BY id DESC LIMIT 1`;
    expect(antes!.consentido).toBe(true); // o GET não mudou nada

    const feito = await app.inject({ method: 'POST', url: `/d/${token}` });
    expect(feito.statusCode).toBe(200);
    expect(feito.body).toContain('Pronto');
    expect((await app.inject({ method: 'POST', url: `/d/${token}` })).statusCode).toBe(200);

    const [depois] = await api<{ consentido: boolean; origem: string }[]>`
      SELECT consentido, origem FROM consentimento_notificacao WHERE pessoa_id = ${d.pessoaId} ORDER BY id DESC LIMIT 1`;
    expect(depois).toEqual({ consentido: false, origem: 'descadastro_cidadao' });
    const [envio] = await api<{ estado: string }[]>`SELECT estado FROM envio_notificacao`;
    expect(envio!.estado).toBe('cancelado');
  });

  it('token inválido: o mesmo 404 de sempre', async () => {
    const base = (await app.inject({ method: 'GET', url: '/a/curto' })).body;
    const r = await app.inject({
      method: 'POST',
      url: `/d/${randomBytes(32).toString('base64url')}`,
    });
    expect(r.statusCode).toBe(404);
    expect(r.body).toBe(base);
    expect((await app.inject({ method: 'GET', url: '/d/curto' })).statusCode).toBe(404);
  });
});
