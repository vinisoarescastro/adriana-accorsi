import { esquemaAntecedenciaDoAviso, esquemaMarcarAvisos } from '@gabinete/compartilhado';
import type { FastifyInstance } from 'fastify';
import { lerCorpo } from '../acesso/rotas.js';
import { atorDaSessao } from '../equipe/rotas.js';
import type { ServicoDeAvisos } from './servico.js';

export function registrarRotasDeAvisos(app: FastifyInstance, servico: ServicoDeAvisos): void {
  // Cada um vê e marca só os próprios avisos: não há rota que leia a caixa de outra pessoa.
  app.get('/api/avisos', { config: { operacao: 'avisos.consultar' } }, (request) =>
    servico.caixa(atorDaSessao(request.sessao)),
  );

  app.post('/api/avisos/lidos', { config: { operacao: 'avisos.marcar_lido' } }, (request) =>
    servico.marcarLidos(atorDaSessao(request.sessao), lerCorpo(esquemaMarcarAvisos, request.body)),
  );

  app.get('/api/avisos/configuracao', { config: { operacao: 'avisos.configurar' } }, () =>
    servico.configuracao(),
  );

  app.put('/api/avisos/configuracao', { config: { operacao: 'avisos.configurar' } }, (request) =>
    servico.configurar(
      atorDaSessao(request.sessao),
      lerCorpo(esquemaAntecedenciaDoAviso, request.body),
    ),
  );
}
