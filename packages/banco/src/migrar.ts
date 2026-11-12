import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { papeisDeAplicacao } from './papeis.js';

export const pastaDeMigracoes = fileURLToPath(new URL('../migracoes/', import.meta.url));

export class ErroDeMigracao extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'ErroDeMigracao';
  }
}

export interface ResultadoDaMigracao {
  readonly aplicadas: readonly string[];
  readonly jaAplicadas: readonly string[];
}

const checksum = (conteudo: string) => createHash('sha256').update(conteudo).digest('hex');

/**
 * Aplica as migrações SQL em ordem, cada uma em sua própria transação.
 * - Migração já aplicada não pode ser editada: o checksum é conferido.
 * - Exige que os papéis de aplicação existam (comando `papeis`).
 * - Usa trava consultiva para que duas execuções não rodem ao mesmo tempo.
 */
export async function migrar(
  urlDeMigracao: string,
  pasta: string = pastaDeMigracoes,
): Promise<ResultadoDaMigracao> {
  const arquivos = (await readdir(pasta)).filter((nome) => nome.endsWith('.sql')).sort();
  const sql = postgres(urlDeMigracao, { max: 1, onnotice: () => undefined });

  try {
    await exigirPapeis(sql);
    await sql`SELECT pg_advisory_lock(hashtext('gabinete_migracao'))`;

    try {
      await sql`
        CREATE TABLE IF NOT EXISTS migracao_aplicada (
          nome text PRIMARY KEY,
          checksum text NOT NULL,
          aplicada_em timestamptz NOT NULL DEFAULT now()
        )`;

      const registradas = new Map(
        (
          await sql<
            { nome: string; checksum: string }[]
          >`SELECT nome, checksum FROM migracao_aplicada`
        ).map((linha) => [linha.nome, linha.checksum] as const),
      );

      const aplicadas: string[] = [];
      const jaAplicadas: string[] = [];

      for (const nome of arquivos) {
        const conteudo = await readFile(join(pasta, nome), 'utf8');
        const soma = checksum(conteudo);
        const anterior = registradas.get(nome);

        if (anterior !== undefined) {
          if (anterior !== soma) {
            throw new ErroDeMigracao(
              `A migração ${nome} já foi aplicada e foi editada depois. Crie uma nova migração em vez de editar.`,
            );
          }
          jaAplicadas.push(nome);
          continue;
        }

        await sql.begin(async (tx) => {
          await tx.unsafe(conteudo);
          await tx`INSERT INTO migracao_aplicada (nome, checksum) VALUES (${nome}, ${soma})`;
        });
        aplicadas.push(nome);
      }

      return { aplicadas, jaAplicadas };
    } finally {
      await sql`SELECT pg_advisory_unlock(hashtext('gabinete_migracao'))`;
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function exigirPapeis(sql: postgres.Sql): Promise<void> {
  const nomes = Object.values(papeisDeAplicacao);
  const existentes = await sql<{ rolname: string }[]>`
    SELECT rolname FROM pg_roles WHERE rolname IN ${sql(nomes)}`;
  const faltando = nomes.filter((nome) => !existentes.some((r) => r.rolname === nome));
  if (faltando.length > 0) {
    throw new ErroDeMigracao(
      `Faltam papéis de banco: ${faltando.join(', ')}. Rode o comando de papéis antes de migrar (npm run banco:papeis).`,
    );
  }
}
