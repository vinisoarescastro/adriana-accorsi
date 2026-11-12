import postgres from 'postgres';
import { afterEach, beforeEach, describe, expect, inject, it } from 'vitest';
import { criarBancoDeTeste, type BancoDeTeste } from './teste/auxiliares.js';

let banco: BancoDeTeste;
let api: postgres.Sql;

beforeEach(async () => {
  banco = await criarBancoDeTeste(inject('urlAdminDeTeste'));
  api = banco.conectar('api').cliente;
});

afterEach(async () => {
  await banco.encerrar();
});

/** Cria conta e usuário. Devolve o id do usuário. */
async function criarUsuario(
  sql: postgres.Sql | postgres.TransactionSql,
  email: string,
  perfil: string,
  situacao = 'ativo',
): Promise<number> {
  const [conta] = await sql<{ id: number }[]>`
    INSERT INTO conta_acesso (email, verificador_senha) VALUES (${email}, 'hash') RETURNING id`;
  const [usuario] = await sql<{ id: number }[]>`
    INSERT INTO usuario (conta_id, nome, perfil, situacao)
    VALUES (${conta!.id}, 'Nome', ${perfil}, ${situacao}) RETURNING id`;
  return usuario!.id;
}

describe('trilha imutável', () => {
  it('aceita acrescentar, mas recusa UPDATE, DELETE e TRUNCATE, até para o superusuário', async () => {
    await api`INSERT INTO trilha (origem, operacao, entidade) VALUES ('comando', 'teste', 'teste')`;

    // O gatilho vale até para quem tem privilégio total: usamos o superusuário do cluster.
    const root = postgres(banco.urlAdmin, { max: 1, onnotice: () => undefined });
    try {
      await expect(root`UPDATE trilha SET operacao = 'x'`).rejects.toThrow(/imutável/);
      await expect(root`DELETE FROM trilha`).rejects.toThrow(/imutável/);
      await expect(root`TRUNCATE trilha`).rejects.toThrow(/imutável/);
    } finally {
      await root.end({ timeout: 5 });
    }
  });

  it('recusa valores com chaves de senha ou segredo', async () => {
    const comSenha = JSON.stringify({ senha: 'x' });
    const comSegredo = JSON.stringify({ segredo_link: 'x' });
    await expect(
      api`INSERT INTO trilha (origem, operacao, entidade, valor_novo)
          VALUES ('comando', 'teste', 'teste', ${comSenha}::jsonb)`,
    ).rejects.toThrow(/trilha_sem_segredo_novo/);
    await expect(
      api`INSERT INTO trilha (origem, operacao, entidade, valor_anterior)
          VALUES ('comando', 'teste', 'teste', ${comSegredo}::jsonb)`,
    ).rejects.toThrow(/trilha_sem_segredo_anterior/);
  });

  it('recusa origem inválida', async () => {
    await expect(
      api`INSERT INTO trilha (origem, operacao, entidade) VALUES ('fantasma', 'teste', 'teste')`,
    ).rejects.toThrow(/trilha_origem_valida/);
  });
});

describe('sempre um administrador ativo', () => {
  it('recusa inserir o primeiro usuário se ele não for administrador', async () => {
    await expect(criarUsuario(api, 'a@exemplo.test', 'chefe')).rejects.toThrow(
      /sem um administrador ativo/,
    );
  });

  it('recusa inativar ou apagar o último administrador', async () => {
    const id = await criarUsuario(api, 'a@exemplo.test', 'administrador');

    await expect(api`UPDATE usuario SET situacao = 'inativo' WHERE id = ${id}`).rejects.toThrow(
      /sem um administrador ativo/,
    );
    await expect(api`UPDATE usuario SET perfil = 'chefe' WHERE id = ${id}`).rejects.toThrow(
      /sem um administrador ativo/,
    );
    // A API não tem DELETE em usuario. O dono do esquema tem: o gatilho vale mesmo assim.
    const dono = banco.conectar('migracao').cliente;
    await expect(dono`DELETE FROM usuario WHERE id = ${id}`).rejects.toThrow(
      /sem um administrador ativo/,
    );
    await expect(api`DELETE FROM usuario WHERE id = ${id}`).rejects.toThrow(/permission denied/);
  });

  it('permite trocar de administrador dentro de uma mesma transação', async () => {
    const primeiro = await criarUsuario(api, 'a@exemplo.test', 'administrador');

    await api.begin(async (tx) => {
      await criarUsuario(tx, 'b@exemplo.test', 'administrador');
      await tx`UPDATE usuario SET situacao = 'inativo' WHERE id = ${primeiro}`;
    });

    const [r] = await api<{ total: string }[]>`
      SELECT count(*) AS total FROM usuario WHERE perfil = 'administrador' AND situacao = 'ativo'`;
    expect(Number(r?.total)).toBe(1);
  });
});

