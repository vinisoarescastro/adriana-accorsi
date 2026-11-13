import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as esquema from './esquema/index.js';

export type BancoDeDados = ReturnType<typeof criarBanco>['bd'];

/** Transação do Drizzle: o que os serviços recebem para operar e gravar a trilha juntos. */
export type Transacao = Parameters<Parameters<BancoDeDados['transaction']>[0]>[0];

/** Quem só lê: o banco ou uma transação. */
export type Leitor = Pick<BancoDeDados, 'select'> | Pick<Transacao, 'select'>;

export interface Conexao {
  readonly bd: BancoDeDados;
  readonly cliente: postgres.Sql;
  encerrar(): Promise<void>;
}

function criarBanco(cliente: postgres.Sql) {
  return { bd: drizzle(cliente, { schema: esquema }) };
}

export function abrirConexao(url: string, opcoes: { max?: number } = {}): Conexao {
  const cliente = postgres(url, {
    max: opcoes.max ?? 10,
    onnotice: () => undefined,
    connection: { TimeZone: 'America/Sao_Paulo' },
  });
  return {
    ...criarBanco(cliente),
    cliente,
    encerrar: () => cliente.end({ timeout: 5 }),
  };
}
