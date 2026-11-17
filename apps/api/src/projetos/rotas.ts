import {
  esquemaAssuntosDoProjeto,
  esquemaAtualizarProjeto,
  esquemaAtualizarTramitacao,
  esquemaAtualizarVotacao,
  esquemaCancelarProjeto,
  esquemaCoautoresDoProjeto,
  esquemaMoverProjeto,
  esquemaNovaCategoria,
  esquemaNovaTramitacao,
  esquemaNovaVotacao,
  esquemaNovoProjeto,
  esquemaReatribuirProjeto,
  esquemaSituacaoDaCategoria,
  naturezasDeCategoriaDoLegislativo,
  statusDeProjeto,
} from '@gabinete/compartilhado';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { lerCorpo } from '../acesso/rotas.js';
import { atorDaSessao } from '../equipe/rotas.js';
import type { ServicoDeAcompanhamentoDoProjeto } from './acompanhamento.js';
import type { ConsultasDeProjetos } from './consultas.js';
import type { ServicoDeProjetos } from './servico.js';
import type { ServicoDeVocabularios } from './vocabularios.js';

const inteiro = z.coerce.number().int().positive();
const esquemaId = z.object({ id: inteiro });
const esquemaIdFilho = z.object({ id: inteiro, filhoId: inteiro });
const idOpcional = inteiro.optional();
const booleano = z
  .enum(['true', 'false'])
  .transform((v) => v === 'true')
  .optional();

const esquemaFiltro = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
  porPagina: z.coerce.number().int().min(1).max(100).default(25),
  busca: z.string().trim().min(1).max(100).optional(),
  status: z.enum(statusDeProjeto).optional(),
  etapaId: idOpcional,
  responsavelId: idOpcional,
  tipoProposicaoId: idOpcional,
  assuntoId: idOpcional,
  atrasados: booleano,
  meus: booleano,
});

