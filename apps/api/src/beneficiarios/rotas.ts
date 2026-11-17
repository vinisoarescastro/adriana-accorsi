import {
  esquemaAtualizarBeneficiario,
  esquemaNovoBeneficiario,
  esquemaSituacaoDoBeneficiario,
  naturezasDeBeneficiario,
  ufs,
} from '@gabinete/compartilhado';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { lerCorpo } from '../acesso/rotas.js';
import { atorDaSessao } from '../equipe/rotas.js';
import type { ServicoDeBeneficiarios } from './servico.js';

const esquemaId = z.object({ id: z.coerce.number().int().positive() });
const esquemaFiltro = z.object({
  busca: z.string().trim().min(1).max(100).optional(),
  situacao: z.enum(['ativo', 'inativo']).optional(),
  natureza: z.enum(naturezasDeBeneficiario).optional(),
  estado: z.enum(ufs).optional(),
  pagina: z.coerce.number().int().min(1).default(1),
  porPagina: z.coerce.number().int().min(1).max(100).default(25),
});

export function registrarRotasDeBeneficiarios(
  app: FastifyInstance,
  servico: ServicoDeBeneficiarios,
): void {
  const id = (parametros: unknown) => lerCorpo(esquemaId, parametros).id;

  app.get('/api/beneficiarios', { config: { operacao: 'beneficiarios.consultar' } }, (request) =>
    servico.listar(lerCorpo(esquemaFiltro, request.query)),
  );

  app.get(
    '/api/beneficiarios/:id',
    { config: { operacao: 'beneficiarios.consultar' } },
    (request) => servico.obter(id(request.params)),
  );

  app.post(
    '/api/beneficiarios',
    { config: { operacao: 'beneficiarios.manter' } },
    async (request, reply) => {
      const criado = await servico.criar(
        atorDaSessao(request.sessao),
        lerCorpo(esquemaNovoBeneficiario, request.body),
      );
      return reply.status(201).send(criado);
    },
  );

  app.patch('/api/beneficiarios/:id', { config: { operacao: 'beneficiarios.manter' } }, (request) =>
    servico.atualizar(
      atorDaSessao(request.sessao),
      id(request.params),
      lerCorpo(esquemaAtualizarBeneficiario, request.body),
    ),
  );

  app.put(
    '/api/beneficiarios/:id/situacao',
    { config: { operacao: 'beneficiarios.inativar' } },
    (request) =>
      servico.alterarSituacao(
        atorDaSessao(request.sessao),
        id(request.params),
        lerCorpo(esquemaSituacaoDoBeneficiario, request.body).situacao,
      ),
  );
}
