import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import type { Conexao } from '@gabinete/banco';
import Fastify, { type FastifyInstance } from 'fastify';
import { registrarAutenticacao } from './acesso/autenticacao.js';
import { registrarRotasDeAcesso } from './acesso/rotas.js';
import { ServicoDeAcesso } from './acesso/servico.js';
import { ConsultasDeAgenda } from './agenda/consultas.js';
import { registrarRotasDeAgenda } from './agenda/rotas.js';
import { ServicoDeAgenda } from './agenda/servico.js';
import { registrarRotasDeAvisos } from './avisos/rotas.js';
import { ConsultasDeEventos } from './eventos/consultas.js';
import { registrarRotasDeEventos } from './eventos/rotas.js';
import { ServicoDeEventos } from './eventos/servico.js';
import { ServicoDeAvisos } from './avisos/servico.js';
import type { Armazenamento } from './armazenamento/armazenamento.js';
import { registrarRotasDeComentarios } from './comentarios/rotas.js';
import { ServicoDeComentarios } from './comentarios/servico.js';
import { ConsultasDeDemandas } from './demandas/consultas.js';
import { registrarRotasDeDemandas } from './demandas/rotas.js';
import { ServicoDeDemandas } from './demandas/servico.js';
import type { Antivirus } from './documentos/antivirus.js';
import { registrarRotasDeDocumentos } from './documentos/rotas.js';
import { ServicoDeDocumentos } from './documentos/servico.js';
import { registrarRotasDeNotificacoes } from './notificacoes/rotas.js';
import { ServicoDeNotificacoes } from './notificacoes/servico.js';
import { registrarRotasDoPainel } from './painel/rotas.js';
import { ServicoDeAcompanhamento } from './publicacao/acompanhamento.js';
import { ServicoDePoliticaDePublicacao } from './publicacao/politica.js';
import { registrarRotasDePublicacao } from './publicacao/rotas.js';
import { ServicoDoPainelDeAcompanhamento } from './painel/acompanhamento.js';
import { ServicoDoPainel } from './painel/servico.js';
import { registrarRotasDePessoas } from './pessoas/rotas.js';
import { ServicoDePessoas } from './pessoas/servico.js';
import { registrarRotasDeAuditoria } from './auditoria/rotas.js';
import { ServicoDeAuditoria } from './auditoria/servico.js';
import { registrarRotasDeFluxos } from './fluxos/rotas.js';
import { ServicoDeFluxos } from './fluxos/servico.js';
import { ServicoDeBeneficiarios } from './beneficiarios/servico.js';
import { ServicoDeCompetencias } from './ceap/competencias.js';
import { ServicoDeComprovantes } from './ceap/comprovantes.js';
import { ConsultasDaCeap } from './ceap/consultas.js';
import { ServicoDeDespesas } from './ceap/despesas.js';
import { ServicoDoSaldoDaCeap } from './ceap/painel.js';
import { ServicoDeParametrosDaCeap } from './ceap/parametros.js';
import { ServicoDoRelatorioDaCeap } from './ceap/relatorio.js';
import { registrarRotasDaCeap } from './ceap/rotas.js';
import { ConsultasDeEmendas } from './emendas/consultas.js';
import { ServicoDeDestinacoes } from './emendas/destinacoes.js';
import { registrarRotasDeEmendas } from './emendas/rotas.js';
import { ServicoDeEmendas } from './emendas/servico.js';
import { registrarRotasDeBeneficiarios } from './beneficiarios/rotas.js';
import { ServicoDeAcompanhamentoDoProjeto } from './projetos/acompanhamento.js';
import { ConsultasDeProjetos } from './projetos/consultas.js';
import { registrarRotasDeProjetos } from './projetos/rotas.js';
import { ServicoDeProjetos } from './projetos/servico.js';
import { ServicoDeVocabularios } from './projetos/vocabularios.js';
import { ConsultasDeTarefas } from './tarefas/consultas.js';
import { registrarRotasDeTarefas } from './tarefas/rotas.js';
import { ServicoDeTarefas } from './tarefas/servico.js';
import { registrarRotasDeEquipe } from './equipe/rotas.js';
import { ServicoDeEquipe } from './equipe/servico.js';
import { ErroDeNegocio, erros } from './erros.js';
import { registrarRotasDoGabinete } from './gabinete/rotas.js';
import { ServicoDoGabinete } from './gabinete/servico.js';
import './tipos.js';

