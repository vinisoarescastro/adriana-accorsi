import { copyFile, mkdtemp, readdir, rm, writeFile, appendFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, inject, it } from 'vitest';
import { ErroDeMigracao, migrar, pastaDeMigracoes } from './migrar.js';
import { criarBancoDeTeste, type BancoDeTeste } from './teste/auxiliares.js';

describe('migrar', () => {
  let banco: BancoDeTeste | undefined;
  let pastaTemporaria: string | undefined;

  afterEach(async () => {
    await banco?.encerrar();
    if (pastaTemporaria) await rm(pastaTemporaria, { recursive: true, force: true });
    banco = undefined;
    pastaTemporaria = undefined;
  });

  it('aplica todas as migrações e é idempotente', async () => {
    banco = await criarBancoDeTeste(inject('urlAdminDeTeste'), { migracoes: false });
    const arquivos = (await readdir(pastaDeMigracoes)).filter((n) => n.endsWith('.sql')).sort();

    const primeira = await migrar(banco.urlDoPapel('migracao'));
    expect(primeira.aplicadas).toEqual(arquivos);
    expect(primeira.jaAplicadas).toEqual([]);

    const segunda = await migrar(banco.urlDoPapel('migracao'));
    expect(segunda.aplicadas).toEqual([]);
    expect(segunda.jaAplicadas).toEqual(arquivos);
  });

  it('recusa migração já aplicada que foi editada depois', async () => {
    banco = await criarBancoDeTeste(inject('urlAdminDeTeste'), { migracoes: false });
    pastaTemporaria = await mkdtemp(join(tmpdir(), 'migracoes-'));
    await copyFile(
      join(pastaDeMigracoes, '0001-acesso-e-gabinete.sql'),
      join(pastaTemporaria, '0001-acesso-e-gabinete.sql'),
    );

    await migrar(banco.urlDoPapel('migracao'), pastaTemporaria);
    await appendFile(join(pastaTemporaria, '0001-acesso-e-gabinete.sql'), '\n-- editada\n');

    await expect(migrar(banco.urlDoPapel('migracao'), pastaTemporaria)).rejects.toThrow(
      ErroDeMigracao,
    );
  });

  it('desfaz a migração inteira se um comando falhar', async () => {
    banco = await criarBancoDeTeste(inject('urlAdminDeTeste'), { migracoes: false });
    pastaTemporaria = await mkdtemp(join(tmpdir(), 'migracoes-'));
    await writeFile(
      join(pastaTemporaria, '0001-quebrada.sql'),
      'CREATE TABLE a (id int); CREATE TABLE a (id int);',
    );

    await expect(migrar(banco.urlDoPapel('migracao'), pastaTemporaria)).rejects.toThrow();

    const conexao = banco.conectar('migracao');
    const [r] = await conexao.cliente<
      { existe: string | null }[]
    >`SELECT to_regclass('public.a') AS existe`;
    expect(r?.existe).toBeNull();
  });
});
