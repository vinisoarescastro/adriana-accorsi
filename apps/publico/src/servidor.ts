import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import {
  descadastrarPorToken,
  lerAcompanhamento,
  protocoloConfere,
  registrarAcessoPublico,
  type ClienteSql,
} from '@gabinete/banco/publico';
import { normalizarProtocolo, normalizarTelefone } from '@gabinete/compartilhado';
import formbody from '@fastify/formbody';
import Fastify, { type FastifyInstance, type FastifyReply } from 'fastify';
import { LimitadorDeConsultas } from './limitador.js';
import {
  estilo,
  paginaDeAcompanhamento,
  paginaDeDescadastro,
  paginaDeErro,
  paginaDescadastroConcluido,
  paginaInicial,
  paginaMuitasTentativas,
  paginaNaoEncontrada,
} from './paginas.js';

const requisitar = createRequire(import.meta.url);
const pesosDaFonte = ['400', '500', '600'] as const;
const fontes = new Map<string, Buffer>();

/** A fonte do design system, servida pela própria origem (a política de conteúdo só aceita `self`). */
function lerFonte(peso: string): Buffer | null {
  if (!pesosDaFonte.some((p) => p === peso)) return null;
  const guardada = fontes.get(peso);
  if (guardada) return guardada;
  try {
    const arquivo = readFileSync(
      requisitar.resolve(`@fontsource/poppins/files/poppins-latin-${peso}-normal.woff2`),
    );
    fontes.set(peso, arquivo);
    return arquivo;
  } catch {
    return null; // sem a fonte, vale a do sistema
  }
}

export interface DependenciasDoPublico {
  /** Conexão com o papel `app_publico`: só enxerga as visões públicas e as funções nominais. */
  readonly cliente: ClienteSql;
  readonly limitador?: LimitadorDeConsultas;
  /** Espera antes de responder uma falha (atraso crescente). Os testes trocam por uma função vazia. */
  readonly esperar?: (ms: number) => Promise<void>;
  readonly confiarNoProxy?: boolean;
  readonly logger?: boolean;
}

const html = 'text/html; charset=utf-8';
/** O segredo do link tem 256 bits em base64url (43 caracteres). Formato diferente nem chega ao banco. */
const formatoDoSegredo = /^[A-Za-z0-9_-]{43}$/;
const formatoDoToken = /^[A-Za-z0-9_-]{43}$/;

const hash = (valor: string) => createHash('sha256').update(valor).digest('hex');
const dormir = (ms: number) => new Promise<void>((resolver) => setTimeout(resolver, ms));

/**
 * Área pública do cidadão. Sem login, sem cookie, somente leitura, `noindex`. As duas únicas rotas
 * que escrevem são NOMINAIS (e escrevem por funções do banco, não por tabelas): a consulta por
 * protocolo (um POST de leitura, que registra o acesso na trilha) e o descadastro de e-mail.
 * Link inválido, revogado, expirado, suspenso ou inexistente respondem com o MESMO 404 e o MESMO corpo.
 */
