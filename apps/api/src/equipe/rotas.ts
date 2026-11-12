import {
  esquemaAlterarHabilitacoes,
  esquemaAlterarPerfil,
  esquemaAlterarSituacao,
  esquemaAtualizarUsuario,
  esquemaNovoUsuario,
} from '@gabinete/compartilhado';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { lerCorpo } from '../acesso/rotas.js';
import type { DadosDaSessao } from '../acesso/sessoes.js';
import { enviarFoto, guardarFoto, lerFoto } from '../armazenamento/fotos-rotas.js';
import type { Armazenamento } from '../armazenamento/armazenamento.js';
import { erros } from '../erros.js';
import type { Ator } from './regras.js';
import type { ServicoDeEquipe } from './servico.js';

const esquemaId = z.object({ id: z.coerce.number().int().positive() });

export const atorDaSessao = (sessao: DadosDaSessao | undefined): Ator => {
  if (!sessao) throw erros.naoAutenticado();
  return { usuarioId: sessao.usuarioId, perfil: sessao.perfil, habilitacoes: sessao.habilitacoes };
};

export function registrarRotasDeEquipe(
  app: FastifyInstance,
  servico: ServicoDeEquipe,
  armazenamento: Armazenamento,
): void {
  const idDaRota = (parametros: unknown) => lerCorpo(esquemaId, parametros).id;

  app.get('/api/equipe', { config: { operacao: 'equipe.ver' } }, () => servico.listar());

  app.get('/api/equipe/:id', { config: { operacao: 'equipe.ver' } }, (request) =>
    servico.obter(idDaRota(request.params)),
  );

  app.post(
    '/api/equipe',
    { config: { operacao: 'equipe.administrar' } },
    async (request, reply) => {
      const criado = await servico.criar(
        atorDaSessao(request.sessao),
        lerCorpo(esquemaNovoUsuario, request.body),
      );
      return reply.status(201).send(criado);
    },
  );

  app.patch('/api/equipe/:id', { config: { operacao: 'equipe.administrar' } }, (request) =>
    servico.atualizar(
      atorDaSessao(request.sessao),
      idDaRota(request.params),
      lerCorpo(esquemaAtualizarUsuario, request.body),
    ),
  );

  app.put('/api/equipe/:id/perfil', { config: { operacao: 'equipe.administrar' } }, (request) =>
    servico.alterarPerfil(
      atorDaSessao(request.sessao),
      idDaRota(request.params),
      lerCorpo(esquemaAlterarPerfil, request.body).perfil,
    ),
  );

  app.put('/api/equipe/:id/situacao', { config: { operacao: 'equipe.administrar' } }, (request) =>
    servico.alterarSituacao(
      atorDaSessao(request.sessao),
      idDaRota(request.params),
      lerCorpo(esquemaAlterarSituacao, request.body).situacao,
    ),
  );

  app.put(
    '/api/equipe/:id/habilitacoes',
    { config: { operacao: 'equipe.administrar' } },
    (request) =>
      servico.alterarHabilitacoes(
        atorDaSessao(request.sessao),
        idDaRota(request.params),
        lerCorpo(esquemaAlterarHabilitacoes, request.body).habilitacoes,
      ),
  );

  app.post(
    '/api/equipe/:id/redefinir-senha',
    { config: { operacao: 'equipe.administrar' } },
    (request) => servico.redefinirSenha(atorDaSessao(request.sessao), idDaRota(request.params)),
  );

  app.get('/api/equipe/:id/historico', { config: { operacao: 'equipe.historico' } }, (request) =>
    servico.historico(idDaRota(request.params)),
  );

  app.get('/api/equipe/:id/foto', { config: { operacao: 'equipe.ver' } }, async (request, reply) =>
    enviarFoto(armazenamento, await servico.chaveDaFoto(idDaRota(request.params)), reply),
  );

  // Cada um troca a própria foto.
  app.post(
    '/api/perfil/foto',
    { config: { operacao: 'perfil.alterar_foto' } },
    async (request, reply) => {
      const ator = atorDaSessao(request.sessao);
      const foto = lerFoto(request);
      const anterior = await servico.chaveDaFoto(ator.usuarioId);
      const chave = await guardarFoto(armazenamento, `fotos/usuarios/${ator.usuarioId}`, foto);
      await servico.registrarFoto(ator, ator.usuarioId, chave, anterior);
      if (anterior) await armazenamento.remover(anterior);
      return reply.status(204).send();
    },
  );
}
