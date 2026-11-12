import { decidir, ehOperacaoConhecida } from '@gabinete/autorizacao';
import type { FastifyInstance } from 'fastify';
import { erros } from '../erros.js';
import { duracaoAbsolutaEmMs } from './sessoes.js';
import type { ServicoDeAcesso } from './servico.js';

export interface OpcoesDeAutenticacao {
  readonly producao: boolean;
  readonly hostnameDaAplicacao: string;
}

/**
 * Em produção o cookie usa o prefixo `__Host-`: o navegador só o aceita com `Secure`, sem
 * `Domain` e com `Path=/`, o que impede que subdomínios o substituam.
 */
export function nomeDoCookie(producao: boolean): string {
  return producao ? '__Host-sessao' : 'sessao';
}

export function opcoesDoCookie(producao: boolean) {
  return {
    httpOnly: true,
    sameSite: 'strict',
    secure: producao,
    path: '/',
    maxAge: duracaoAbsolutaEmMs / 1000,
  } as const;
}

const metodosSeguros = new Set(['GET', 'HEAD', 'OPTIONS']);
const origemLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

/**
 * Registra os ganchos de autenticação e autorização.
 * - Toda rota é construída com `config.publica` ou `config.operacao`: sem uma das duas, o
 *   servidor NÃO sobe (falha fechada, ADR 0003).
 * - Rota não pública exige sessão válida e o decisor autorizando a operação.
 * - Recusa e inexistência respondem igual (404).
 * - A sessão pendente de troca de senha só alcança rotas com `permiteComSenhaPendente`.
 */
export function registrarAutenticacao(
  app: FastifyInstance,
  servico: ServicoDeAcesso,
  opcoes: OpcoesDeAutenticacao,
): void {
  const cookie = nomeDoCookie(opcoes.producao);
  const origemDaAplicacao = `https://${opcoes.hostnameDaAplicacao}`;

  const origemPermitida = (origem: string): boolean =>
    origem === origemDaAplicacao || (!opcoes.producao && origemLocal.test(origem));

  app.addHook('onRoute', (rota) => {
    const config = rota.config as { publica?: boolean; operacao?: string } | undefined;
    if (config?.publica) return;
    if (!config?.operacao || !ehOperacaoConhecida(config.operacao)) {
      throw new Error(
        `A rota ${String(rota.method)} ${rota.url} não declara uma operação conhecida (config.operacao) nem é pública.`,
      );
    }
  });

  // Defesa contra CSRF além do SameSite=Strict: confere a origem de requisições que alteram dados.
  app.addHook('onRequest', async (request) => {
    if (metodosSeguros.has(request.method)) return;

    const origem = request.headers.origin;
    if (origem !== undefined) {
      if (!origemPermitida(origem)) throw erros.origemNaoPermitida();
      return;
    }
    const destino = request.headers['sec-fetch-site'];
    if (destino !== undefined && destino !== 'same-origin' && destino !== 'none') {
      throw erros.origemNaoPermitida();
    }
    // Sem Origin nem Sec-Fetch-Site não é um navegador: não há vítima de CSRF para essa chamada.
  });

  app.addHook('onRequest', async (request, reply) => {
    const config = request.routeOptions?.config;
    if (config?.publica) return;

    const ticket = request.cookies[cookie];
    if (!ticket) throw erros.naoAutenticado();

    const sessao = await servico.buscarSessao(ticket);
    if (!sessao) {
      void reply.clearCookie(cookie, { path: '/' });
      throw erros.naoAutenticado();
    }
    request.sessao = sessao;

    if (sessao.senhaTrocaObrigatoria && !config?.permiteComSenhaPendente) {
      throw erros.trocaDeSenhaObrigatoria();
    }

    if (config?.operacao) {
      const decisao = decidir(config.operacao, {
        perfil: sessao.perfil,
        habilitacoes: sessao.habilitacoes,
      });
      if (!decisao.permitido) throw erros.naoEncontrado();
    }
  });
}
