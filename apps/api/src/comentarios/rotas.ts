import { esquemaNovoComentario } from '@gabinete/compartilhado';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { lerCorpo } from '../acesso/rotas.js';
import { atorDaSessao } from '../equipe/rotas.js';
import type { ServicoDeComentarios } from './servico.js';

const esquemaId = z.object({ id: z.coerce.number().int().positive() });

export function registrarRotasDeComentarios(
  app: FastifyInstance,
  servico: ServicoDeComentarios,
): void {
  app.post(
    '/api/demandas/:id/comentarios',
    { config: { operacao: 'comentarios.criar' } },
    async (request, reply) => {
      const comentarios = await servico.criar(
        atorDaSessao(request.sessao),
        lerCorpo(esquemaId, request.params).id,
        lerCorpo(esquemaNovoComentario, request.body),
      );
      return reply.status(201).send(comentarios);
    },
  );

  // "Remover" marca o comentário; nada é apagado. Não há nenhuma rota que torne um comentário público.
  app.delete('/api/comentarios/:id', { config: { operacao: 'comentarios.remover' } }, (request) =>
    servico.remover(atorDaSessao(request.sessao), lerCorpo(esquemaId, request.params).id),
  );
}
