import type { FastifyInstance } from 'fastify';
import { atorDaSessao } from '../equipe/rotas.js';
import type { ServicoDoPainelDeAcompanhamento } from './acompanhamento.js';
import type { ServicoDoPainel } from './servico.js';

export function registrarRotasDoPainel(
  app: FastifyInstance,
  servico: ServicoDoPainel,
  acompanhamento: ServicoDoPainelDeAcompanhamento,
): void {
  app.get('/api/painel/atendimento', { config: { operacao: 'painel.atendimento' } }, (request) =>
    servico.atendimento(atorDaSessao(request.sessao)),
  );

  app.get('/api/painel/tarefas', { config: { operacao: 'painel.tarefas' } }, (request) =>
    servico.tarefas(atorDaSessao(request.sessao)),
  );

  app.get(
    '/api/painel/atendimento/tendencia',
    { config: { operacao: 'painel.atendimento' } },
    (request) => acompanhamento.tendencia(atorDaSessao(request.sessao)),
  );

  app.get('/api/painel/pendencias', { config: { operacao: 'painel.tarefas' } }, (request) =>
    acompanhamento.pendencias(atorDaSessao(request.sessao)),
  );

  app.get('/api/painel/atividade', { config: { operacao: 'painel.abrir' } }, (request) =>
    acompanhamento.atividade(atorDaSessao(request.sessao)),
  );

  app.get('/api/painel/equipe', { config: { operacao: 'painel.equipe' } }, () =>
    acompanhamento.equipe(),
  );
}
