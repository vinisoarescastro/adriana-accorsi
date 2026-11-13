import { esquemaNovoAndamento, esquemaPoliticaDePublicacao } from '@gabinete/compartilhado';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { lerCorpo } from '../acesso/rotas.js';
import { atorDaSessao } from '../equipe/rotas.js';
import type { ServicoDeAcompanhamento } from './acompanhamento.js';
import type { ServicoDePoliticaDePublicacao } from './politica.js';

const esquemaId = z.object({ id: z.coerce.number().int().positive() });

/**
 * Política de publicação, link de acompanhamento, pré-visualização e andamentos. Não existe rota
 * que publique comentário, documento, prioridade ou dado de outro módulo (RN-PUB-08).
 */
export function registrarRotasDePublicacao(
  app: FastifyInstance,
  politica: ServicoDePoliticaDePublicacao,
  acompanhamento: ServicoDeAcompanhamento,
): void {
  const id = (parametros: unknown) => lerCorpo(esquemaId, parametros).id;

  app.get(
    '/api/publicacao/politica',
    { config: { operacao: 'publicacao.consultar_politica' } },
    () => politica.consultar(),
  );
  app.put(
    '/api/publicacao/politica',
    { config: { operacao: 'publicacao.alterar_politica' } },
    (request) =>
      politica.alterar(
        atorDaSessao(request.sessao),
        lerCorpo(esquemaPoliticaDePublicacao, request.body),
      ),
  );

  app.get('/api/demandas/:id/acompanhamento', { config: { operacao: 'link.obter' } }, (request) =>
    acompanhamento.obter(atorDaSessao(request.sessao), id(request.params)),
  );
  for (const [caminho, acao] of [
    ['revogar', 'revogar'],
    ['regenerar', 'regenerar'],
    ['suspender', 'suspender'],
    ['retomar', 'retomar'],
  ] as const) {
    app.post(
      `/api/demandas/:id/link/${caminho}`,
      { config: { operacao: 'link.gerir' } },
      (request) => acompanhamento[acao](atorDaSessao(request.sessao), id(request.params)),
    );
  }

  app.post(
    '/api/demandas/:id/andamentos',
    { config: { operacao: 'andamentos.publicar' } },
    async (request, reply) => {
      const lista = await acompanhamento.publicar(
        atorDaSessao(request.sessao),
        id(request.params),
        lerCorpo(esquemaNovoAndamento, request.body),
      );
      return reply.status(201).send(lista);
    },
  );
  app.delete('/api/andamentos/:id', { config: { operacao: 'andamentos.remover' } }, (request) =>
    acompanhamento.removerAndamento(atorDaSessao(request.sessao), id(request.params)),
  );
}
