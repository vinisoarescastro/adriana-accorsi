import {
  esquemaAtualizarEmenda,
  esquemaCancelarDestinacao,
  esquemaCancelarEmenda,
  esquemaMoverDestinacao,
  esquemaMoverEmenda,
  esquemaNovaDestinacao,
  esquemaNovaEmenda,
  esquemaNovaExecucao,
  esquemaReatribuirEmenda,
  statusDeEmenda,
} from '@gabinete/compartilhado';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { lerCorpo } from '../acesso/rotas.js';
import { atorDaSessao } from '../equipe/rotas.js';
import { erros } from '../erros.js';
import type { ConsultasDeEmendas } from './consultas.js';
import type { ServicoDeDestinacoes } from './destinacoes.js';
import type { ServicoDeEmendas } from './servico.js';

const inteiro = z.coerce.number().int().positive();
const idOpcional = inteiro.optional();
const booleano = z
  .enum(['true', 'false'])
  .transform((v) => v === 'true')
  .optional();
const esquemaId = z.object({ id: inteiro });
const esquemaIdFilho = z.object({ id: inteiro, filhoId: inteiro });
const esquemaFiltro = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
  porPagina: z.coerce.number().int().min(1).max(100).default(25),
  busca: z.string().trim().min(1).max(100).optional(),
  status: z.enum(statusDeEmenda).optional(),
  etapaId: idOpcional,
  exercicio: z.coerce.number().int().min(2000).max(2100).optional(),
  tipoId: idOpcional,
  responsavelId: idOpcional,
  atrasadas: booleano,
  minhas: booleano,
});

export function registrarRotasDeEmendas(
  app: FastifyInstance,
  consultas: ConsultasDeEmendas,
  servico: ServicoDeEmendas,
  destinacoes: ServicoDeDestinacoes,
): void {
  const id = (p: unknown) => lerCorpo(esquemaId, p).id;
  const filho = (p: unknown) => lerCorpo(esquemaIdFilho, p);
  const ator = (request: FastifyRequest) => atorDaSessao(request.sessao);
  const consultar = { config: { operacao: 'emendas.consultar' as const } };
  const registrar = { config: { operacao: 'emendas.registrar' as const } };
  const supervisionar = { config: { operacao: 'emendas.supervisionar' as const } };

  // As rotas fixas antes de /:id.
  app.get('/api/emendas', consultar, (request) =>
    consultas.listar(ator(request), lerCorpo(esquemaFiltro, request.query)),
  );
  app.get('/api/emendas/etapas', consultar, () => consultas.etapas());
  app.get('/api/emendas/tipos', consultar, () => consultas.tipos());
  app.get('/api/emendas/consolidado', consultar, (request) => consultas.consolidado(ator(request)));
  app.get(
    '/api/emendas/reconstituicao',
    { config: { operacao: 'emendas.reconstituir' } },
    (request) => {
      const { em } = lerCorpo(
        z.object({ em: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
        request.query,
      );
      if (Number.isNaN(new Date(`${em}T12:00:00-03:00`).getTime()))
        throw erros.requisicaoInvalida();
      return consultas.reconstituir(em);
    },
  );
  app.get('/api/emendas/:id', consultar, (request) => consultas.ficha(id(request.params)));

  app.post('/api/emendas', registrar, async (request, reply) =>
    reply
      .status(201)
      .send(await servico.criar(ator(request), lerCorpo(esquemaNovaEmenda, request.body))),
  );
  app.patch('/api/emendas/:id', registrar, (request) =>
    servico.editar(
      ator(request),
      id(request.params),
      lerCorpo(esquemaAtualizarEmenda, request.body),
    ),
  );
  app.post('/api/emendas/:id/mover', registrar, (request) => {
    const c = lerCorpo(esquemaMoverEmenda, request.body);
    return servico.mover(ator(request), id(request.params), c.etapaId, c.observacao);
  });
  app.post('/api/emendas/:id/reatribuir', supervisionar, (request) =>
    servico.reatribuir(
      ator(request),
      id(request.params),
      lerCorpo(esquemaReatribuirEmenda, request.body).responsavelId,
    ),
  );
  app.post('/api/emendas/:id/cancelar', supervisionar, (request) =>
    servico.cancelar(
      ator(request),
      id(request.params),
      lerCorpo(esquemaCancelarEmenda, request.body).justificativa,
    ),
  );

  app.post('/api/emendas/:id/destinacoes', registrar, async (request, reply) =>
    reply
      .status(201)
      .send(
        await destinacoes.destinar(
          ator(request),
          id(request.params),
          lerCorpo(esquemaNovaDestinacao, request.body),
        ),
      ),
  );
  app.post('/api/emendas/:id/destinacoes/:filhoId/mover', registrar, (request) => {
    const p = filho(request.params);
    const c = lerCorpo(esquemaMoverDestinacao, request.body);
    return destinacoes.mover(ator(request), p.id, p.filhoId, c.etapaId, c.observacao);
  });
  app.post('/api/emendas/:id/destinacoes/:filhoId/cancelar', supervisionar, (request) => {
    const p = filho(request.params);
    return destinacoes.cancelar(
      ator(request),
      p.id,
      p.filhoId,
      lerCorpo(esquemaCancelarDestinacao, request.body).justificativa,
    );
  });
  app.post('/api/emendas/:id/destinacoes/:filhoId/execucoes', registrar, async (request, reply) => {
    const p = filho(request.params);
    return reply
      .status(201)
      .send(
        await destinacoes.executar(
          ator(request),
          p.id,
          p.filhoId,
          lerCorpo(esquemaNovaExecucao, request.body),
        ),
      );
  });
}
