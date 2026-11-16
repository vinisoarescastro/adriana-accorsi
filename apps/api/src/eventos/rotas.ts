import {
  esquemaAtualizarEvento,
  esquemaCorrigirPresenca,
  esquemaFiltroDeEventos,
  esquemaNovoEvento,
  esquemaRegistrarPresenca,
  esquemaRemoverPresenca,
} from '@gabinete/compartilhado';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { lerCorpo } from '../acesso/rotas.js';
import { atorDaSessao } from '../equipe/rotas.js';
import type { ConsultasDeEventos } from './consultas.js';
import type { ServicoDeEventos } from './servico.js';

const esquemaId = z.object({ id: z.coerce.number().int().positive() });
const esquemaPresencaId = esquemaId.extend({ pessoaId: z.coerce.number().int().positive() });

export function registrarRotasDeEventos(
  app: FastifyInstance,
  consultas: ConsultasDeEventos,
  servico: ServicoDeEventos,
): void {
  const id = (parametros: unknown) => lerCorpo(esquemaId, parametros).id;

  app.get('/api/eventos', { config: { operacao: 'eventos.consultar' } }, (request) =>
    consultas.listar(lerCorpo(esquemaFiltroDeEventos, request.query)),
  );

  // Antes de /:id, para "proximo" não ser lido como um id.
  app.get('/api/eventos/proximo', { config: { operacao: 'eventos.consultar' } }, async () => ({
    evento: await consultas.maisProximo(),
  }));

  app.get('/api/eventos/:id', { config: { operacao: 'eventos.consultar' } }, (request) =>
    consultas.ficha(atorDaSessao(request.sessao), id(request.params)),
  );

  app.post(
    '/api/eventos',
    { config: { operacao: 'eventos.organizar' } },
    async (request, reply) => {
      const criado = await servico.criar(
        atorDaSessao(request.sessao),
        lerCorpo(esquemaNovoEvento, request.body),
      );
      return reply.status(201).send(criado);
    },
  );

  app.patch('/api/eventos/:id', { config: { operacao: 'eventos.organizar' } }, (request) =>
    servico.editar(
      atorDaSessao(request.sessao),
      id(request.params),
      lerCorpo(esquemaAtualizarEvento, request.body),
    ),
  );

  app.post('/api/eventos/:id/encerrar', { config: { operacao: 'eventos.encerrar' } }, (request) =>
    servico.encerrar(atorDaSessao(request.sessao), id(request.params)),
  );

  app.post(
    '/api/eventos/:id/presencas',
    { config: { operacao: 'presenca.registrar' } },
    async (request, reply) => {
      const registrada = await servico.registrarPresenca(
        atorDaSessao(request.sessao),
        id(request.params),
        lerCorpo(esquemaRegistrarPresenca, request.body),
      );
      return reply.status(201).send(registrada);
    },
  );

  app.patch(
    '/api/eventos/:id/presencas/:pessoaId',
    { config: { operacao: 'presenca.registrar' } },
    (request) => {
      const p = lerCorpo(esquemaPresencaId, request.params);
      return servico.corrigirPresenca(
        atorDaSessao(request.sessao),
        p.id,
        p.pessoaId,
        lerCorpo(esquemaCorrigirPresenca, request.body),
      );
    },
  );

  app.post(
    '/api/eventos/:id/presencas/:pessoaId/remover',
    { config: { operacao: 'presenca.remover' } },
    (request) => {
      const p = lerCorpo(esquemaPresencaId, request.params);
      return servico.removerPresenca(
        atorDaSessao(request.sessao),
        p.id,
        p.pessoaId,
        lerCorpo(esquemaRemoverPresenca, request.body).justificativa,
      );
    },
  );
}
