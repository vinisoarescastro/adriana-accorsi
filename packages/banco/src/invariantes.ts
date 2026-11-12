import type postgres from 'postgres';
import { papeisDeAplicacao } from './papeis.js';

/**
 * Verificações de subida (docs/arquitetura/modelo-de-dados.md, item 17).
 * O processo da aplicação não sobe se alguma falhar. Novos invariantes entram
 * junto com as tabelas que os motivam, nas fases seguintes.
 */

export interface ResultadoDeInvariante {
  readonly id: number;
  readonly descricao: string;
  readonly ok: boolean;
  readonly detalhe?: string;
}

/** Tabelas em que cada papel pode escrever. Cresce fase a fase, de forma declarada. */
export const escritaPermitida = {
  worker: [] as readonly string[],
  publico: [] as readonly string[],
};

const papeisSemPrivilegio = [
  papeisDeAplicacao.migracao,
  papeisDeAplicacao.api,
  papeisDeAplicacao.worker,
  papeisDeAplicacao.publico,
];

const papeisDeExecucao = [
  papeisDeAplicacao.api,
  papeisDeAplicacao.worker,
  papeisDeAplicacao.publico,
];

type Verificacao = (sql: postgres.Sql) => Promise<string[]>;

/** Cada verificação devolve a lista de problemas; vazia significa que passou. */
const verificacoes: ReadonlyArray<{ id: number; descricao: string; verificar: Verificacao }> = [
  {
    id: 1,
    descricao: 'Nenhum papel de execução é dono de tabela',
    verificar: async (sql) => {
      const donas = await sql<{ tablename: string; tableowner: string }[]>`
        SELECT tablename, tableowner FROM pg_tables
        WHERE schemaname = 'public' AND tableowner IN ${sql(papeisDeExecucao)}`;
      return donas.map((d) => `${d.tableowner} é dono de ${d.tablename}`);
    },
  },
  {
    id: 2,
    descricao: 'Os papéis não são superusuário nem ignoram segurança, nem criam bancos ou papéis',
    verificar: async (sql) => {
      const perigosos = await sql<{ rolname: string }[]>`
        SELECT rolname FROM pg_roles
        WHERE rolname IN ${sql(papeisSemPrivilegio)}
          AND (rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb OR rolreplication)`;
      return perigosos.map((p) => `${p.rolname} tem privilégio elevado`);
    },
  },
  {
    id: 3,
    descricao: 'A trilha tem os gatilhos de imutabilidade ativos',
    verificar: async (sql) => {
      const ativos = await sql<{ tgname: string }[]>`
        SELECT tgname FROM pg_trigger
        WHERE tgrelid = to_regclass('public.trilha') AND NOT tgisinternal AND tgenabled = 'O'`;
      const nomes = ativos.map((a) => a.tgname);
      return ['trilha_imutavel_linha', 'trilha_imutavel_truncate']
        .filter((esperado) => !nomes.includes(esperado))
        .map((faltando) => `gatilho ${faltando} ausente ou desativado`);
    },
  },
  {
    id: 4,
    descricao: 'O gatilho que impede ficar sem administrador está ativo',
    verificar: async (sql) => {
      const ativos = await sql`
        SELECT 1 FROM pg_trigger
        WHERE tgrelid = to_regclass('public.usuario')
          AND tgname = 'usuario_administrador_obrigatorio' AND tgenabled = 'O'`;
      return ativos.length > 0 ? [] : ['gatilho usuario_administrador_obrigatorio ausente'];
    },
  },
  {
    id: 5,
    descricao: 'Nenhuma coluna armazena saldo (saldos são derivados)',
    verificar: async (sql) => {
      // Usa o catálogo (pg_attribute), e não information_schema: este só mostra colunas
      // de tabelas que o papel atual pode acessar, e a verificação não pode depender disso.
      const colunas = await sql<{ tabela: string; coluna: string }[]>`
        SELECT c.relname AS tabela, a.attname AS coluna
        FROM pg_attribute a
        JOIN pg_class c ON c.oid = a.attrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
          AND a.attnum > 0 AND NOT a.attisdropped
          AND a.attname ~ '^(saldo|valor_(comprometido|utilizado|disponivel|a_executar|em_analise))'`;
      return colunas.map((c) => `${c.tabela}.${c.coluna}`);
    },
  },
  {
    id: 6,
    descricao: 'Nenhum papel de execução altera ou apaga a trilha',
    verificar: async (sql) => {
      const problemas: string[] = [];
      for (const papel of papeisDeExecucao) {
        for (const privilegio of ['UPDATE', 'DELETE', 'TRUNCATE']) {
          const [r] = await sql<{ tem: boolean }[]>`
            SELECT has_table_privilege(${papel}, 'public.trilha', ${privilegio}) AS tem`;
          if (r?.tem) problemas.push(`${papel} tem ${privilegio} na trilha`);
        }
      }
      return problemas;
    },
  },
  {
    id: 7,
    descricao: 'Worker e público só escrevem onde está declarado',
    verificar: async (sql) => {
      const problemas: string[] = [];
      const pares = [
        [papeisDeAplicacao.worker, escritaPermitida.worker],
        [papeisDeAplicacao.publico, escritaPermitida.publico],
      ] as const;
      for (const [papel, permitidas] of pares) {
        const tabelas = await sql<{ relname: string }[]>`
          SELECT c.relname FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
            AND (has_table_privilege(${papel}, c.oid, 'INSERT')
              OR has_table_privilege(${papel}, c.oid, 'UPDATE')
              OR has_table_privilege(${papel}, c.oid, 'DELETE')
              OR has_table_privilege(${papel}, c.oid, 'TRUNCATE'))`;
        for (const t of tabelas) {
          if (!permitidas.includes(t.relname)) problemas.push(`${papel} escreve em ${t.relname}`);
        }
      }
      return problemas;
    },
  },
  {
    id: 8,
    descricao: 'Nenhum papel de execução cria objetos no esquema',
    verificar: async (sql) => {
      const problemas: string[] = [];
      for (const papel of papeisDeExecucao) {
        const [r] = await sql<{ tem: boolean }[]>`
          SELECT has_schema_privilege(${papel}, 'public', 'CREATE') AS tem`;
        if (r?.tem) problemas.push(`${papel} pode criar objetos`);
      }
      return problemas;
    },
  },
];

export async function verificarInvariantes(sql: postgres.Sql): Promise<ResultadoDeInvariante[]> {
  const resultados: ResultadoDeInvariante[] = [];
  for (const { id, descricao, verificar } of verificacoes) {
    const problemas = await verificar(sql);
    resultados.push(
      problemas.length === 0
        ? { id, descricao, ok: true }
        : { id, descricao, ok: false, detalhe: problemas.join('; ') },
    );
  }
  return resultados;
}

export class ErroDeInvariante extends Error {
  constructor(readonly falhas: readonly ResultadoDeInvariante[]) {
    super(
      `Invariantes de banco violados:\n${falhas
        .map((f) => `- (${f.id}) ${f.descricao}: ${f.detalhe ?? ''}`)
        .join('\n')}`,
    );
    this.name = 'ErroDeInvariante';
  }
}

/** Para a subida da aplicação: lança se algum invariante falhar. */
export async function exigirInvariantes(sql: postgres.Sql): Promise<void> {
  const falhas = (await verificarInvariantes(sql)).filter((r) => !r.ok);
  if (falhas.length > 0) throw new ErroDeInvariante(falhas);
}
