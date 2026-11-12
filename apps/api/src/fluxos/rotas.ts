import {
  esquemaAjustarEtapa,
  esquemaNovaEtapa,
  esquemaSituacaoDaEtapa,
} from '@gabinete/compartilhado';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { lerCorpo } from '../acesso/rotas.js';
import { atorDaSessao } from '../equipe/rotas.js';
import type { ServicoDeFluxos } from './servico.js';

const esquemaId = z.object({ id: z.coerce.number().int().positive() });
const esquemaTipo = z.object({ tipo: z.string().min(1).max(40) });

export function registrarRotasDeFluxos(app: FastifyInstance, servico: ServicoDeFluxos): void {
  app.get('/api/fluxos', { config: { operacao: 'fluxos.consultar' } }, () => servico.listar());

  app.patch('/api/fluxos/etapas/:id', { config: { operacao: 'fluxos.ajustar' } }, (request) =>
    servico.ajustar(
      atorDaSessao(request.sessao),
      lerCorpo(esquemaId, request.params).id,
      lerCorpo(esquemaAjustarEtapa, request.body),
    ),
  );

  app.post(
    '/api/fluxos/:tipo/etapas',
    { config: { operacao: 'fluxos.estruturar' } },
    async (request, reply) => {
      const etapa = await servico.criar(
        atorDaSessao(request.sessao),
        lerCorpo(esquemaTipo, request.params).tipo,
        lerCorpo(esquemaNovaEtapa, request.body),
      );
      return reply.status(201).send(etapa);
    },
  );

  app.put(
    '/api/fluxos/etapas/:id/situacao',
    { config: { operacao: 'fluxos.estruturar' } },
    (request) =>
      servico.alterarSituacao(
        atorDaSessao(request.sessao),
        lerCorpo(esquemaId, request.params).id,
        lerCorpo(esquemaSituacaoDaEtapa, request.body).situacao,
      ),
  );
}
