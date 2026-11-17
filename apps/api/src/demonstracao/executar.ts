import { abrirConexao, etapa, exigirBancoLocal, tipoProcesso } from '@gabinete/banco';
import { eq } from 'drizzle-orm';
import { resolve } from 'node:path';
import { ArmazenamentoEmDisco } from '../armazenamento/armazenamento.js';
import { Aleatorio, Relogio } from './aleatorio.js';
import { popularAgenda } from './agenda.js';
import type { Contexto, EtapaConhecida } from './contexto.js';
import { popularCorresponsaveis } from './corresponsaveis.js';
import { popularDemandas } from './demandas.js';
import { popularFinanceiro } from './financeiro.js';
import { gravarAvisosETrilha } from './gravar.js';
import { popularInteracoes } from './interacoes.js';
import { popularLegislativo } from './legislativo.js';
import { limpar } from './limpar.js';
import { popularPessoas } from './pessoas.js';
import { popularTarefas } from './tarefas.js';
import { popularUsuarios, senhaDaDemonstracao } from './usuarios.js';

/**
 * Prepara o banco LOCAL para uma demonstração: apaga os dados de uso e cria uma base fictícia, grande
 * e coerente (usuários, cidadãos, demandas com histórico, tarefas, comentários com menções, agenda,
 * eventos, e-mails, documentos, beneficiários, projetos de lei, avisos e auditoria). Nunca roda fora de um banco local.
 *
 * Uso: `npm run demonstracao -w @gabinete/api`.
 */
const urlAdmin = process.env.DATABASE_URL_ADMIN;
const segredo = process.env.SESSAO_SEGREDO;
if (!urlAdmin || !segredo) {
  throw new Error('Defina DATABASE_URL_ADMIN e SESSAO_SEGREDO (o .env da raiz já traz).');
}
exigirBancoLocal(urlAdmin);

const conexao = abrirConexao(urlAdmin, { max: 4 });
// A pasta de arquivos pode ser trocada (ensaio em cópia do banco), para não mexer nos documentos reais.
const pastaDeArquivos = resolve(process.env.PASTA_ARMAZENAMENTO_DEMO ?? '.dados/armazenamento');
try {
  const sorteio = new Aleatorio();
  const agora = new Date();
  const relogio = new Relogio(agora, sorteio);

  const etapas = await conexao.bd
    .select({
      id: etapa.id,
      nome: etapa.nomeInterno,
      papel: etapa.papel,
      tipoId: tipoProcesso.id,
      tipo: tipoProcesso.tipo,
    })
    .from(etapa)
    .innerJoin(tipoProcesso, eq(tipoProcesso.id, etapa.tipoProcessoId));
  const doTipo = (tipo: string): Record<string, EtapaConhecida> =>
    Object.fromEntries(
      etapas.filter((e) => e.tipo === tipo).map((e) => [e.nome, { id: e.id, papel: e.papel }]),
    );
  const tipoId = (tipo: string) => etapas.find((e) => e.tipo === tipo)!.tipoId;

  console.log('1/8 Limpando os dados de uso (usuários, fluxos e configurações ficam)…');
  await limpar(conexao.bd, pastaDeArquivos);

  const ctx: Contexto = {
    bd: conexao.bd,
    sorteio,
    relogio,
    armazenamento: new ArmazenamentoEmDisco(pastaDeArquivos),
    segredoDaAplicacao: segredo,
    colegas: [],
    tipos: {
      demanda: tipoId('demanda'),
      tarefa: tipoId('tarefa'),
      projeto_lei: tipoId('projeto_lei'),
    },
    etapas: {
      demanda: doTipo('demanda'),
      tarefa: doTipo('tarefa'),
      projeto_lei: doTipo('projeto_lei'),
    },
    avisos: [],
    trilha: [],
    resumo: {},
  };

  console.log('2/8 Usuários…');
  await popularUsuarios(ctx, conexao.bd);
  console.log('3/8 Pessoas e consentimentos…');
  const pessoas = await popularPessoas(ctx);
  console.log('4/8 Demandas e histórico…');
  const demandas = await popularDemandas(ctx, pessoas);
  console.log('5/8 Comentários, novidades, e-mails e documentos…');
  await popularInteracoes(ctx, demandas);
  console.log('6/8 Tarefas…');
  await popularTarefas(ctx, demandas);
  console.log('6b/8 Corresponsáveis…');
  await popularCorresponsaveis(ctx);
  console.log('7/8 Agenda e eventos…');
  await popularAgenda(ctx, pessoas);
  console.log('7b/8 Beneficiários e projetos de lei…');
  await popularLegislativo(ctx);
  console.log('7c/8 Emendas parlamentares e CEAP…');
  await popularFinanceiro(ctx);
  console.log('8/8 Avisos e auditoria…');
  await gravarAvisosETrilha(ctx);

  console.log('\nPronto. Resumo do que foi criado:');
  for (const [categoria, quantidade] of Object.entries(ctx.resumo)) {
    console.log(`  ${String(quantidade).padStart(5)}  ${categoria}`);
  }
  console.log(`\nSenha das contas novas (demonstração): ${senhaDaDemonstracao}`);
  console.log('As contas antigas (@exemplo.test de exemplo) mantêm as senhas que já tinham.');
} finally {
  await conexao.encerrar();
}
