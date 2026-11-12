import { naturezasDeDocumento, tamanhoMaximoDoDocumento } from '@gabinete/compartilhado';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { lerCorpo } from '../acesso/rotas.js';
import { atorDaSessao } from '../equipe/rotas.js';
import { erros } from '../erros.js';
import type { ServicoDeDocumentos } from './servico.js';

const esquemaId = z.object({ id: z.coerce.number().int().positive() });
const esquemaEnvio = z.object({
  nome: z.string().trim().min(1).max(260),
  natureza: z.enum(naturezasDeDocumento).default('outro'),
});

/** Nome com acentos vai como parâmetro de endereço ou no cabeçalho, nos formatos RFC 5987. */
const contentDisposition = (nome: string) =>
  `attachment; filename="${nome.replace(/[^\x20-\x7e]|["\\]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(nome)}`;

export function registrarRotasDeDocumentos(
  app: FastifyInstance,
  servico: ServicoDeDocumentos,
): void {
  // O corpo é o arquivo em si (PDF, PNG, JPEG ou ZIP), não um formulário: o nome e a natureza vão
  // no endereço (?nome=...&natureza=...). O tipo real é decidido pelo conteúdo.
  app.post(
    '/api/demandas/:id/documentos',
    { config: { operacao: 'documentos.anexar' }, bodyLimit: tamanhoMaximoDoDocumento + 1024 },
    async (request, reply) => {
      if (!Buffer.isBuffer(request.body)) {
        throw erros.arquivoInvalido(
          'Envie o arquivo (PDF, PNG, JPEG ou ZIP) no corpo da requisição.',
        );
      }
      const envio = lerCorpo(esquemaEnvio, request.query);
      const documentos = await servico.anexar(
        atorDaSessao(request.sessao),
        lerCorpo(esquemaId, request.params).id,
        { nome: envio.nome, natureza: envio.natureza, bytes: request.body },
      );
      return reply.status(201).send(documentos);
    },
  );

  // Download SEMPRE como anexo, nunca exibido pelo navegador na nossa origem.
  app.get(
    '/api/documentos/:id/conteudo',
    { config: { operacao: 'documentos.baixar' } },
    async (request, reply) => {
      const arquivo = await servico.baixar(
        atorDaSessao(request.sessao),
        lerCorpo(esquemaId, request.params).id,
      );
      return reply
        .header('Content-Type', arquivo.tipo)
        .header('Content-Disposition', contentDisposition(arquivo.nome))
        .header('X-Content-Type-Options', 'nosniff')
        .header('Content-Security-Policy', "default-src 'none'; sandbox")
        .send(arquivo.bytes);
    },
  );

  app.delete('/api/documentos/:id', { config: { operacao: 'documentos.remover' } }, (request) =>
    servico.remover(atorDaSessao(request.sessao), lerCorpo(esquemaId, request.params).id),
  );
}
