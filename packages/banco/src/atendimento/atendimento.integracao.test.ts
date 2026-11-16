import type postgres from 'postgres';
import { afterEach, beforeEach, describe, expect, inject, it } from 'vitest';
import { criarBancoDeTeste, type BancoDeTeste } from '../teste/auxiliares.js';

let banco: BancoDeTeste;
let api: postgres.Sql;
let dono: postgres.Sql;
let usuarioId: number;
let etapaId: number;

beforeEach(async () => {
  banco = await criarBancoDeTeste(inject('urlAdminDeTeste'));
  api = banco.conectar('api').cliente;
  dono = banco.conectar('migracao').cliente;
  const [conta] = await api<{ id: number }[]>`
    INSERT INTO conta_acesso (email, verificador_senha) VALUES ('a@exemplo.test', 'h') RETURNING id`;
  const [u] = await api<{ id: number }[]>`
    INSERT INTO usuario (conta_id, nome, perfil) VALUES (${conta!.id}, 'A', 'administrador') RETURNING id`;
  usuarioId = Number(u!.id);
  const [e] = await api<{ id: number }[]>`
    SELECT e.id FROM etapa e JOIN tipo_processo t ON t.id = e.tipo_processo_id
    WHERE t.tipo = 'demanda' AND e.papel = 'entrada'`;
  etapaId = Number(e!.id);
});

afterEach(async () => {
  await banco.encerrar();
});

const novaPessoa = (telefone: string, situacao = 'ativa') =>
  api`INSERT INTO pessoa (nome_completo, telefone_normalizado, situacao) VALUES ('Maria', ${telefone}, ${situacao}) RETURNING id`;

let contadorDeTelefone = 0;
const telefoneNovo = () => `679${String((contadorDeTelefone += 1)).padStart(8, '0')}`;

async function novaDemanda(protocolo = 'K7M29PQ4XA3N', secret = 'segredo-1') {
  const [p] = await api<{ id: number }[]>`
    INSERT INTO pessoa (nome_completo, telefone_normalizado) VALUES ('Maria', ${telefoneNovo()}) RETURNING id`;
  await api`INSERT INTO protocolo_emitido (protocolo) VALUES (${protocolo})`;
  const [d] = await api<{ id: number }[]>`
    INSERT INTO demanda (protocolo, segredo_link_hash, segredo_link_cifrado, solicitante_id, responsavel_id, autor_id, titulo, etapa_atual_id)
    VALUES (${protocolo}, ${secret}, 'cifrado', ${p!.id}, ${usuarioId}, ${usuarioId}, 'Poda de árvore', ${etapaId}) RETURNING id`;
  return Number(d!.id);
}

describe('pessoa', () => {
  it('não há duas pessoas ATIVAS com o mesmo telefone, mas inativas e eliminadas não contam', async () => {
    await novaPessoa('67999990000');
    await expect(novaPessoa('67999990000')).rejects.toThrow(/pessoa_telefone_unico_ativas/);
    await expect(novaPessoa('67999990000', 'inativa')).resolves.toBeDefined();
    await expect(novaPessoa('67999990001')).resolves.toBeDefined();
  });

  it('exige nome e telefone válidos', async () => {
    await expect(
      api`INSERT INTO pessoa (nome_completo, telefone_normalizado) VALUES ('', '67999990000')`,
    ).rejects.toThrow(/pessoa_nome_obrigatorio/);
    await expect(api`INSERT INTO pessoa (nome_completo) VALUES ('Maria')`).rejects.toThrow(
      /pessoa_telefone_obrigatorio/,
    );
    await expect(
      api`INSERT INTO pessoa (nome_completo, telefone_normalizado) VALUES ('Maria', '123')`,
    ).rejects.toThrow(/pessoa_telefone_formato/);
  });

  it('eliminar dados esvazia tudo, e é irreversível', async () => {
    const [p] = await api<{ id: number }[]>`
      INSERT INTO pessoa (nome_completo, telefone_normalizado, email, contatos, endereco)
      VALUES ('Maria', '67999990000', 'm@x.test', 'c', 'e') RETURNING id`;
    // Eliminar sem esvaziar todos os campos é recusado.
    await expect(
      api`UPDATE pessoa SET situacao = 'dados_eliminados', nome_completo = NULL WHERE id = ${p!.id}`,
    ).rejects.toThrow(/pessoa_eliminada_sem_dados/);
    await api`UPDATE pessoa SET situacao = 'dados_eliminados', nome_completo = NULL, telefone_normalizado = NULL,
              email = NULL, contatos = NULL, endereco = NULL WHERE id = ${p!.id}`;
    await expect(
      api`UPDATE pessoa SET situacao = 'ativa', nome_completo = 'Volta', telefone_normalizado = '67999990000' WHERE id = ${p!.id}`,
    ).rejects.toThrow(/foram eliminados/);
  });
});

