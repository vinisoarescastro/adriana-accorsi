import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { lerCorpo } from '../acesso/rotas.js';
import { erros } from '../erros.js';
import { entidadesComHistorico, type ServicoDeAuditoria } from './servico.js';

const esquemaFiltro = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
  porPagina: z.coerce.number().int().min(1).max(100).default(25),
  operacao: z.string().trim().min(1).max(80).optional(),
  entidade: z.string().trim().min(1).max(80).optional(),
  autorId: z.coerce.number().int().positive().optional(),
  de: z.coerce.date().optional(),
  ate: z.coerce.date().optional(),
});

const esquemaRegistro = z.object({
  entidade: z.string().min(1).max(80),
  registroId: z.string().min(1).max(40),
});

export function registrarRotasDeAuditoria(app: FastifyInstance, servico: ServicoDeAuditoria): void {
  app.get('/api/auditoria', { config: { operacao: 'auditoria.consultar_gabinete' } }, (request) =>
    servico.listar(lerCorpo(esquemaFiltro, request.query)),
  );

  app.get('/api/auditoria/opcoes', { config: { operacao: 'auditoria.consultar_gabinete' } }, () =>
    servico.opcoes(),
  );

  // Histórico de um registro. Só entidades já liberadas: a de um módulo novo continua
  // inexistente até que o serviço dele confira o alcance do registro (falha fechada).
  app.get(
    '/api/historico/:entidade/:registroId',
    { config: { operacao: 'auditoria.historico_registro' } },
    (request) => {
      const { entidade, registroId } = lerCorpo(esquemaRegistro, request.params);
      if (!(entidadesComHistorico as readonly string[]).includes(entidade)) {
        throw erros.naoEncontrado();
      }
      return servico.historicoDoRegistro(entidade, registroId);
    },
  );
}
