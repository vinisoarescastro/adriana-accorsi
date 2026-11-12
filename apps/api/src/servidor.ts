import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import type { Conexao } from '@gabinete/banco';
import Fastify, { type FastifyInstance } from 'fastify';
import { registrarAutenticacao } from './acesso/autenticacao.js';
import { registrarRotasDeAcesso } from './acesso/rotas.js';
import { ServicoDeAcesso } from './acesso/servico.js';
import type { Armazenamento } from './armazenamento/armazenamento.js';
import { tamanhoMaximoDaFoto } from './armazenamento/foto.js';
import { registrarRotasDeAuditoria } from './auditoria/rotas.js';
import { ServicoDeAuditoria } from './auditoria/servico.js';
import { registrarRotasDeFluxos } from './fluxos/rotas.js';
import { ServicoDeFluxos } from './fluxos/servico.js';
import { registrarRotasDeEquipe } from './equipe/rotas.js';
import { ServicoDeEquipe } from './equipe/servico.js';
import { ErroDeNegocio, erros } from './erros.js';
import { registrarRotasDoGabinete } from './gabinete/rotas.js';
import { ServicoDoGabinete } from './gabinete/servico.js';
import './tipos.js';

export interface DependenciasDoServidor {
  readonly ambiente: {
    readonly NODE_ENV: 'development' | 'test' | 'production';
    readonly HOSTNAME_APP: string;
    readonly SESSAO_SEGREDO: string;
  };
  readonly conexao: Conexao;
  readonly armazenamento: Armazenamento;
  /** Relógio injetável, para testar expiração de sessão e bloqueio de conta. */
  readonly agora?: () => Date;
  /** Espera injetável, para testar o atraso por tentativa errada sem esperar de verdade. */
  readonly dormir?: (ms: number) => Promise<void>;
  readonly limites?: { entradasPorMinuto?: number; geralPorMinuto?: number };
  readonly registrarRotas?: (app: FastifyInstance) => void | Promise<void>;
  readonly logger?: boolean;
}

const dormirDeVerdade = (ms: number) => new Promise<void>((resolver) => setTimeout(resolver, ms));

export async function construirServidor(dep: DependenciasDoServidor): Promise<FastifyInstance> {
  const producao = dep.ambiente.NODE_ENV === 'production';

  const app = Fastify({
    // Atrás do Caddy, o IP real vem do cabeçalho encaminhado. Só confiamos nele em produção.
    trustProxy: producao,
    logger: dep.logger
      ? {
          level: 'info',
          redact: ['req.headers.cookie', 'req.headers.authorization', 'res.headers["set-cookie"]'],
        }
      : false,
    bodyLimit: 1_048_576,
  });

  await app.register(cookie);
  await app.register(rateLimit, {
    global: true,
    max: dep.limites?.geralPorMinuto ?? 600,
    timeWindow: '1 minute',
    errorResponseBuilder: () => erros.muitasRequisicoes(),
  });

  const agora = dep.agora ?? (() => new Date());
  const servico = new ServicoDeAcesso({
    bd: dep.conexao.bd,
    segredo: dep.ambiente.SESSAO_SEGREDO,
    agora,
    dormir: dep.dormir ?? dormirDeVerdade,
  });

  registrarAutenticacao(app, servico, {
    producao,
    hostnameDaAplicacao: dep.ambiente.HOSTNAME_APP,
  });

  // Nenhuma resposta da API deve ser guardada em cache (há dados pessoais e de sessão).
  app.addHook('onSend', async (_request, reply) => {
    void reply.header('Cache-Control', 'no-store');
  });

  app.setErrorHandler((erro, request, reply) => {
    if (erro instanceof ErroDeNegocio) {
      return reply.status(erro.status).send(erro.paraResposta());
    }
    if (erro instanceof Error && 'statusCode' in erro && erro.statusCode === 429) {
      return reply.status(429).send(erros.muitasRequisicoes().paraResposta());
    }
    if (erro instanceof Error && 'statusCode' in erro && erro.statusCode === 413) {
      return reply.status(413).send(erros.requisicaoInvalida().paraResposta());
    }
    request.log.error({ err: erro }, 'erro não tratado');
    return reply.status(500).send({ codigo: 'erro_interno', mensagem: 'Erro interno.' });
  });

  app.setNotFoundHandler((_request, reply) =>
    reply.status(404).send(erros.naoEncontrado().paraResposta()),
  );

  app.get('/api/saude', { config: { publica: true } }, async () => ({ ok: true }));

  // Fotos chegam como PNG ou JPEG no corpo; o tipo real é decidido pelo conteúdo (ver foto.ts).
  app.addContentTypeParser(
    ['image/png', 'image/jpeg'],
    { parseAs: 'buffer', bodyLimit: tamanhoMaximoDaFoto + 1024 },
    (_request, corpo, pronto) => pronto(null, corpo),
  );

  registrarRotasDeAcesso(app, servico, {
    producao,
    entradasPorMinuto: dep.limites?.entradasPorMinuto ?? 10,
  });
  registrarRotasDeEquipe(app, new ServicoDeEquipe(dep.conexao.bd, agora), dep.armazenamento);
  registrarRotasDoGabinete(app, new ServicoDoGabinete(dep.conexao.bd), dep.armazenamento);
  registrarRotasDeAuditoria(app, new ServicoDeAuditoria(dep.conexao.bd));
  registrarRotasDeFluxos(app, new ServicoDeFluxos(dep.conexao.bd));

  await dep.registrarRotas?.(app);
  return app;
}
