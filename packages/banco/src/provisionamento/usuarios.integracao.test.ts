import { count, eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, inject, it } from 'vitest';
import type { Conexao } from '../conexao.js';
import { contaAcesso, habilitacao, senhaInicial, trilha, usuario } from '../esquema/index.js';
import { conferirSenha } from '../senha.js';
import { criarBancoDeTeste, type BancoDeTeste } from '../teste/auxiliares.js';
import { registrarTrilha } from '../trilha.js';
import { ErroDeSemeadura, semear } from './semear.js';
import { criarUsuarioPorComando } from './usuarios.js';

describe('provisionamento de usuários', () => {
  let banco: BancoDeTeste;
  let conexao: Conexao;

  // Cada teste ganha um banco novo e vazio (a trilha é imutável: não dá para "limpar").
  beforeEach(async () => {
    banco = await criarBancoDeTeste(inject('urlAdminDeTeste'));
    conexao = banco.conectar('api');
  });

  afterEach(async () => {
    await banco.encerrar();
  });

  it('cria o administrador com conta, habilitações, senha inicial e trilha, sem gravar a senha em claro', async () => {
    const criado = await conexao.bd.transaction((tx) =>
      criarUsuarioPorComando(tx, {
        email: '  Admin@Exemplo.test ',
        nome: ' Administrador ',
        perfil: 'administrador',
      }),
    );

    expect(criado.email).toBe('admin@exemplo.test');
    expect(criado.senhaInicial).toHaveLength(20);

    const [conta] = await conexao.bd
      .select()
      .from(contaAcesso)
      .where(eq(contaAcesso.email, 'admin@exemplo.test'));
    expect(conta?.verificadorSenha.startsWith('$argon2id$')).toBe(true);
    expect(conta?.senhaTrocaObrigatoria).toBe(true);
    expect(await conferirSenha(conta!.verificadorSenha, criado.senhaInicial)).toBe(true);

    const [u] = await conexao.bd.select().from(usuario).where(eq(usuario.id, criado.usuarioId));
    expect(u).toMatchObject({ nome: 'Administrador', perfil: 'administrador', situacao: 'ativo' });

    const areas = await conexao.bd
      .select()
      .from(habilitacao)
      .where(eq(habilitacao.usuarioId, criado.usuarioId));
    expect(areas.map((a) => a.area).sort()).toEqual(['AG', 'AT', 'FI', 'LG']);

    const [inicial] = await conexao.bd
      .select()
      .from(senhaInicial)
      .where(eq(senhaInicial.usuarioId, criado.usuarioId));
    expect(inicial?.usadaEm).toBeNull();
    expect(inicial!.expiraEm.getTime()).toBeGreaterThan(Date.now() + 71 * 3_600_000);

    const [entrada] = await conexao.bd
      .select()
      .from(trilha)
      .where(eq(trilha.registroId, String(criado.usuarioId)));
    expect(entrada).toMatchObject({
      origem: 'comando',
      operacao: 'usuario.criar',
      entidade: 'usuario',
    });
    expect(JSON.stringify(entrada)).not.toContain(criado.senhaInicial);
  });

  it('desfaz tudo quando a gravação da trilha falha', async () => {
    const antes = await conexao.bd.select({ total: count() }).from(usuario);

    await expect(
      conexao.bd.transaction(async (tx) => {
        await criarUsuarioPorComando(tx, {
          email: 'a@exemplo.test',
          nome: 'A',
          perfil: 'administrador',
        });
        await registrarTrilha(tx, {
          origem: 'comando',
          operacao: 'x',
          entidade: 'x',
          valorNovo: { senha: 'vazou' },
        });
      }),
      // O Drizzle embrulha o erro do Postgres: a restrição violada fica em `cause`.
    ).rejects.toMatchObject({
      cause: { message: expect.stringMatching(/trilha_sem_segredo_novo/) as unknown },
    });

    const depois = await conexao.bd.select({ total: count() }).from(usuario);
    expect(depois[0]?.total).toBe(antes[0]?.total);
    const contas = await conexao.bd
      .select()
      .from(contaAcesso)
      .where(eq(contaAcesso.email, 'a@exemplo.test'));
    expect(contas).toHaveLength(0);
  });

  it('a semeadura cria um usuário de cada perfil e recusa rodar duas vezes', async () => {
    const criados = await semear(conexao.bd);

    expect(criados.map((c) => c.perfil).sort()).toEqual([
      'administrador',
      'assessor_externo',
      'assessor_interno',
      'chefe',
      'parlamentar',
      'supervisor',
    ]);
    expect(new Set(criados.map((c) => c.senhaInicial)).size).toBe(criados.length);

    const todas = await conexao.bd.select().from(habilitacao);
    const doParlamentar = todas.filter(
      (h) => h.usuarioId === criados.find((c) => c.perfil === 'parlamentar')?.usuarioId,
    );
    expect(doParlamentar).toHaveLength(4);

    await expect(semear(conexao.bd)).rejects.toThrow(ErroDeSemeadura);
  });
});
