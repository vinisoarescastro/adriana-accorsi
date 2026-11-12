import { getTableConfig, PgTable } from 'drizzle-orm/pg-core';
import { is } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import * as esquema from './esquema/index.js';
import { criarBancoDeTeste, type BancoDeTeste } from './teste/auxiliares.js';

/**
 * As migrações SQL são a fonte da verdade; o esquema do Drizzle é escrito à mão.
 * Este teste impede que os dois divirjam.
 */
describe('esquema do Drizzle x banco migrado', () => {
  let banco: BancoDeTeste;

  beforeAll(async () => {
    banco = await criarBancoDeTeste(inject('urlAdminDeTeste'));
  });

  afterAll(async () => {
    await banco.encerrar();
  });

  const tabelasDoDrizzle = () =>
    (Object.values(esquema).filter((valor) => is(valor, PgTable)) as unknown as PgTable[]).map(
      (tabela) => getTableConfig(tabela),
    );

  it('toda tabela do banco está descrita no Drizzle, e vice-versa', async () => {
    const { cliente } = banco.conectar('api');
    const noBanco = await cliente<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        AND table_name <> 'migracao_aplicada'
      ORDER BY table_name`;

    expect(
      tabelasDoDrizzle()
        .map((t) => t.name)
        .sort(),
    ).toEqual(noBanco.map((t) => t.table_name));
  });

  it('as colunas e a obrigatoriedade batem, tabela a tabela', async () => {
    const { cliente } = banco.conectar('api');

    for (const tabela of tabelasDoDrizzle()) {
      const colunasDoBanco = await cliente<{ column_name: string; is_nullable: string }[]>`
        SELECT column_name, is_nullable FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = ${tabela.name}
        ORDER BY column_name`;

      const esperado = tabela.columns
        .map((c) => ({ nome: c.name, obrigatoria: c.notNull }))
        .sort((a, b) => a.nome.localeCompare(b.nome));
      const real = colunasDoBanco.map((c) => ({
        nome: c.column_name,
        obrigatoria: c.is_nullable === 'NO',
      }));

      expect(real, `tabela ${tabela.name}`).toEqual(esperado);
    }
  });
});