describe('protocolo', () => {
  it('só aceita 12 caracteres do alfabeto de 31 símbolos', async () => {
    for (const ruim of [
      'K7M29PQ4XA3',
      'K7M29PQ4XA3NN',
      'K7M29PQ4XA30',
      'K7M29PQ4XA3O',
      'K7M29PQ4XA3I',
      'K7M29PQ4XA3L',
      'k7m29pq4xa3n',
    ]) {
      await expect(
        api`INSERT INTO protocolo_emitido (protocolo) VALUES (${ruim})`,
        ruim,
      ).rejects.toThrow(/protocolo_formato/);
    }
  });

  it('é único, nunca muda e nunca é apagado (nem por quem é dono)', async () => {
    await api`INSERT INTO protocolo_emitido (protocolo) VALUES ('K7M29PQ4XA3N')`;
    await expect(
      api`INSERT INTO protocolo_emitido (protocolo) VALUES ('K7M29PQ4XA3N')`,
    ).rejects.toThrow(/protocolo_emitido_pkey/);
    await expect(dono`UPDATE protocolo_emitido SET protocolo = 'K7M29PQ4XA3P'`).rejects.toThrow(
      /só aceita acréscimos/,
    );
    await expect(dono`DELETE FROM protocolo_emitido`).rejects.toThrow(/só aceita acréscimos/);
    // Com demandas apontando para ele, o Postgres recusa o TRUNCATE antes do gatilho; sem elas, o gatilho recusa.
    await expect(dono`TRUNCATE protocolo_emitido`).rejects.toThrow(
      /só aceita acréscimos|cannot truncate/,
    );
  });
});

describe('demanda', () => {
  it('o protocolo da demanda é imutável, e o segredo do link é único', async () => {
    const id = await novaDemanda();
    await api`INSERT INTO protocolo_emitido (protocolo) VALUES ('A2B3C4D5E6F7')`;
    await expect(
      api`UPDATE demanda SET protocolo = 'A2B3C4D5E6F7' WHERE id = ${id}`,
    ).rejects.toThrow(/protocolo é imutável/);
    await expect(novaDemanda('Z2Z3Z4Z5Z6Z7', 'segredo-1')).rejects.toThrow(/segredo_link_hash/);
  });

  it('o protocolo continua imutável após o cancelamento (a demanda cancelada não se altera)', async () => {
    const id = await novaDemanda();
    await api`UPDATE demanda SET cancelada_em = now(), cancelada_por = ${usuarioId},
              justificativa_cancelamento = 'Pedido duplicado do cidadão' WHERE id = ${id}`;
    await expect(
      api`UPDATE demanda SET protocolo = 'A2B3C4D5E6F7' WHERE id = ${id}`,
    ).rejects.toThrow();
    await expect(api`UPDATE demanda SET titulo = 'Outro' WHERE id = ${id}`).rejects.toThrow(
      /Demanda cancelada não se altera/,
    );
    const [d] = await api<{ protocolo: string }[]>`SELECT protocolo FROM demanda WHERE id = ${id}`;
    expect(d?.protocolo).toBe('K7M29PQ4XA3N');
  });

  it('cancelar exige justificativa de 10 caracteres ou mais, e coerência entre os campos', async () => {
    const id = await novaDemanda();
    await expect(
      api`UPDATE demanda SET cancelada_em = now(), cancelada_por = ${usuarioId}, justificativa_cancelamento = 'curta' WHERE id = ${id}`,
    ).rejects.toThrow(/demanda_justificativa_minima/);
    await expect(api`UPDATE demanda SET cancelada_em = now() WHERE id = ${id}`).rejects.toThrow(
      /demanda_cancelamento_coerente/,
    );
  });

  it('não existe coluna de status e a prioridade é validada', async () => {
    const [c] = await api<{ total: string }[]>`
      SELECT count(*) AS total FROM information_schema.columns
      WHERE table_name = 'demanda' AND column_name ~ 'status|situacao'`;
    expect(Number(c?.total)).toBe(0);
    const id = await novaDemanda();
    await expect(api`UPDATE demanda SET prioridade = 'critica' WHERE id = ${id}`).rejects.toThrow(
      /demanda_prioridade_valida/,
    );
  });

  it('nada se apaga: não há DELETE para a API', async () => {
    const id = await novaDemanda();
    for (const tabela of [
      'demanda',
      'pessoa',
      'comentario_interno',
      'documento',
      'protocolo_emitido',
    ]) {
      await expect(api.unsafe(`DELETE FROM ${tabela}`), tabela).rejects.toThrow(
        /permission denied/,
      );
    }
    expect(id).toBeGreaterThan(0);
  });
});

