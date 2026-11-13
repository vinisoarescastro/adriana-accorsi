import { esquemaConsentimento, estadosDeEnvio } from '@gabinete/compartilhado';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { lerCorpo } from '../acesso/rotas.js';
import { atorDaSessao } from '../equipe/rotas.js';
import type { ServicoDeNotificacoes } from './servico.js';

const esquemaId = z.object({ id: z.coerce.number().int().positive() });
const esquemaFila = z.object({
  estado: z.enum(estadosDeEnvio).optional(),
  pagina: z.coerce.number().int().min(1).default(1),
  porPagina: z.coerce.number().int().min(1).max(100).default(25),
});

export function registrarRotasDeNotificacoes(
  app: FastifyInstance,
  servico: ServicoDeNotificacoes,
): void {
  const id = (parametros: unknown) => lerCorpo(esquemaId, parametros).id;

  app.get(
    '/api/pessoas/:id/consentimento',
    { config: { operacao: 'consentimento.registrar' } },
    async (request) => {
      const pessoaId = id(request.params);
      return {
        situacao: await servico.consultar(pessoaId),
        historico: await servico.historico(pessoaId),
      };
    },
  );
  app.put(
    '/api/pessoas/:id/consentimento',
    { config: { operacao: 'consentimento.registrar' } },
    (request) =>
      servico.registrar(
        atorDaSessao(request.sessao),
        id(request.params),
        lerCorpo(esquemaConsentimento, request.body),
      ),
  );

  app.get('/api/notificacoes', { config: { operacao: 'notificacoes.consultar_fila' } }, (request) =>
    servico.fila(lerCorpo(esquemaFila, request.query)),
  );
}
