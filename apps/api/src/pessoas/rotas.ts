import {
  esquemaAtualizarPessoa,
  esquemaEliminarDados,
  esquemaNovaPessoa,
  esquemaSituacaoDePessoa,
} from '@gabinete/compartilhado';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { lerCorpo } from '../acesso/rotas.js';
import { atorDaSessao } from '../equipe/rotas.js';
import type { ServicoDePessoas } from './servico.js';

const esquemaId = z.object({ id: z.coerce.number().int().positive() });
const esquemaBusca = z.object({
  busca: z.string().trim().min(1).max(100).optional(),
  situacao: z.enum(['ativa', 'inativa', 'dados_eliminados']).optional(),
  pagina: z.coerce.number().int().min(1).default(1),
  porPagina: z.coerce.number().int().min(1).max(100).default(25),
});
const esquemaTelefone = z.object({ telefone: z.string().trim().min(1).max(40) });

export function registrarRotasDePessoas(app: FastifyInstance, servico: ServicoDePessoas): void {
  const id = (parametros: unknown) => lerCorpo(esquemaId, parametros).id;

  app.get('/api/pessoas', { config: { operacao: 'pessoas.consultar' } }, (request) =>
    servico.listar(lerCorpo(esquemaBusca, request.query)),
  );

  // Registrada antes de /:id para que "por-telefone" não seja lido como um id.
  app.get(
    '/api/pessoas/por-telefone',
    { config: { operacao: 'pessoas.consultar' } },
    async (request) => {
      const { telefone } = lerCorpo(esquemaTelefone, request.query);
      return { pessoa: await servico.buscarPorTelefone(telefone) };
    },
  );

  app.get('/api/pessoas/:id', { config: { operacao: 'pessoas.consultar' } }, (request) =>
    servico.obter(id(request.params)),
  );

  app.post('/api/pessoas', { config: { operacao: 'pessoas.manter' } }, async (request, reply) => {
    const criada = await servico.criar(
      atorDaSessao(request.sessao),
      lerCorpo(esquemaNovaPessoa, request.body),
    );
    return reply.status(201).send(criada);
  });

  app.patch('/api/pessoas/:id', { config: { operacao: 'pessoas.manter' } }, (request) =>
    servico.atualizar(
      atorDaSessao(request.sessao),
      id(request.params),
      lerCorpo(esquemaAtualizarPessoa, request.body),
    ),
  );

  app.put('/api/pessoas/:id/situacao', { config: { operacao: 'pessoas.inativar' } }, (request) =>
    servico.alterarSituacao(
      atorDaSessao(request.sessao),
      id(request.params),
      lerCorpo(esquemaSituacaoDePessoa, request.body).situacao,
    ),
  );

  app.post(
    '/api/pessoas/:id/eliminar-dados',
    { config: { operacao: 'pessoas.eliminar_dados' } },
    (request) => {
      lerCorpo(esquemaEliminarDados, request.body);
      return servico.eliminarDados(atorDaSessao(request.sessao), id(request.params));
    },
  );
}
