import { abrirConexao, exigirBancoLocal, usuario, habilitacao } from '@gabinete/banco';
import { resolve } from 'node:path';
import { ArmazenamentoEmDisco } from '../armazenamento/armazenamento.js';
import { Aleatorio, Relogio } from './aleatorio.js';
import { popularCorresponsaveis } from './corresponsaveis.js';
import type { Contexto } from './contexto.js';
import { gravarAvisos } from './gravar.js';

/**
 * Acrescenta corresponsáveis (e os avisos de quem foi incluído) a uma demonstração JÁ criada, sem
 * apagar nada. Só roda em banco local. Uso: `npm run demonstracao:corresponsaveis -w @gabinete/api`.
 */
const urlAdmin = process.env.DATABASE_URL_ADMIN;
if (!urlAdmin) throw new Error('Defina DATABASE_URL_ADMIN (o .env da raiz já traz).');
exigirBancoLocal(urlAdmin);

const conexao = abrirConexao(urlAdmin, { max: 2 });
try {
  const sorteio = new Aleatorio(77);
  const usuarios = await conexao.bd.select().from(usuario);
  const habs = await conexao.bd.select().from(habilitacao);
  const ctx: Contexto = {
    bd: conexao.bd,
    sorteio,
    relogio: new Relogio(new Date(), sorteio),
    armazenamento: new ArmazenamentoEmDisco(resolve('.dados/armazenamento')),
    segredoDaAplicacao: '',
    colegas: usuarios.map((u) => ({
      id: u.id,
      nome: u.nome,
      perfil: u.perfil,
      habilitacoes: habs.filter((h) => h.usuarioId === u.id).map((h) => h.area),
      ativo: u.situacao === 'ativo',
    })),
    tipos: { demanda: 0, tarefa: 0, projeto_lei: 0 },
    etapas: { demanda: {}, tarefa: {}, projeto_lei: {} },
    avisos: [],
    trilha: [],
    resumo: {},
  };
  await popularCorresponsaveis(ctx);
  await gravarAvisos(ctx);
  for (const [categoria, quantidade] of Object.entries(ctx.resumo)) {
    console.log(`  ${String(quantidade).padStart(5)}  ${categoria}`);
  }
} finally {
  await conexao.encerrar();
}
