import type postgres from 'postgres';
import { afterEach, beforeEach, describe, expect, inject, it } from 'vitest';
import { criarBancoDeTeste, type BancoDeTeste } from '../teste/auxiliares.js';

let banco: BancoDeTeste;
let api: postgres.Sql;
let usuarioId: number;
let beneficiarioId: number;

beforeEach(async () => {
  banco = await criarBancoDeTeste(inject('urlAdminDeTeste'));
  api = banco.conectar('api').cliente;
  const [conta] = await api<{ id: number }[]>`
    INSERT INTO conta_acesso (email, verificador_senha) VALUES ('a@exemplo.test', 'h') RETURNING id`;
  const [u] = await api<{ id: number }[]>`
    INSERT INTO usuario (conta_id, nome, perfil) VALUES (${conta!.id}, 'A', 'administrador') RETURNING id`;
  usuarioId = Number(u!.id);
  const [b] = await api<{ id: number }[]>`
    INSERT INTO beneficiario (nome_fantasia, razao_social, cnpj, cep, logradouro, numero, bairro, cidade,
                              estado, natureza, criado_por)
    VALUES ('Prefeitura', 'Município', '11222333000181', '74015030', 'Rua A', '1', 'Centro', 'Goiânia',
            'GO', 'municipio', ${usuarioId}) RETURNING id`;
  beneficiarioId = Number(b!.id);
});

afterEach(async () => {
  await banco.encerrar();
});

const etapaDeEmenda = async (papel: string) => {
  const [e] = await api<{ id: number }[]>`
    SELECT e.id FROM etapa e JOIN tipo_processo t ON t.id = e.tipo_processo_id
    WHERE t.tipo = 'emenda' AND e.papel = ${papel} ORDER BY e.ordem LIMIT 1`;
  return Number(e!.id);
};

async function novaEmenda(valor = '100000.00', identificacao = 'EMD-001') {
  const [tipo] = await api<
    { id: number }[]
  >`SELECT id FROM categoria WHERE natureza = 'tipo_emenda' ORDER BY id LIMIT 1`;
  const [e] = await api<{ id: number }[]>`
    INSERT INTO emenda (criador_id, responsavel_id, identificacao, exercicio, tipo_id, finalidade, etapa_atual_id)
    VALUES (${usuarioId}, ${usuarioId}, ${identificacao}, 2026, ${tipo!.id}, 'Saúde', ${await etapaDeEmenda('entrada')})
    RETURNING id`;
  await api`INSERT INTO emenda_valor (emenda_id, valor, definido_por) VALUES (${e!.id}, ${valor}, ${usuarioId})`;
  return Number(e!.id);
}

async function destinar(emendaId: number, valor: string) {
  const [d] = await api<{ id: number }[]>`
    INSERT INTO destinacao (emenda_id, beneficiario_id, valor, finalidade, etapa_atual_id, criada_por)
    VALUES (${emendaId}, ${beneficiarioId}, ${valor}, 'Ambulância', ${await etapaDeEmenda('entrada')}, ${usuarioId})
    RETURNING id`;
  return Number(d!.id);
}

describe('valores da emenda', () => {
  it('o valor é positivo, o exercício fica entre 2000 e 2100 e a identificação não repete no exercício', async () => {
    const id = await novaEmenda();
    await expect(
      api`INSERT INTO emenda_valor (emenda_id, valor, definido_por) VALUES (${id}, 0, ${usuarioId})`,
    ).rejects.toThrow(/emenda_valor_positivo/);
    await expect(novaEmenda('10.00', 'emd-001')).rejects.toThrow(/emenda_identificacao_unica/);
    await expect(api`UPDATE emenda SET exercicio = 1999 WHERE id = ${id}`).rejects.toThrow(
      /emenda_exercicio_valido/,
    );
  });

  it('o histórico do valor só acrescenta, e o atual é o mais recente', async () => {
    const id = await novaEmenda('100000.00');
    await api`INSERT INTO emenda_valor (emenda_id, valor, definido_por) VALUES (${id}, 150000, ${usuarioId})`;
    const [linha] = await api<{ atual: string }[]>`SELECT emenda_valor_atual(${id})::text AS atual`;
    expect(linha!.atual).toBe('150000.00');
    await expect(api`UPDATE emenda_valor SET valor = 1`).rejects.toThrow(
      /permission denied|só acrescenta/,
    );
    await expect(api`DELETE FROM emenda_valor`).rejects.toThrow(/permission denied|só acrescenta/);
  });
});

