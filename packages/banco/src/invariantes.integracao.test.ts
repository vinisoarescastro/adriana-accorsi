import postgres from 'postgres';
import { afterEach, beforeEach, describe, expect, inject, it } from 'vitest';
import { ErroDeInvariante, exigirInvariantes, verificarInvariantes } from './invariantes.js';
import { criarBancoDeTeste, type BancoDeTeste } from './teste/auxiliares.js';

describe('invariantes de banco', () => {
  let banco: BancoDeTeste;
  let admin: postgres.Sql;

  beforeEach(async () => {
    banco = await criarBancoDeTeste(inject('urlAdminDeTeste'));
    admin = postgres(banco.urlAdmin, { max: 1, onnotice: () => undefined });
  });

  afterEach(async () => {
    await admin.end({ timeout: 5 });
    await banco.encerrar();
  });

  const falhasEm = async () =>
    (await verificarInvariantes(banco.conectar('api').cliente)).filter((r) => !r.ok);

  it('todos passam no banco recém-migrado', async () => {
    const resultados = await verificarInvariantes(banco.conectar('api').cliente);
    expect(resultados.length).toBeGreaterThanOrEqual(8);
    expect(resultados.filter((r) => !r.ok)).toEqual([]);
    await expect(exigirInvariantes(banco.conectar('api').cliente)).resolves.toBeUndefined();
  });

  it('detecta permissão de alteração da trilha concedida por engano', async () => {
    await admin.unsafe('GRANT UPDATE ON trilha TO app_api');
    const falhas = await falhasEm();
    expect(falhas.map((f) => f.id)).toContain(6);
    await expect(exigirInvariantes(banco.conectar('api').cliente)).rejects.toThrow(
      ErroDeInvariante,
    );
  });

  it('detecta escrita do worker ou do público fora da lista declarada', async () => {
    await admin.unsafe('GRANT INSERT ON usuario TO app_worker');
    await admin.unsafe('GRANT UPDATE ON gabinete TO app_publico');
    const falha = (await falhasEm()).find((f) => f.id === 7);
    expect(falha?.detalhe).toContain('app_worker escreve em usuario');
    expect(falha?.detalhe).toContain('app_publico escreve em gabinete');
  });

  it('detecta coluna de saldo armazenado', async () => {
    await admin.unsafe('CREATE TABLE conta_corrente (id int, saldo numeric)');
    const falha = (await falhasEm()).find((f) => f.id === 5);
    expect(falha?.detalhe).toContain('conta_corrente.saldo');
  });

  it('detecta gatilho desativado', async () => {
    await admin.unsafe('ALTER TABLE usuario DISABLE TRIGGER usuario_administrador_obrigatorio');
    await admin.unsafe('ALTER TABLE trilha DISABLE TRIGGER trilha_imutavel_linha');
    const ids = (await falhasEm()).map((f) => f.id);
    expect(ids).toContain(3);
    expect(ids).toContain(4);
  });

  it('detecta papel de execução dono de tabela ou com permissão de criar', async () => {
    await admin.unsafe('ALTER TABLE gabinete OWNER TO app_api');
    await admin.unsafe('GRANT CREATE ON SCHEMA public TO app_worker');
    const ids = (await falhasEm()).map((f) => f.id);
    expect(ids).toContain(1);
    expect(ids).toContain(8);
  });
});