describe('um único Parlamentar ativo', () => {
  it('recusa um segundo parlamentar ativo, mas aceita um inativo', async () => {
    await criarUsuario(api, 'adm@exemplo.test', 'administrador');
    await criarUsuario(api, 'p1@exemplo.test', 'parlamentar');

    await expect(criarUsuario(api, 'p2@exemplo.test', 'parlamentar')).rejects.toThrow(
      /usuario_um_parlamentar_ativo/,
    );
    await expect(
      criarUsuario(api, 'p3@exemplo.test', 'parlamentar', 'inativo'),
    ).resolves.toBeDefined();
  });
});

describe('restrições de dados', () => {
  it('a identidade do gabinete é uma linha única', async () => {
    await api`INSERT INTO gabinete (nome, parlamentar_nome, cargo) VALUES ('G', 'P', 'C')`;
    await expect(
      api`INSERT INTO gabinete (nome, parlamentar_nome, cargo) VALUES ('G2', 'P2', 'C2')`,
    ).rejects.toThrow(/gabinete_pkey/);
    await expect(
      api`INSERT INTO gabinete (id, nome, parlamentar_nome, cargo) VALUES (2, 'G', 'P', 'C')`,
    ).rejects.toThrow(/gabinete_linha_unica/);
  });

  it('e-mail precisa estar em minúsculas e ter formato válido, e ser único', async () => {
    await expect(
      api`INSERT INTO conta_acesso (email, verificador_senha) VALUES ('Maiuscula@exemplo.test', 'h')`,
    ).rejects.toThrow(/conta_acesso_email_minusculo/);
    await expect(
      api`INSERT INTO conta_acesso (email, verificador_senha) VALUES ('sem-arroba', 'h')`,
    ).rejects.toThrow(/conta_acesso_email_formato/);

    await api`INSERT INTO conta_acesso (email, verificador_senha) VALUES ('ok@exemplo.test', 'h')`;
    await expect(
      api`INSERT INTO conta_acesso (email, verificador_senha) VALUES ('ok@exemplo.test', 'h')`,
    ).rejects.toThrow(/conta_acesso_email_unico/);
  });

  it('o ticket de sessão só aceita hash hexadecimal de 64 caracteres', async () => {
    const id = await criarUsuario(api, 'a@exemplo.test', 'administrador');
    await expect(
      api`INSERT INTO sessao (ticket_hash, usuario_id, perfil, expira_em)
          VALUES ('ticket-em-claro', ${id}, 'administrador', now() + interval '1 hour')`,
    ).rejects.toThrow(/sessao_ticket_hash_formato/);

    await api`INSERT INTO sessao (ticket_hash, usuario_id, perfil, expira_em)
              VALUES (${'a'.repeat(64)}, ${id}, 'administrador', now() + interval '1 hour')`;
  });

  it('só existem os perfis e as áreas previstos', async () => {
    await criarUsuario(api, 'adm@exemplo.test', 'administrador');
    await expect(criarUsuario(api, 'x@exemplo.test', 'rei')).rejects.toThrow(
      /usuario_perfil_valido/,
    );

    const [u] = await api<{ id: number }[]>`SELECT id FROM usuario LIMIT 1`;
    await expect(
      api`INSERT INTO habilitacao (usuario_id, area) VALUES (${u!.id}, 'XX')`,
    ).rejects.toThrow(/habilitacao_area_valida/);
  });

  it('atualizado_em é preenchido pelo banco a cada alteração', async () => {
    const id = await criarUsuario(api, 'a@exemplo.test', 'administrador');
    // O Drizzle configura o cliente para devolver datas como texto; comparamos como Date.
    const instante = async () => {
      const [linha] = await api<
        { atualizado_em: string | Date }[]
      >`SELECT atualizado_em FROM usuario WHERE id = ${id}`;
      return new Date(linha!.atualizado_em).getTime();
    };
    const antes = await instante();
    await new Promise((r) => setTimeout(r, 20));
    await api`UPDATE usuario SET nome = 'Outro Nome' WHERE id = ${id}`;
    expect(await instante()).toBeGreaterThan(antes);
  });
});
