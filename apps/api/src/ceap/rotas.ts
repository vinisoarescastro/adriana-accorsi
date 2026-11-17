import {
  esquemaAcompanharDespesa,
  esquemaAtualizarCategoriaDaCeap,
  esquemaAtualizarDespesa,
  esquemaCancelarDespesa,
  esquemaDecidirDespesa,
  esquemaNovaCategoriaDaCeap,
  esquemaNovaDespesa,
  esquemaNovoParametro,
  esquemaSituacaoDaCategoriaDaCeap,
  statusDeDespesa,
  tamanhoMaximoDoDocumento,
} from '@gabinete/compartilhado';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { lerCorpo } from '../acesso/rotas.js';
import { atorDaSessao } from '../equipe/rotas.js';
import { erros } from '../erros.js';
import type { ConsultasDaCeap } from './consultas.js';
import type { ServicoDeCompetencias } from './competencias.js';
import type { ServicoDeComprovantes } from './comprovantes.js';
import type { ServicoDeDespesas } from './despesas.js';
import type { ServicoDoSaldoDaCeap } from './painel.js';
import type { ServicoDeParametrosDaCeap } from './parametros.js';
import type { ServicoDoRelatorioDaCeap } from './relatorio.js';

const inteiro = z.coerce.number().int().positive();
const booleano = z
  .enum(['true', 'false'])
  .transform((v) => v === 'true')
  .optional();
const esquemaId = z.object({ id: inteiro });
const esquemaIdFilho = z.object({ id: inteiro, filhoId: inteiro });
const esquemaCompetencia = z.object({
  ano: z.coerce.number().int().min(2000).max(2100),
  mes: z.coerce.number().int().min(1).max(12),
});
const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const competencia = z.string().regex(/^\d{4}-\d{2}$/);
const esquemaEnvio = z.object({ nome: z.string().trim().min(1).max(260) });
const esquemaFiltro = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
  porPagina: z.coerce.number().int().min(1).max(100).default(25),
  ano: z.coerce.number().int().min(2000).max(2100).optional(),
  mes: z.coerce.number().int().min(1).max(12).optional(),
  categoriaId: inteiro.optional(),
  status: z.enum(statusDeDespesa).optional(),
  busca: z.string().trim().min(1).max(100).optional(),
  minhas: booleano,
  aguardando: booleano,
});

const contentDisposition = (nome: string) =>
  `attachment; filename="${nome.replace(/[^\x20-\x7e]|["\\]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(nome)}`;

export interface ServicosDaCeap {
  readonly consultas: ConsultasDaCeap;
  readonly despesas: ServicoDeDespesas;
  readonly comprovantes: ServicoDeComprovantes;
  readonly parametros: ServicoDeParametrosDaCeap;
  readonly competencias: ServicoDeCompetencias;
  readonly saldo: ServicoDoSaldoDaCeap;
  readonly relatorio: ServicoDoRelatorioDaCeap;
}