describe('destinações', () => {
  it('a soma das destinações não passa do disponível; cancelar devolve o valor', async () => {
    const id = await novaEmenda('100000.00');
    const primeira = await destinar(id, '75000.00');
    await expect(destinar(id, '25000.01')).rejects.toThrow(/excede o valor disponível/);
    await destinar(id, '25000.00');
    await api`UPDATE destinacao SET cancelada_em = now(), cancelada_por = ${usuarioId},
              justificativa_cancelamento = 'Beneficiário desistiu do projeto' WHERE id = ${primeira}`;
    await expect(destinar(id, '75000.00')).resolves.toBeGreaterThan(primeira);
  });

  it('o valor da emenda não fica abaixo do comprometido', async () => {
    const id = await novaEmenda('100000.00');
    await destinar(id, '60000.00');
    await expect(
      api`INSERT INTO emenda_valor (emenda_id, valor, definido_por) VALUES (${id}, 59999.99, ${usuarioId})`,
    ).rejects.toThrow(/excede o valor disponível/);
    await expect(
      api`INSERT INTO emenda_valor (emenda_id, valor, definido_por) VALUES (${id}, 60000.00, ${usuarioId})`,
    ).resolves.toBeDefined();
  });

  it('o valor e o beneficiário da destinação não mudam', async () => {
    const id = await novaEmenda();
    const d = await destinar(id, '1000.00');
    await expect(api`UPDATE destinacao SET valor = 2000 WHERE id = ${d}`).rejects.toThrow(
      /não mudam/,
    );
  });
});

describe('execuções', () => {
  it('não excedem a destinação, nem têm data futura; só acrescentam', async () => {
    const id = await novaEmenda();
    const d = await destinar(id, '1000.00');
    await api`INSERT INTO execucao_destinacao (destinacao_id, valor, data, registrado_por)
              VALUES (${d}, 600, '2026-01-10', ${usuarioId})`;
    await expect(
      api`INSERT INTO execucao_destinacao (destinacao_id, valor, data, registrado_por)
          VALUES (${d}, 400.01, '2026-01-11', ${usuarioId})`,
    ).rejects.toThrow(/excede o valor da destinação/);
    await expect(
      api`INSERT INTO execucao_destinacao (destinacao_id, valor, data, registrado_por)
          VALUES (${d}, 100, '2999-01-01', ${usuarioId})`,
    ).rejects.toThrow(/não pode ser futura/);
    await expect(api`DELETE FROM execucao_destinacao`).rejects.toThrow(
      /permission denied|só acrescenta/,
    );
  });

  it('destinação com execução não se cancela, e a cancelada não recebe execução', async () => {
    const id = await novaEmenda();
    const comExecucao = await destinar(id, '1000.00');
    await api`INSERT INTO execucao_destinacao (destinacao_id, valor, data, registrado_por)
              VALUES (${comExecucao}, 100, '2026-01-10', ${usuarioId})`;
    await expect(
      api`UPDATE destinacao SET cancelada_em = now(), cancelada_por = ${usuarioId},
          justificativa_cancelamento = 'Tentativa de cancelar' WHERE id = ${comExecucao}`,
    ).rejects.toThrow(/execução registrada não se cancela/);

    const livre = await destinar(id, '500.00');
    await api`UPDATE destinacao SET cancelada_em = now(), cancelada_por = ${usuarioId},
              justificativa_cancelamento = 'Cancelada antes de executar' WHERE id = ${livre}`;
    await expect(
      api`INSERT INTO execucao_destinacao (destinacao_id, valor, data, registrado_por)
          VALUES (${livre}, 10, '2026-01-10', ${usuarioId})`,
    ).rejects.toThrow(/cancelada não recebe execução/);
  });
});

describe('emenda cancelada e permissões', () => {
  it('a emenda cancelada não se altera, e libera a identificação', async () => {
    const id = await novaEmenda();
    await api`UPDATE emenda SET cancelada_em = now(), cancelada_por = ${usuarioId},
              justificativa_cancelamento = 'Lançada em duplicidade' WHERE id = ${id}`;
    await expect(api`UPDATE emenda SET finalidade = 'Outra' WHERE id = ${id}`).rejects.toThrow(
      /Emenda cancelada não se altera/,
    );
    await expect(novaEmenda('10.00', 'EMD-001')).resolves.toBeGreaterThan(id);
  });

  it('o worker e a área pública não alcançam nada das emendas', async () => {
    for (const papel of ['worker', 'publico'] as const) {
      const sql = banco.conectar(papel).cliente;
      for (const tabela of ['emenda', 'emenda_valor', 'destinacao', 'execucao_destinacao']) {
        await expect(sql.unsafe(`SELECT 1 FROM ${tabela}`)).rejects.toThrow(/permission denied/);
      }
    }
  });
});
