import postgres from 'postgres';

/** Papéis de banco (ver docs/arquitetura/modelo-de-dados.md, item 16). */
export const papeisDeAplicacao = {
  migracao: 'app_migracao',
  api: 'app_api',
  worker: 'app_worker',
  publico: 'app_publico',
} as const;

export type ChaveDePapel = keyof typeof papeisDeAplicacao;

export type SenhasDosPapeis = Readonly<Record<ChaveDePapel, string>>;

export class ErroDePapeis extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'ErroDePapeis';
  }
}

/**
 * Extrai a senha de uma URL de conexão e confere que o usuário é o papel esperado.
 * Assim os papéis são provisionados com as mesmas credenciais que os processos usam.
 */
export function senhaDaUrl(url: string, papelEsperado: string): string {
  const endereco = new URL(url);
  const usuario = decodeURIComponent(endereco.username);
  if (usuario !== papelEsperado) {
    throw new ErroDePapeis(`A URL de conexão deveria usar o usuário ${papelEsperado}.`);
  }
  const senha = decodeURIComponent(endereco.password);
  if (senha.length < 8) {
    throw new ErroDePapeis(`A senha do papel ${papelEsperado} deve ter ao menos 8 caracteres.`);
  }
  return senha;
}

const opcoesDoPapel = 'LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS';

/**
 * Cria (ou atualiza a senha de) os papéis de aplicação. Operação do cluster,
 * feita com a conexão administrativa. É idempotente.
 */
export async function criarPapeis(urlAdmin: string, senhas: SenhasDosPapeis): Promise<void> {
  const sql = postgres(urlAdmin, { max: 1, onnotice: () => undefined });
  try {
    for (const [chave, nome] of Object.entries(papeisDeAplicacao)) {
      const senha = senhas[chave as ChaveDePapel];
      const [existente] = await sql`SELECT 1 AS existe FROM pg_roles WHERE rolname = ${nome}`;
      const modelo = existente
        ? `ALTER ROLE %I WITH ${opcoesDoPapel} PASSWORD %L`
        : `CREATE ROLE %I WITH ${opcoesDoPapel} PASSWORD %L`;
      // format() com %I e %L quota identificador e literal no servidor.
      const [comando] = await sql<
        { ddl: string }[]
      >`SELECT format(${modelo}::text, ${nome}::text, ${senha}::text) AS ddl`;
      await sql.unsafe(comando?.ddl ?? '');
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}

/**
 * Prepara o banco: só os papéis de aplicação conectam, e o esquema público
 * pertence ao papel de migração. Conectar-se ao banco de destino, como administrador.
 */
export async function prepararBanco(urlAdminDoBanco: string): Promise<void> {
  const sql = postgres(urlAdminDoBanco, { max: 1, onnotice: () => undefined });
  const nomes = Object.values(papeisDeAplicacao);
  try {
    const [{ banco } = { banco: '' }] = await sql<
      { banco: string }[]
    >`SELECT current_database() AS banco`;
    const alvo = sql(banco);
    await sql`REVOKE ALL ON DATABASE ${alvo} FROM PUBLIC`;
    for (const nome of nomes) {
      await sql`GRANT CONNECT ON DATABASE ${alvo} TO ${sql(nome)}`;
    }
    await sql`ALTER SCHEMA public OWNER TO ${sql(papeisDeAplicacao.migracao)}`;
    await sql`REVOKE ALL ON SCHEMA public FROM PUBLIC`;
  } finally {
    await sql.end({ timeout: 5 });
  }
}