export function registrarRotasDeProjetos(
  app: FastifyInstance,
  consultas: ConsultasDeProjetos,
  servico: ServicoDeProjetos,
  acompanhamento: ServicoDeAcompanhamentoDoProjeto,
  vocabularios: ServicoDeVocabularios,
): void {
  const id = (parametros: unknown) => lerCorpo(esquemaId, parametros).id;
  const filho = (parametros: unknown) => {
    const p = lerCorpo(esquemaIdFilho, parametros);
    return { id: p.id, filhoId: p.filhoId };
  };
  const ator = (request: FastifyRequest) => atorDaSessao(request.sessao);

  // --- Leituras (as rotas fixas antes de /:id, para "etapas" não ser lido como um id) ---
  app.get('/api/projetos', { config: { operacao: 'projetos.consultar' } }, (request) =>
    consultas.listar(ator(request), lerCorpo(esquemaFiltro, request.query)),
  );
  app.get('/api/projetos/etapas', { config: { operacao: 'projetos.consultar' } }, () =>
    consultas.etapas(),
  );
  app.get('/api/projetos/consolidado', { config: { operacao: 'projetos.consultar' } }, (request) =>
    consultas.consolidado(ator(request)),
  );
  app.get('/api/projetos/:id', { config: { operacao: 'projetos.consultar' } }, (request) =>
    consultas.ficha(id(request.params)),
  );

  // --- Vocabulários ---
  app.get(
    '/api/legislativo/categorias',
    { config: { operacao: 'projetos.consultar' } },
    (request) => {
      const { natureza } = lerCorpo(
        z.object({ natureza: z.enum(naturezasDeCategoriaDoLegislativo).optional() }),
        request.query,
      );
      return consultas.categorias(natureza);
    },
  );
  app.post(
    '/api/legislativo/categorias',
    { config: { operacao: 'projetos.vocabularios' } },
    async (request, reply) => {
      const criada = await vocabularios.criar(
        ator(request),
        lerCorpo(esquemaNovaCategoria, request.body),
      );
      return reply.status(201).send(criada);
    },
  );
  app.put(
    '/api/legislativo/categorias/:id/situacao',
    { config: { operacao: 'projetos.vocabularios' } },
    (request) =>
      vocabularios.alterarSituacao(
        ator(request),
        id(request.params),
        lerCorpo(esquemaSituacaoDaCategoria, request.body).situacao,
      ),
  );

  // --- Projeto ---
  app.post(
    '/api/projetos',
    { config: { operacao: 'projetos.registrar' } },
    async (request, reply) => {
      const criado = await servico.criar(ator(request), lerCorpo(esquemaNovoProjeto, request.body));
      return reply.status(201).send(criado);
    },
  );
  app.patch('/api/projetos/:id', { config: { operacao: 'projetos.alterar' } }, (request) =>
    servico.editar(
      ator(request),
      id(request.params),
      lerCorpo(esquemaAtualizarProjeto, request.body),
    ),
  );
  app.post('/api/projetos/:id/mover', { config: { operacao: 'projetos.alterar' } }, (request) => {
    const corpo = lerCorpo(esquemaMoverProjeto, request.body);
    return servico.mover(ator(request), id(request.params), corpo.etapaId, corpo.observacao);
  });
  app.post(
    '/api/projetos/:id/reatribuir',
    { config: { operacao: 'projetos.supervisionar' } },
    (request) =>
      servico.reatribuir(
        ator(request),
        id(request.params),
        lerCorpo(esquemaReatribuirProjeto, request.body).responsavelId,
      ),
  );
  app.post(
    '/api/projetos/:id/cancelar',
    { config: { operacao: 'projetos.supervisionar' } },
    (request) =>
      servico.cancelar(
        ator(request),
        id(request.params),
        lerCorpo(esquemaCancelarProjeto, request.body).justificativa,
      ),
  );

  // --- O que cerca o projeto ---
  app.put('/api/projetos/:id/assuntos', { config: { operacao: 'projetos.alterar' } }, (request) =>
    acompanhamento.assuntos(
      ator(request),
      id(request.params),
      lerCorpo(esquemaAssuntosDoProjeto, request.body).assuntos,
    ),
  );
  app.put('/api/projetos/:id/coautores', { config: { operacao: 'projetos.alterar' } }, (request) =>
    acompanhamento.coautores(
      ator(request),
      id(request.params),
      lerCorpo(esquemaCoautoresDoProjeto, request.body).coautores,
    ),
  );

  app.post(
    '/api/projetos/:id/tramitacoes',
    { config: { operacao: 'projetos.alterar' } },
    async (request, reply) =>
      reply
        .status(201)
        .send(
          await acompanhamento.registrarTramitacao(
            ator(request),
            id(request.params),
            lerCorpo(esquemaNovaTramitacao, request.body),
          ),
        ),
  );
  app.patch(
    '/api/projetos/:id/tramitacoes/:filhoId',
    { config: { operacao: 'projetos.alterar' } },
    (request) => {
      const p = filho(request.params);
      return acompanhamento.atualizarTramitacao(
        ator(request),
        p.id,
        p.filhoId,
        lerCorpo(esquemaAtualizarTramitacao, request.body),
      );
    },
  );
  app.delete(
    '/api/projetos/:id/tramitacoes/:filhoId',
    { config: { operacao: 'projetos.alterar' } },
    (request) => {
      const p = filho(request.params);
      return acompanhamento.removerTramitacao(ator(request), p.id, p.filhoId);
    },
  );

  app.post(
    '/api/projetos/:id/votacoes',
    { config: { operacao: 'projetos.alterar' } },
    async (request, reply) =>
      reply
        .status(201)
        .send(
          await acompanhamento.registrarVotacao(
            ator(request),
            id(request.params),
            lerCorpo(esquemaNovaVotacao, request.body),
          ),
        ),
  );
  app.patch(
    '/api/projetos/:id/votacoes/:filhoId',
    { config: { operacao: 'projetos.alterar' } },
    (request) => {
      const p = filho(request.params);
      return acompanhamento.atualizarVotacao(
        ator(request),
        p.id,
        p.filhoId,
        lerCorpo(esquemaAtualizarVotacao, request.body),
      );
    },
  );
  app.delete(
    '/api/projetos/:id/votacoes/:filhoId',
    { config: { operacao: 'projetos.alterar' } },
    (request) => {
      const p = filho(request.params);
      return acompanhamento.removerVotacao(ator(request), p.id, p.filhoId);
    },
  );
}