export function registrarRotasDaCeap(app: FastifyInstance, s: ServicosDaCeap): void {
  const id = (p: unknown) => lerCorpo(esquemaId, p).id;
  const filho = (p: unknown) => lerCorpo(esquemaIdFilho, p);
  const ator = (request: FastifyRequest) => atorDaSessao(request.sessao);
  const consultar = { config: { operacao: 'ceap.consultar' as const } };
  const lancar = { config: { operacao: 'ceap.lancar' as const } };
  const decidir = { config: { operacao: 'ceap.decidir' as const } };
  const parametros = { config: { operacao: 'ceap.parametros' as const } };

  // --- Saldo, reconstituição e painel ---
  app.get('/api/ceap/saldo', consultar, (request) =>
    s.saldo.saldo(
      lerCorpo(
        z.object({ ano: z.coerce.number().int().min(2000).max(2100).optional() }),
        request.query,
      ).ano,
    ),
  );
  app.get('/api/ceap/reconstituicao', { config: { operacao: 'ceap.reconstituir' } }, (request) =>
    s.saldo.reconstituir(lerCorpo(z.object({ em: dia }), request.query).em),
  );
  app.get('/api/painel/financeiro', { config: { operacao: 'painel.financeiro' } }, () =>
    s.saldo.painel(),
  );

  // --- Parâmetros e categorias ---
  app.get('/api/ceap/parametros', consultar, () => s.parametros.listar());
  app.post('/api/ceap/parametros', parametros, async (request, reply) =>
    reply
      .status(201)
      .send(
        await s.parametros.definir(ator(request), lerCorpo(esquemaNovoParametro, request.body)),
      ),
  );
  app.get('/api/ceap/categorias', consultar, () => s.parametros.categorias());
  app.post('/api/ceap/categorias', parametros, async (request, reply) =>
    reply
      .status(201)
      .send(
        await s.parametros.criarCategoria(
          ator(request),
          lerCorpo(esquemaNovaCategoriaDaCeap, request.body),
        ),
      ),
  );
  app.patch('/api/ceap/categorias/:id', parametros, (request) =>
    s.parametros.atualizarCategoria(
      ator(request),
      id(request.params),
      lerCorpo(esquemaAtualizarCategoriaDaCeap, request.body),
    ),
  );
  app.put('/api/ceap/categorias/:id/situacao', parametros, (request) =>
    s.parametros.alterarSituacaoDaCategoria(
      ator(request),
      id(request.params),
      lerCorpo(esquemaSituacaoDaCategoriaDaCeap, request.body).situacao,
    ),
  );

  // --- Competências ---
  app.post(
    '/api/ceap/competencias/:ano/:mes/encerrar',
    { config: { operacao: 'ceap.supervisionar' } },
    async (request, reply) => {
      const c = lerCorpo(esquemaCompetencia, request.params);
      await s.competencias.encerrar(ator(request), c.ano, c.mes);
      return reply.send(await s.saldo.saldo(c.ano));
    },
  );
  app.post(
    '/api/ceap/competencias/:ano/:mes/reabrir',
    { config: { operacao: 'ceap.supervisionar' } },
    async (request, reply) => {
      const c = lerCorpo(esquemaCompetencia, request.params);
      await s.competencias.reabrir(ator(request), c.ano, c.mes);
      return reply.send(await s.saldo.saldo(c.ano));
    },
  );

  // --- Relatório e pacote ---
  const periodo = z.object({ de: competencia, ate: competencia });
  app.get('/api/ceap/relatorio', { config: { operacao: 'ceap.pacote' } }, (request) => {
    const q = lerCorpo(periodo, request.query);
    return s.relatorio.relatorio(q.de, q.ate);
  });
  app.get('/api/ceap/pacote', { config: { operacao: 'ceap.pacote' } }, async (request, reply) => {
    const q = lerCorpo(periodo, request.query);
    const pacote = await s.relatorio.pacote(q.de, q.ate);
    return reply
      .header('Content-Type', 'application/zip')
      .header('Content-Disposition', contentDisposition(pacote.nome))
      .header('X-Content-Type-Options', 'nosniff')
      .send(pacote.bytes);
  });

  // --- Despesas (as rotas fixas antes de /:id) ---
  app.get('/api/ceap/despesas', consultar, (request) =>
    s.consultas.listar(ator(request), lerCorpo(esquemaFiltro, request.query)),
  );
  app.get('/api/ceap/despesas/:id', consultar, (request) => s.consultas.ficha(id(request.params)));
  app.post('/api/ceap/despesas', lancar, async (request, reply) =>
    reply
      .status(201)
      .send(await s.despesas.lancar(ator(request), lerCorpo(esquemaNovaDespesa, request.body))),
  );
  app.patch('/api/ceap/despesas/:id', lancar, (request) =>
    s.despesas.editar(
      ator(request),
      id(request.params),
      lerCorpo(esquemaAtualizarDespesa, request.body),
    ),
  );
  app.post('/api/ceap/despesas/:id/enviar', lancar, (request) =>
    s.despesas.enviar(ator(request), id(request.params)),
  );
  app.post('/api/ceap/despesas/:id/cancelar', lancar, (request) =>
    s.despesas.cancelar(
      ator(request),
      id(request.params),
      lerCorpo(esquemaCancelarDespesa, request.body).justificativa,
    ),
  );
  app.post('/api/ceap/despesas/:id/decidir', decidir, (request) =>
    s.despesas.decidir(
      ator(request),
      id(request.params),
      lerCorpo(esquemaDecidirDespesa, request.body),
    ),
  );
  app.post('/api/ceap/despesas/:id/mover', decidir, (request) => {
    const c = lerCorpo(esquemaAcompanharDespesa, request.body);
    return s.despesas.acompanhar(ator(request), id(request.params), c.etapaId, c.observacao);
  });
  app.get('/api/ceap/etapas', consultar, async () => {
    const mapa = await s.consultas.etapas();
    return mapa;
  });

  // --- Comprovantes: o corpo é o arquivo; o nome vai no endereço. O download é sempre como anexo. ---
  app.post(
    '/api/ceap/despesas/:id/comprovantes',
    { config: { operacao: 'ceap.lancar' }, bodyLimit: tamanhoMaximoDoDocumento + 1024 },
    async (request, reply) => {
      if (!Buffer.isBuffer(request.body)) {
        throw erros.arquivoInvalido(
          'Envie o arquivo (PDF, PNG, JPEG ou ZIP) no corpo da requisição.',
        );
      }
      const lista = await s.comprovantes.anexar(ator(request), id(request.params), {
        nome: lerCorpo(esquemaEnvio, request.query).nome,
        bytes: request.body,
      });
      return reply.status(201).send(lista);
    },
  );
  app.get('/api/ceap/despesas/:id/comprovantes/:filhoId', consultar, async (request, reply) => {
    const arquivo = await s.comprovantes.baixar(filho(request.params).filhoId);
    return reply
      .header('Content-Type', arquivo.tipo)
      .header('Content-Disposition', contentDisposition(arquivo.nome))
      .header('X-Content-Type-Options', 'nosniff')
      .header('Content-Security-Policy', "default-src 'none'; sandbox")
      .send(arquivo.bytes);
  });
  app.delete('/api/ceap/despesas/:id/comprovantes/:filhoId', lancar, (request) =>
    s.comprovantes.remover(ator(request), filho(request.params).filhoId),
  );
}