export interface DependenciasDoServidor {
  readonly ambiente: {
    readonly NODE_ENV: 'development' | 'test' | 'production';
    readonly HOSTNAME_APP: string;
    readonly SESSAO_SEGREDO: string;
    readonly HOSTNAME_PUBLICO: string;
  };
  readonly conexao: Conexao;
  readonly armazenamento: Armazenamento;
  /** Verificação de vírus. Obrigatória em produção (ver principal.ts); opcional em desenvolvimento e testes. */
  readonly antivirus?: Antivirus;
  /** Gerador do protocolo. Só os testes trocam, para forçar colisões. */
  readonly gerarProtocolo?: () => string;
  /** Relógio injetável, para testar expiração de sessão e bloqueio de conta. */
  readonly agora?: () => Date;
  /** Espera injetável, para testar o atraso por tentativa errada sem esperar de verdade. */
  readonly dormir?: (ms: number) => Promise<void>;
  readonly limites?: { entradasPorMinuto?: number; geralPorMinuto?: number };
  readonly registrarRotas?: (app: FastifyInstance) => void | Promise<void>;
  readonly logger?: boolean;
}

const dormirDeVerdade = (ms: number) => new Promise<void>((resolver) => setTimeout(resolver, ms));

export async function construirServidor(dep: DependenciasDoServidor): Promise<FastifyInstance> {
  const producao = dep.ambiente.NODE_ENV === 'production';

  const app = Fastify({
    // Atrás do Caddy, o IP real vem do cabeçalho encaminhado. Só confiamos nele em produção.
    trustProxy: producao,
    logger: dep.logger
      ? {
          level: 'info',
          redact: ['req.headers.cookie', 'req.headers.authorization', 'res.headers["set-cookie"]'],
        }
      : false,
    bodyLimit: 1_048_576,
  });

  await app.register(cookie);
  await app.register(rateLimit, {
    global: true,
    max: dep.limites?.geralPorMinuto ?? 600,
    timeWindow: '1 minute',
    errorResponseBuilder: () => erros.muitasRequisicoes(),
  });

  const agora = dep.agora ?? (() => new Date());
  const servico = new ServicoDeAcesso({
    bd: dep.conexao.bd,
    segredo: dep.ambiente.SESSAO_SEGREDO,
    agora,
    dormir: dep.dormir ?? dormirDeVerdade,
  });

  registrarAutenticacao(app, servico, {
    producao,
    hostnameDaAplicacao: dep.ambiente.HOSTNAME_APP,
  });

  // Nenhuma resposta da API deve ser guardada em cache (há dados pessoais e de sessão).
  app.addHook('onSend', async (_request, reply) => {
    void reply.header('Cache-Control', 'no-store');
  });

  app.setErrorHandler((erro, request, reply) => {
    if (erro instanceof ErroDeNegocio) {
      return reply.status(erro.status).send(erro.paraResposta());
    }
    if (erro instanceof Error && 'statusCode' in erro && erro.statusCode === 429) {
      return reply.status(429).send(erros.muitasRequisicoes().paraResposta());
    }
    if (erro instanceof Error && 'statusCode' in erro && erro.statusCode === 413) {
      return reply.status(413).send(erros.requisicaoInvalida().paraResposta());
    }
    request.log.error({ err: erro }, 'erro não tratado');
    return reply.status(500).send({ codigo: 'erro_interno', mensagem: 'Erro interno.' });
  });

  app.setNotFoundHandler((_request, reply) =>
    reply.status(404).send(erros.naoEncontrado().paraResposta()),
  );

  app.get('/api/saude', { config: { publica: true } }, async () => ({ ok: true }));

  // Fotos chegam como PNG ou JPEG no corpo; o tipo real é decidido pelo conteúdo (ver foto.ts).
  // Arquivos (fotos e documentos) chegam como bytes no corpo; o tipo real é decidido pelo CONTEÚDO.
  // O limite de tamanho é de cada rota (bodyLimit), não do tipo de conteúdo.
  app.addContentTypeParser(
    [
      'image/png',
      'image/jpeg',
      'application/pdf',
      'application/zip',
      'application/x-zip-compressed',
      'application/octet-stream',
    ],
    { parseAs: 'buffer' },
    (_request, corpo, pronto) => pronto(null, corpo),
  );

  registrarRotasDeAcesso(app, servico, {
    producao,
    entradasPorMinuto: dep.limites?.entradasPorMinuto ?? 10,
  });
  registrarRotasDeEquipe(app, new ServicoDeEquipe(dep.conexao.bd, agora), dep.armazenamento);
  registrarRotasDoGabinete(app, new ServicoDoGabinete(dep.conexao.bd), dep.armazenamento);
  registrarRotasDeAuditoria(app, new ServicoDeAuditoria(dep.conexao.bd));
  registrarRotasDeFluxos(app, new ServicoDeFluxos(dep.conexao.bd));

  const bd = dep.conexao.bd;
  const consultasDeDemandas = new ConsultasDeDemandas(bd, agora);
  registrarRotasDePessoas(app, new ServicoDePessoas(bd));
  registrarRotasDeDemandas(
    app,
    consultasDeDemandas,
    new ServicoDeDemandas({
      bd,
      consultas: consultasDeDemandas,
      agora,
      segredoDaAplicacao: dep.ambiente.SESSAO_SEGREDO,
      hostnamePublico: dep.ambiente.HOSTNAME_PUBLICO,
      ...(dep.gerarProtocolo ? { gerarProtocolo: dep.gerarProtocolo } : {}),
    }),
  );
  registrarRotasDeComentarios(app, new ServicoDeComentarios(bd, consultasDeDemandas, agora));
  registrarRotasDeDocumentos(
    app,
    new ServicoDeDocumentos(bd, dep.armazenamento, consultasDeDemandas, dep.antivirus, agora),
  );
  registrarRotasDoPainel(
    app,
    new ServicoDoPainel(bd, agora),
    new ServicoDoPainelDeAcompanhamento(bd, agora),
  );
  registrarRotasDePublicacao(
    app,
    new ServicoDePoliticaDePublicacao(bd),
    new ServicoDeAcompanhamento({
      conexao: dep.conexao,
      agora,
      segredoDaAplicacao: dep.ambiente.SESSAO_SEGREDO,
      hostnamePublico: dep.ambiente.HOSTNAME_PUBLICO,
    }),
  );
  registrarRotasDeNotificacoes(app, new ServicoDeNotificacoes(bd, agora));
  registrarRotasDeAvisos(app, new ServicoDeAvisos(bd, agora));
  const consultasDeEventos = new ConsultasDeEventos(bd, agora);
  registrarRotasDeEventos(
    app,
    consultasDeEventos,
    new ServicoDeEventos({ bd, consultas: consultasDeEventos, agora }),
  );
  const consultasDeAgenda = new ConsultasDeAgenda(bd, agora);
  registrarRotasDeAgenda(
    app,
    consultasDeAgenda,
    new ServicoDeAgenda({ bd, consultas: consultasDeAgenda, agora }),
  );
  const consultasDeTarefas = new ConsultasDeTarefas(bd, agora);
  registrarRotasDeTarefas(
    app,
    consultasDeTarefas,
    new ServicoDeTarefas({ bd, consultas: consultasDeTarefas, agora }),
  );

  registrarRotasDeBeneficiarios(app, new ServicoDeBeneficiarios(bd));
  const consultasDeProjetos = new ConsultasDeProjetos(bd, agora);
  registrarRotasDeProjetos(
    app,
    consultasDeProjetos,
    new ServicoDeProjetos({ bd, consultas: consultasDeProjetos, agora }),
    new ServicoDeAcompanhamentoDoProjeto(bd, consultasDeProjetos, agora),
    new ServicoDeVocabularios(bd),
  );

  const consultasDeEmendas = new ConsultasDeEmendas(bd, agora);
  registrarRotasDeEmendas(
    app,
    consultasDeEmendas,
    new ServicoDeEmendas({ bd, consultas: consultasDeEmendas, agora }),
    new ServicoDeDestinacoes(bd, consultasDeEmendas, agora),
  );

  const consultasDaCeap = new ConsultasDaCeap(bd, agora);
  registrarRotasDaCeap(app, {
    consultas: consultasDaCeap,
    despesas: new ServicoDeDespesas({ bd, consultas: consultasDaCeap, agora }),
    comprovantes: new ServicoDeComprovantes(
      bd,
      dep.armazenamento,
      consultasDaCeap,
      dep.antivirus,
      agora,
    ),
    parametros: new ServicoDeParametrosDaCeap(bd, agora),
    competencias: new ServicoDeCompetencias(bd, agora),
    saldo: new ServicoDoSaldoDaCeap(bd, agora),
    relatorio: new ServicoDoRelatorioDaCeap(bd, consultasDaCeap, dep.armazenamento, agora),
  });

  await dep.registrarRotas?.(app);
  return app;
}
