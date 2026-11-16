import type { FastifyInstance } from 'fastify';
import { atorDaSessao } from '../equipe/rotas.js';
import type { ServicoDoPainel } from './servico.js';

export function registrarRotasDoPainel(app: FastifyInstance, servico: ServicoDoPainel): void {
  app.get('/api/painel/atendimento', { config: { operacao: 'painel.atendimento' } }, (request) =>
    servico.atendimento(atorDaSessao(request.sessao)),
  );

  app.get('/api/painel/tarefas', { config: { operacao: 'painel.tarefas' } }, (request) =>
    servico.tarefas(atorDaSessao(request.sessao)),
  );
}
