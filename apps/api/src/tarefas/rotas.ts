import {
  esquemaAtualizarTarefa,
  esquemaCancelarTarefa,
  esquemaMoverTarefa,
  esquemaNovaTarefa,
  esquemaReatribuirTarefa,
  prioridades,
  statusDeTarefa,
  tiposDeVinculoDeTarefa,
} from '@gabinete/compartilhado';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { lerCorpo } from '../acesso/rotas.js';
import { atorDaSessao } from '../equipe/rotas.js';
import type { ConsultasDeTarefas } from './consultas.js';
import type { ServicoDeTarefas } from './servico.js';

const esquemaId = z.object({ id: z.coerce.number().int().positive() });
const idOpcional = z.coerce.number().int().positive().optional();
const booleano = z
  .enum(['true', 'false'])
  .transform((v) => v === 'true')
  .optional();

const esquemaFiltro = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
  porPagina: z.coerce.number().int().min(1).max(100).default(25),
  busca: z.string().trim().min(1).max(100).optional(),
  status: z.enum(statusDeTarefa).optional(),
  etapaId: idOpcional,
  responsavelId: idOpcional,
  prioridade: z.enum(prioridades).optional(),
  atrasadas: booleano,
  minhas: booleano,
  vinculoTipo: z.enum(tiposDeVinculoDeTarefa).optional(),
  vinculoId: idOpcional,
});

export function registrarRotasDeTarefas(
  app: FastifyInstance,
  consultas: ConsultasDeTarefas,
  servico: ServicoDeTarefas,
): void {
  const id = (parametros: unknown) => lerCorpo(esquemaId, parametros).id;

  app.get('/api/tarefas', { config: { operacao: 'tarefas.consultar' } }, (request) =>
    consultas.listar(atorDaSessao(request.sessao), lerCorpo(esquemaFiltro, request.query)),
  );

  // Registrada antes de /:id para que "etapas" não seja lido como um id.
  app.get('/api/tarefas/etapas', { config: { operacao: 'tarefas.consultar' } }, () =>
    consultas.etapas(),
  );

  app.get('/api/tarefas/:id', { config: { operacao: 'tarefas.consultar' } }, (request) =>
    consultas.ficha(atorDaSessao(request.sessao), id(request.params)),
  );

  app.post('/api/tarefas', { config: { operacao: 'tarefas.criar' } }, async (request, reply) => {
    const criada = await servico.criar(
      atorDaSessao(request.sessao),
      lerCorpo(esquemaNovaTarefa, request.body),
    );
    return reply.status(201).send(criada);
  });

  app.patch('/api/tarefas/:id', { config: { operacao: 'tarefas.alterar' } }, (request) =>
    servico.editar(
      atorDaSessao(request.sessao),
      id(request.params),
      lerCorpo(esquemaAtualizarTarefa, request.body),
    ),
  );

  app.post('/api/tarefas/:id/mover', { config: { operacao: 'tarefas.alterar' } }, (request) => {
    const corpo = lerCorpo(esquemaMoverTarefa, request.body);
    return servico.mover(
      atorDaSessao(request.sessao),
      id(request.params),
      corpo.etapaId,
      corpo.observacao,
    );
  });

  app.post(
    '/api/tarefas/:id/reatribuir',
    { config: { operacao: 'tarefas.reatribuir' } },
    (request) =>
      servico.reatribuir(
        atorDaSessao(request.sessao),
        id(request.params),
        lerCorpo(esquemaReatribuirTarefa, request.body).responsavelId,
      ),
  );

  app.post('/api/tarefas/:id/cancelar', { config: { operacao: 'tarefas.alterar' } }, (request) =>
    servico.cancelar(
      atorDaSessao(request.sessao),
      id(request.params),
      lerCorpo(esquemaCancelarTarefa, request.body).justificativa,
    ),
  );
}