export async function construirServidorPublico(
  dep: DependenciasDoPublico,
): Promise<FastifyInstance> {
  const app = Fastify({
    logger: dep.logger ?? false,
    trustProxy: dep.confiarNoProxy ?? false,
    // Nenhuma rota pública precisa de corpo grande.
    bodyLimit: 4 * 1024,
    // Um segredo de tamanho estranho cai na verificação de formato (o mesmo 404), não num 414.
    routerOptions: { maxParamLength: 2048 },
    // O log nunca deve carregar o segredo do link, que vai no endereço.
    disableRequestLogging: true,
  });
  const limitador = dep.limitador ?? new LimitadorDeConsultas();
  const esperar = dep.esperar ?? dormir;

  await app.register(formbody);

  app.addHook('onSend', async (_request, reply, carga) => {
    reply.header('Cache-Control', 'no-store');
    reply.header('X-Robots-Tag', 'noindex, nofollow, noarchive');
    // O segredo do link está no endereço: nada pode vazar por Referer.
    reply.header('Referrer-Policy', 'no-referrer');
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    reply.header(
      'Content-Security-Policy',
      "default-src 'none'; style-src 'self'; font-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
    );
    return carga;
  });

  const responder = (reply: FastifyReply, status: number, corpo: string) =>
    reply.status(status).type(html).send(corpo);
  const naoEncontrada = (reply: FastifyReply) => responder(reply, 404, paginaNaoEncontrada());

  app.get('/', (_request, reply) => responder(reply, 200, paginaInicial()));
  app.get('/saude', (_request, reply) => reply.type('text/plain').send('ok'));
  app.get('/robots.txt', (_request, reply) =>
    reply.type('text/plain').send('User-agent: *\nDisallow: /\n'),
  );
  app.get<{ Params: { peso: string } }>('/fonte/:peso', (request, reply) => {
    const arquivo = lerFonte(request.params.peso.replace('.woff2', ''));
    if (!arquivo) return naoEncontrada(reply);
    return reply
      .type('font/woff2')
      .header('Cache-Control', 'public, max-age=31536000, immutable')
      .send(arquivo);
  });
  app.get('/estilo.css', (_request, reply) =>
    reply
      .type('text/css; charset=utf-8')
      .header('Cache-Control', 'public, max-age=3600')
      .send(estilo),
  );

  // Acompanhamento pelo link.
  app.get<{ Params: { segredo: string } }>('/a/:segredo', async (request, reply) => {
    const { segredo } = request.params;
    if (!formatoDoSegredo.test(segredo)) return naoEncontrada(reply);
    const acompanhamento = await lerAcompanhamento(dep.cliente, { segredoHash: hash(segredo) });
    if (!acompanhamento) return naoEncontrada(reply);
    await registrarAcessoPublico(
      dep.cliente,
      acompanhamento.protocolo.replaceAll('-', ''),
      'link',
    ).catch((erro: unknown) => request.log.error({ erro }, 'falha ao registrar o acesso'));
    return responder(reply, 200, paginaDeAcompanhamento(acompanhamento, true));
  });

  // Consulta por protocolo + telefone do atendimento. POST, para não deixar dado na URL.
  app.post('/consultar', async (request, reply) => {
    const origem = request.ip;
    if (limitador.bloqueadoPorMs(origem) > 0)
      return responder(reply, 429, paginaMuitasTentativas());

    const corpo = (request.body ?? {}) as Record<string, unknown>;
    const protocolo =
      typeof corpo.protocolo === 'string' ? normalizarProtocolo(corpo.protocolo) : null;
    const telefone = typeof corpo.telefone === 'string' ? normalizarTelefone(corpo.telefone) : null;

    const falhar = async () => {
      await esperar(limitador.atrasoEmMs(origem));
      limitador.registrarFalha(origem);
      return naoEncontrada(reply);
    };
    if (!protocolo || !telefone) return falhar();
    if (!(await protocoloConfere(dep.cliente, protocolo, telefone))) return falhar();

    const acompanhamento = await lerAcompanhamento(dep.cliente, { protocolo });
    if (!acompanhamento) return falhar();
    await registrarAcessoPublico(dep.cliente, protocolo, 'protocolo').catch((erro: unknown) =>
      request.log.error({ erro }, 'falha ao registrar o acesso'),
    );
    return responder(reply, 200, paginaDeAcompanhamento(acompanhamento, false));
  });

  // Descadastro: a página só mostra o botão (um e-mail pode ser aberto por antivírus e prévias, que
  // fazem GET); quem desliga é o POST.
  app.get<{ Params: { token: string } }>('/d/:token', (request, reply) => {
    if (!formatoDoToken.test(request.params.token)) return naoEncontrada(reply);
    return responder(reply, 200, paginaDeDescadastro(request.params.token));
  });
  app.post<{ Params: { token: string } }>('/d/:token', async (request, reply) => {
    const origem = request.ip;
    if (limitador.bloqueadoPorMs(origem) > 0)
      return responder(reply, 429, paginaMuitasTentativas());
    const { token } = request.params;
    if (!formatoDoToken.test(token) || !(await descadastrarPorToken(dep.cliente, hash(token)))) {
      await esperar(limitador.atrasoEmMs(origem));
      limitador.registrarFalha(origem);
      return naoEncontrada(reply);
    }
    return responder(reply, 200, paginaDescadastroConcluido());
  });

  app.setNotFoundHandler((_request, reply) => naoEncontrada(reply));
  app.setErrorHandler((erro, request, reply) => {
    if (erro instanceof Error && 'statusCode' in erro && erro.statusCode === 413) {
      return naoEncontrada(reply);
    }
    request.log.error({ err: erro }, 'erro não tratado');
    return responder(reply, 500, paginaDeErro());
  });

  return app;
}
