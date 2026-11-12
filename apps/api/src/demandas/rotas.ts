import {
  esquemaAtualizarDemanda,
  esquemaCancelarDemanda,
  esquemaMoverDemanda,
  esquemaNovaDemanda,
  esquemaReatribuirDemanda,
  prioridades,
  statusDeDemanda,
} from '@gabinete/compartilhado';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { lerCorpo } from '../acesso/rotas.js';
import { atorDaSessao } from '../equipe/rotas.js';
import type { ConsultasDeDemandas } from './consultas.js';
import type { ServicoDeDemandas } from './servico.js';

const esquemaId = z.object({ id: z.coerce.number().int().positive() });
const idOpcional = z.coerce.number().int().positive().optional();

const esquemaFiltro = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
  porPagina: z.coerce.number().int().min(1).max(100).default(25),
  busca: z.string().trim().min(1).max(100).optional(),
  status: z.enum(statusDeDemanda).optional(),
  etapaId: idOpcional,
  responsavelId: idOpcional,
  solicitanteId: idOpcional,
  prioridade: z.enum(prioridades).optional(),
  atrasadas: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});

export function registrarRotasDeDemandas(
  app: FastifyInstance,
  consultas: ConsultasDeDemandas,
  servico: ServicoDeDemandas,
): void {
  const id = (parametros: unknown) => lerCorpo(esquemaId, parametros).id;

  app.get('/api/demandas', { config: { operacao: 'demandas.consultar' } }, (request) =>
    consultas.listar(atorDaSessao(request.sessao), lerCorpo(esquemaFiltro, request.query)),
  );

  // Registrada antes de /:id para que "quadro" não seja lido como um id.
  app.get('/api/demandas/quadro', { config: { operacao: 'demandas.consultar' } }, (request) =>
    consultas.quadro(atorDaSessao(request.sessao)),
  );

  app.get('/api/demandas/:id', { config: { operacao: 'demandas.consultar' } }, (request) =>
    consultas.ficha(atorDaSessao(request.sessao), id(request.params)),
  );

  app.post(
    '/api/demandas',
    { config: { operacao: 'demandas.registrar' } },
    async (request, reply) => {
      const registrada = await servico.registrar(
        atorDaSessao(request.sessao),
        lerCorpo(esquemaNovaDemanda, request.body),
      );
      return reply.status(201).send(registrada);
    },
  );

  app.patch('/api/demandas/:id', { config: { operacao: 'demandas.alterar' } }, (request) =>
    servico.editar(
      atorDaSessao(request.sessao),
      id(request.params),
      lerCorpo(esquemaAtualizarDemanda, request.body),
    ),
  );

  app.post('/api/demandas/:id/mover', { config: { operacao: 'demandas.alterar' } }, (request) => {
    const corpo = lerCorpo(esquemaMoverDemanda, request.body);
    return servico.mover(
      atorDaSessao(request.sessao),
      id(request.params),
      corpo.etapaId,
      corpo.observacao,
    );
  });

  app.post(
    '/api/demandas/:id/reatribuir',
    { config: { operacao: 'demandas.reatribuir' } },
    (request) =>
      servico.reatribuir(
        atorDaSessao(request.sessao),
        id(request.params),
        lerCorpo(esquemaReatribuirDemanda, request.body).responsavelId,
      ),
  );

  app.post('/api/demandas/:id/cancelar', { config: { operacao: 'demandas.cancelar' } }, (request) =>
    servico.cancelar(
      atorDaSessao(request.sessao),
      id(request.params),
      lerCorpo(esquemaCancelarDemanda, request.body).justificativa,
    ),
  );
}
