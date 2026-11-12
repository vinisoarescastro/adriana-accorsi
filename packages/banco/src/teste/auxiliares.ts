import { randomBytes } from 'node:crypto';
import postgres from 'postgres';
import { abrirConexao, type Conexao } from '../conexao.js';
import { migrar } from '../migrar.js';
import { prepararBanco, type ChaveDePapel, type SenhasDosPapeis } from '../papeis.js';
import { papeisDeAplicacao } from '../papeis.js';

export const senhasDeTeste: SenhasDosPapeis = {
  migracao: 'senha-migracao-teste',
  api: 'senha-api-teste',
  worker: 'senha-worker-teste',
  publico: 'senha-publico-teste',
};

export interface BancoDeTeste {
  readonly nome: string;
  /** Superusuário do cluster, apontando para este banco. */
  readonly urlAdmin: string;
  urlDoPapel(papel: ChaveDePapel): string;
  /** Conexão com o papel indicado. Encerrada automaticamente em `encerrar()`. */
  conectar(papel: ChaveDePapel): Conexao;
  encerrar(): Promise<void>;
}

function comBanco(url: string, banco: string, usuario?: string, senha?: string): string {
  const endereco = new URL(url);
  endereco.pathname = `/${banco}`;
  if (usuario !== undefined && senha !== undefined) {
    endereco.username = usuario;
    endereco.password = senha;
  }
  return endereco.toString();
}

/**
 * Cria um banco novo e isolado, com os papéis preparados. Com `migracoes: true`
 * (padrão), aplica as migrações. Cada arquivo de teste deve chamar uma vez.
 */
export async function criarBancoDeTeste(
  urlAdminDoCluster: string,
  opcoes: { migracoes?: boolean; pastaDeMigracoes?: string } = {},
): Promise<BancoDeTeste> {
  const nome = `teste_${randomBytes(6).toString('hex')}`;

  const admin = postgres(urlAdminDoCluster, { max: 1, onnotice: () => undefined });
  await admin.unsafe(`CREATE DATABASE ${nome}`);
  await admin.end({ timeout: 5 });

  const urlAdmin = comBanco(urlAdminDoCluster, nome);
  await prepararBanco(urlAdmin);

  const urlDoPapel = (papel: ChaveDePapel) =>
    comBanco(urlAdminDoCluster, nome, papeisDeAplicacao[papel], senhasDeTeste[papel]);

  if (opcoes.migracoes ?? true) {
    await migrar(urlDoPapel('migracao'), opcoes.pastaDeMigracoes);
  }

  const abertas: Conexao[] = [];
  return {
    nome,
    urlAdmin,
    urlDoPapel,
    conectar(papel) {
      const conexao = abrirConexao(urlDoPapel(papel), { max: 2 });
      abertas.push(conexao);
      return conexao;
    },
    async encerrar() {
      await Promise.all(abertas.map((c) => c.encerrar()));
      const limpeza = postgres(urlAdminDoCluster, { max: 1, onnotice: () => undefined });
      await limpeza.unsafe(`DROP DATABASE IF EXISTS ${nome} WITH (FORCE)`);
      await limpeza.end({ timeout: 5 });
    },
  };
}