describe('comentário interno', () => {
  const comentar = (demandaId: number, texto = 'Ligar para a prefeitura') =>
    api<
      { id: number }[]
    >`INSERT INTO comentario_interno (registro_tipo, registro_id, autor_id, texto)
                          VALUES ('demanda', ${demandaId}, ${usuarioId}, ${texto}) RETURNING id`;

  it('não se edita; só se remove, e remover não volta atrás', async () => {
    const demandaId = await novaDemanda();
    const [c] = await comentar(demandaId);
    await expect(
      api`UPDATE comentario_interno SET texto = 'outro' WHERE id = ${c!.id}`,
    ).rejects.toThrow(/não se edita/);
    await expect(
      api`UPDATE comentario_interno SET situacao = 'removido' WHERE id = ${c!.id}`,
    ).rejects.toThrow(/comentario_remocao_coerente/);
    await api`UPDATE comentario_interno SET situacao = 'removido', removido_por = ${usuarioId}, removido_em = now() WHERE id = ${c!.id}`;
    await expect(
      api`UPDATE comentario_interno SET situacao = 'ativo', removido_por = NULL, removido_em = NULL WHERE id = ${c!.id}`,
    ).rejects.toThrow(/não volta/);
  });

  it('as menções só se acrescentam', async () => {
    const [c] = await comentar(await novaDemanda());
    await api`INSERT INTO comentario_mencao (comentario_id, usuario_id) VALUES (${c!.id}, ${usuarioId})`;
    await expect(dono`UPDATE comentario_mencao SET usuario_id = usuario_id`).rejects.toThrow(
      /só aceita acréscimos/,
    );
  });
});

describe('documento', () => {
  const anexar = (
    demandaId: number,
    extra: { tipo?: string; varredura?: string; tamanho?: number; chave?: string } = {},
  ) =>
    api<{ id: number }[]>`
      INSERT INTO documento (registro_tipo, registro_id, nome, tipo_real, tamanho, chave_armazenamento, hash_sha256, varredura, autor_envio)
      VALUES ('demanda', ${demandaId}, 'nota.pdf', ${extra.tipo ?? 'application/pdf'}, ${extra.tamanho ?? 100},
              ${extra.chave ?? `chave-${Math.random()}`}, ${'a'.repeat(64)}, ${extra.varredura ?? 'limpo'}, ${usuarioId}) RETURNING id`;

  it('só entram os quatro tipos, até 25 MB, e nunca um arquivo marcado como infectado', async () => {
    const demandaId = await novaDemanda();
    await expect(anexar(demandaId, { tipo: 'application/x-msdownload' })).rejects.toThrow(
      /documento_tipo_valido/,
    );
    await expect(anexar(demandaId, { tamanho: 26214401 })).rejects.toThrow(
      /documento_tamanho_valido/,
    );
    await expect(anexar(demandaId, { tamanho: 0 })).rejects.toThrow(/documento_tamanho_valido/);
    await expect(anexar(demandaId, { varredura: 'infectado' })).rejects.toThrow(
      /documento_varredura_valida/,
    );
    await expect(anexar(demandaId, { tamanho: 26214400 })).resolves.toBeDefined();
  });

  it('o arquivo é imutável (só o nome e a natureza se corrigem), e o removido não volta', async () => {
    const [d] = await anexar(await novaDemanda());
    await api`UPDATE documento SET nome = 'outro.pdf', natureza = 'oficio' WHERE id = ${d!.id}`;
    await expect(
      api`UPDATE documento SET hash_sha256 = ${'b'.repeat(64)} WHERE id = ${d!.id}`,
    ).rejects.toThrow(/não se altera/);
    await expect(
      api`UPDATE documento SET chave_armazenamento = 'x' WHERE id = ${d!.id}`,
    ).rejects.toThrow(/não se altera/);
    await api`UPDATE documento SET situacao = 'removido', removido_por = ${usuarioId}, removido_em = now() WHERE id = ${d!.id}`;
    await expect(
      api`UPDATE documento SET situacao = 'ativo', removido_por = NULL, removido_em = NULL WHERE id = ${d!.id}`,
    ).rejects.toThrow(/não volta/);
  });

  it('a chave de armazenamento é única', async () => {
    const demandaId = await novaDemanda();
    await anexar(demandaId, { chave: 'mesma' });
    await expect(anexar(demandaId, { chave: 'mesma' })).rejects.toThrow(/chave_armazenamento/);
  });
});
