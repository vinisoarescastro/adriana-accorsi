import { paginas, paginasAlcancaveis } from '@gabinete/autorizacao';
import { esquemaEntrar, esquemaTrocarSenha, type RespostaDaSessao } from '@gabinete/compartilhado';
import type { FastifyInstance } from 'fastify';
import type { z } from 'zod';
import { erros } from '../erros.js';
import { nomeDoCookie, opcoesDoCookie } from './autenticacao.js';
import type { ServicoDeAcesso } from './servico.js';
import type { DadosDaSessao } from './sessoes.js';

export interface OpcoesDasRotasDeAcesso {
  readonly producao: boolean;
  /** Máximo de tentativas de entrada por minuto e por IP. */
  readonly entradasPorMinuto: number;
}

export function lerCorpo<T extends z.ZodType>(esquema: T, corpo: unknown): z.output<T> {
  const resultado = esquema.safeParse(corpo);
  if (!resultado.success) throw erros.requisicaoInvalida();
  return resultado.data;
}

export function respostaDaSessao(sessao: DadosDaSessao): RespostaDaSessao {
  const autoridade = { perfil: sessao.perfil, habilitacoes: sessao.habilitacoes };
  return {
    usuario: {
      id: sessao.usuarioId,
      nome: sessao.nome,
      email: sessao.email,
      perfil: sessao.perfil,
      habilitacoes: sessao.habilitacoes,
    },
    senhaTrocaObrigatoria: sessao.senhaTrocaObrigatoria,
    expiraEm: sessao.expiraEm.toISOString(),
    // Antes da troca da senha inicial, nenhuma página está disponível.
    paginasAlcancaveis: sessao.senhaTrocaObrigatoria
      ? []
      : paginasAlcancaveis(autoridade).map((id) => ({ id, ...paginas[id] })),
  };
}

export function registrarRotasDeAcesso(
  app: FastifyInstance,
  servico: ServicoDeAcesso,
  opcoes: OpcoesDasRotasDeAcesso,
): void {
  const cookie = nomeDoCookie(opcoes.producao);

  app.post(
    '/api/acesso/entrar',
    {
      config: {
        publica: true,
        rateLimit: { max: opcoes.entradasPorMinuto, timeWindow: '1 minute' },
      },
    },
    async (request, reply) => {
      const corpo = lerCorpo(esquemaEntrar, request.body);
      const { ticket, sessao } = await servico.entrar({ ...corpo, origem: request.ip });
      void reply.setCookie(cookie, ticket, opcoesDoCookie(opcoes.producao));
      return respostaDaSessao(sessao);
    },
  );

  app.get(
    '/api/acesso/sessao',
    { config: { operacao: 'sessao.consultar', permiteComSenhaPendente: true } },
    async (request) => respostaDaSessao(request.sessao as DadosDaSessao),
  );

  app.post(
    '/api/acesso/sair',
    { config: { operacao: 'sessao.sair', permiteComSenhaPendente: true } },
    async (request, reply) => {
      await servico.sair(request.sessao as DadosDaSessao);
      void reply.clearCookie(cookie, { path: '/' });
      return reply.status(204).send();
    },
  );

  app.post(
    '/api/acesso/trocar-senha',
    { config: { operacao: 'sessao.trocar_senha', permiteComSenhaPendente: true } },
    async (request, reply) => {
      const corpo = lerCorpo(esquemaTrocarSenha, request.body);
      await servico.trocarSenha(request.sessao as DadosDaSessao, corpo);
      return reply.status(204).send();
    },
  );
}
