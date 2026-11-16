import {
  esquemaAtualizarCompromisso,
  esquemaConsultaDaAgenda,
  esquemaNovoBloqueio,
  esquemaNovoCompromisso,
  esquemaResponderCompromisso,
  periodoMaximoDaAgendaEmDias,
} from '@gabinete/compartilhado';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { lerCorpo } from '../acesso/rotas.js';
import { atorDaSessao } from '../equipe/rotas.js';
import { erros } from '../erros.js';
import type { ConsultasDeAgenda } from './consultas.js';
import type { ServicoDeAgenda } from './servico.js';

const esquemaId = z.object({ id: z.coerce.number().int().positive() });
const esquemaProximos = z.object({ limite: z.coerce.number().int().min(1).max(50).default(10) });
const umDia = 24 * 60 * 60 * 1000;

export function registrarRotasDeAgenda(
  app: FastifyInstance,
  consultas: ConsultasDeAgenda,
  servico: ServicoDeAgenda,
): void {
  const id = (parametros: unknown) => lerCorpo(esquemaId, parametros).id;

  // A consulta exige o período (RN-AGE-07) e o limita, para não varrer a agenda inteira.
  app.get('/api/agenda', { config: { operacao: 'agenda.consultar' } }, (request) => {
    const q = lerCorpo(esquemaConsultaDaAgenda, request.query);
    const de = new Date(q.de);
    const ate = new Date(q.ate);
    if (ate < de || (ate.getTime() - de.getTime()) / umDia > periodoMaximoDaAgendaEmDias) {
      throw erros.requisicaoInvalida();
    }
    return consultas.consultar(atorDaSessao(request.sessao), { de, ate, minha: q.minha });
  });

  app.get('/api/agenda/proximos', { config: { operacao: 'agenda.consultar' } }, (request) =>
    consultas.proximos(
      atorDaSessao(request.sessao),
      lerCorpo(esquemaProximos, request.query).limite,
    ),
  );

  app.get('/api/agenda/compromissos/:id', { config: { operacao: 'agenda.consultar' } }, (request) =>
    consultas.obter(atorDaSessao(request.sessao), id(request.params)),
  );

  app.post(
    '/api/agenda/compromissos',
    { config: { operacao: 'agenda.marcar' } },
    async (request, reply) => {
      const salvo = await servico.criar(
        atorDaSessao(request.sessao),
        lerCorpo(esquemaNovoCompromisso, request.body),
      );
      return reply.status(201).send(salvo);
    },
  );

  app.patch('/api/agenda/compromissos/:id', { config: { operacao: 'agenda.marcar' } }, (request) =>
    servico.editar(
      atorDaSessao(request.sessao),
      id(request.params),
      lerCorpo(esquemaAtualizarCompromisso, request.body),
    ),
  );

  app.post(
    '/api/agenda/compromissos/:id/cancelar',
    { config: { operacao: 'agenda.marcar' } },
    (request) => servico.cancelar(atorDaSessao(request.sessao), id(request.params)),
  );

  app.post(
    '/api/agenda/compromissos/:id/resposta',
    { config: { operacao: 'agenda.responder' } },
    (request) =>
      servico.responder(
        atorDaSessao(request.sessao),
        id(request.params),
        lerCorpo(esquemaResponderCompromisso, request.body).resposta,
      ),
  );

  app.post(
    '/api/agenda/bloqueios',
    { config: { operacao: 'agenda.marcar' } },
    async (request, reply) => {
      const criado = await servico.criarBloqueio(
        atorDaSessao(request.sessao),
        lerCorpo(esquemaNovoBloqueio, request.body),
      );
      return reply.status(201).send(criado);
    },
  );

  app.post(
    '/api/agenda/bloqueios/:id/cancelar',
    { config: { operacao: 'agenda.marcar' } },
    async (request, reply) => {
      await servico.cancelarBloqueio(atorDaSessao(request.sessao), id(request.params));
      return reply.status(204).send();
    },
  );
}
