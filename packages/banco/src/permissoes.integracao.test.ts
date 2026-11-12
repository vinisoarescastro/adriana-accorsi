import type postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { criarBancoDeTeste, type BancoDeTeste } from './teste/auxiliares.js';

describe('permissões dos papéis de banco', () => {
  let banco: BancoDeTeste;
  let api: postgres.Sql;
  let worker: postgres.Sql;
  let publico: postgres.Sql;

  beforeAll(async () => {
    banco = await criarBancoDeTeste(inject('urlAdminDeTeste'));
    api = banco.conectar('api').cliente;
    worker = banco.conectar('worker').cliente;
    publico = banco.conectar('publico').cliente;
  });

  afterAll(async () => {
    await banco.encerrar();
  });

  it('a API acrescenta à trilha, mas não altera nem apaga (nem por TRUNCATE)', async () => {
    await api`INSERT INTO trilha (origem, operacao, entidade) VALUES ('comando', 'teste', 'teste')`;
    await expect(api`UPDATE trilha SET operacao = 'x'`).rejects.toThrow(/permission denied/);
    await expect(api`DELETE FROM trilha`).rejects.toThrow(/permission denied/);
    await expect(api`TRUNCATE trilha`).rejects.toThrow(/permission denied/);
  });

  it('nenhum papel de execução cria objetos nem apaga tabelas', async () => {
    for (const sql of [api, worker, publico]) {
      await expect(sql`CREATE TABLE intruso (id int)`).rejects.toThrow(/permission denied/);
    }
    await expect(api`DROP TABLE usuario`).rejects.toThrow(/must be owner/);
  });

  it('o worker e o público ainda não leem nem escrevem em tabela alguma', async () => {
    for (const sql of [worker, publico]) {
      await expect(sql`SELECT 1 FROM conta_acesso`).rejects.toThrow(/permission denied/);
      await expect(sql`SELECT 1 FROM trilha`).rejects.toThrow(/permission denied/);
      await expect(
        sql`INSERT INTO trilha (origem, operacao, entidade) VALUES ('publico', 'x', 'x')`,
      ).rejects.toThrow(/permission denied/);
    }
  });

  it('a API não enxerga a tabela de controle das migrações', async () => {
    await expect(api`SELECT 1 FROM migracao_aplicada`).rejects.toThrow(/permission denied/);
  });

  it('só os papéis de aplicação conectam ao banco', async () => {
    const [r] = await api<{ conecta: boolean }[]>`
      SELECT has_database_privilege('public', current_database(), 'CONNECT') AS conecta`;
    // PUBLIC é a pseudo-role de "todos": o nome é aceito e o privilégio foi revogado.
    expect(r?.conecta).toBe(false);
  });
});
