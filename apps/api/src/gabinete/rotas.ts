import { esquemaGabinete } from '@gabinete/compartilhado';
import type { FastifyInstance } from 'fastify';
import { lerCorpo } from '../acesso/rotas.js';
import type { Armazenamento } from '../armazenamento/armazenamento.js';
import { tamanhoMaximoDaFoto } from '../armazenamento/foto.js';
import { enviarFoto, guardarFoto, lerFoto } from '../armazenamento/fotos-rotas.js';
import { atorDaSessao } from '../equipe/rotas.js';
import type { ServicoDoGabinete } from './servico.js';

export function registrarRotasDoGabinete(
  app: FastifyInstance,
  servico: ServicoDoGabinete,
  armazenamento: Armazenamento,
): void {
  app.get('/api/gabinete', { config: { operacao: 'gabinete.consultar' } }, () => servico.obter());

  app.put('/api/gabinete', { config: { operacao: 'gabinete.editar' } }, (request) =>
    servico.salvar(atorDaSessao(request.sessao), lerCorpo(esquemaGabinete, request.body)),
  );

  app.get(
    '/api/gabinete/foto',
    { config: { operacao: 'gabinete.consultar' } },
    async (_request, reply) => enviarFoto(armazenamento, await servico.chaveDaFoto(), reply),
  );

  app.post(
    '/api/gabinete/foto',
    { config: { operacao: 'gabinete.editar' }, bodyLimit: tamanhoMaximoDaFoto + 1024 },
    async (request, reply) => {
      const foto = lerFoto(request);
      const chave = await guardarFoto(armazenamento, 'fotos/gabinete', foto);
      const anterior = await servico.registrarFoto(atorDaSessao(request.sessao), chave);
      if (anterior) await armazenamento.remover(anterior);
      return reply.status(204).send();
    },
  );
}
