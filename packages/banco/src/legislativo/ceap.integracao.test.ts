import type postgres from 'postgres';
import { afterEach, beforeEach, describe, expect, inject, it } from 'vitest';
import { criarBancoDeTeste, type BancoDeTeste } from '../teste/auxiliares.js';

let banco: BancoDeTeste;
let api: postgres.Sql;
const ids: Record<string, number> = {};

beforeEach(async () => {
  banco = await criarBancoDeTeste(inject('urlAdminDeTeste'));
  api = banco.conectar('api').cliente;
  for (const [nome, perfil] of [
    ['admin', 'administrador'],
    ['chefe', 'chefe'],
    ['parlamentar', 'parlamentar'],
    ['supervisor', 'supervisor'],
    ['interno', 'assessor_interno'],
  ] as const) {
    const [conta] = await api<{ id: number }[]>`
      INSERT INTO conta_acesso (email, verificador_senha) VALUES (${`${nome}@exemplo.test`}, 'h') RETURNING id`;
    const [u] = await api<{ id: number }[]>`
      INSERT INTO usuario (conta_id, nome, perfil) VALUES (${conta!.id}, ${nome}, ${perfil}) RETURNING id`;
    ids[nome] = Number(u!.id);
  }
});

afterEach(async () => {
  await banco.encerrar();
});

const etapaDeDespesa = async (nome: string) => {
  const [e] = await api<{ id: number }[]>`
    SELECT e.id FROM etapa e JOIN tipo_processo t ON t.id = e.tipo_processo_id
    WHERE t.tipo = 'despesa_ceap' AND e.nome_interno = ${nome}`;
  return Number(e!.id);
};

async function novaDespesa(lancadoPor = 'interno', valor = '100.00', data = '2026-03-10') {
  const [c] = await api<{ id: number }[]>`SELECT id FROM ceap_categoria ORDER BY id LIMIT 1`;
  const [d] = await api<{ id: number }[]>`
    INSERT INTO despesa (categoria_id, responsavel_id, lancado_por, descricao, valor, data_documento,
                         fornecedor_nome, fornecedor_documento, numero_documento, etapa_atual_id)
    VALUES (${c!.id}, ${ids[lancadoPor]!}, ${ids[lancadoPor]!}, 'Passagem para Brasília', ${valor}, ${data},
            'Companhia Aérea', '11222333000181', 'NF-123', ${await etapaDeDespesa('Lançada')})
    RETURNING id`;
  return Number(d!.id);
}

const decidir = async (id: number, quem: string, proprio = false) => {
  const aprovada = await etapaDeDespesa('Aprovada');
  return api`UPDATE despesa SET decidido_por = ${ids[quem]!}, decidida_em = now(),
      decisao_pelo_proprio_lancador = ${proprio}, etapa_atual_id = ${aprovada} WHERE id = ${id}`;
};

describe('parâmetros com vigência', () => {
  const abrir = (chave: string, valor: string, de: string, ate: string | null) =>
    api`INSERT INTO ceap_parametro (chave, valor, vigente_de, vigente_ate, definido_por)
        VALUES (${chave}, ${valor}, ${de}, ${ate}, ${ids.admin!})`;

  it('duas vigências do mesmo parâmetro não se sobrepõem; parâmetros diferentes não se atrapalham', async () => {
    await abrir('cota_mensal', '1000.00', '2026-01-01', '2026-06-30');
    await expect(abrir('cota_mensal', '1100.00', '2026-06-30', null)).rejects.toThrow(
      /se sobrepõe/,
    );
    await abrir('cota_mensal', '1100.00', '2026-07-01', null);
    await expect(abrir('cota_mensal', '1200.00', '2027-01-01', null)).rejects.toThrow(
      /se sobrepõe/,
    );
    await expect(abrir('prazo_apresentacao_dias', '90', '2026-01-01', null)).resolves.toBeDefined();
  });

  it('o valor e o início não mudam, só se encerra a vigência; nada se apaga', async () => {
    await abrir('cota_mensal', '1000.00', '2026-01-01', null);
    await expect(api`UPDATE ceap_parametro SET valor = 5`).rejects.toThrow();
    await expect(api`UPDATE ceap_parametro SET vigente_ate = '2026-12-31'`).resolves.toBeDefined();
    await expect(api`DELETE FROM ceap_parametro`).rejects.toThrow(/permission denied|não se apaga/);
  });

  it('chave desconhecida e fim anterior ao início são recusados', async () => {
    await expect(abrir('outra', '1', '2026-01-01', null)).rejects.toThrow(
      /ceap_parametro_chave_valida/,
    );
    await expect(abrir('cota_mensal', '1', '2026-02-01', '2026-01-01')).rejects.toThrow(
      /ceap_parametro_vigencia_valida/,
    );
  });
});

describe('categorias', () => {
  it('traz a lista inicial proposta, sem nenhum valor em reais; a última ativa não se desativa', async () => {
    const lista = await api<
      { nome: string; teto_mensal: string | null }[]
    >`SELECT nome, teto_mensal FROM ceap_categoria`;
    expect(lista.length).toBeGreaterThanOrEqual(10);
    expect(lista.every((c) => c.teto_mensal === null)).toBe(true);
    const [contagem] = await api<
      { parametros: number }[]
    >`SELECT count(*)::int AS parametros FROM ceap_parametro`;
    expect(contagem!.parametros).toBe(0); // nenhuma cota semeada: vem da norma, cadastrada pelo Administrador

    await api`UPDATE ceap_categoria SET situacao = 'inativa' WHERE id NOT IN (SELECT id FROM ceap_categoria ORDER BY id LIMIT 1)`;
    await expect(api`UPDATE ceap_categoria SET situacao = 'inativa'`).rejects.toThrow(
      /última categoria ativa/,
    );
  });

  it('o nome é único sem diferenciar maiúsculas', async () => {
    await expect(api`INSERT INTO ceap_categoria (nome) VALUES ('TELEFONIA')`).rejects.toThrow(
      /ceap_categoria_nome_unico/,
    );
  });
});

describe('despesa', () => {
  it('valor positivo, fornecedor com CPF ou CNPJ só com os caracteres, e a competência vem da data do documento', async () => {
    const id = await novaDespesa('interno', '100.00', '2026-03-10');
    const [d] = await api<
      { competencia_ano: number; competencia_mes: number }[]
    >`SELECT * FROM despesa WHERE id = ${id}`;
    expect(d).toMatchObject({ competencia_ano: 2026, competencia_mes: 3 });
    await expect(api`UPDATE despesa SET valor = 0 WHERE id = ${id}`).rejects.toThrow(
      /despesa_valor_positivo/,
    );
    await expect(
      api`UPDATE despesa SET fornecedor_documento = '123' WHERE id = ${id}`,
    ).rejects.toThrow(/despesa_fornecedor_documento_valido/);
    await expect(
      api`UPDATE despesa SET fornecedor_documento = '52998224725' WHERE id = ${id}`,
    ).resolves.toBeDefined();
  });

  it('segregação: quem lança não decide, exceto Chefe, Administrador e Parlamentar, com a coincidência marcada', async () => {
    const interno = await novaDespesa('interno');
    await expect(decidir(interno, 'interno')).rejects.toThrow(/despesa_segregacao/);
    await expect(decidir(interno, 'interno', true)).rejects.toThrow(
      /Só Chefe, Administrador ou Parlamentar/,
    );
    await expect(decidir(interno, 'supervisor')).resolves.toBeDefined();

    const supervisor = await novaDespesa('supervisor');
    await expect(decidir(supervisor, 'supervisor')).rejects.toThrow(/despesa_segregacao/);
    await expect(decidir(supervisor, 'supervisor', true)).rejects.toThrow(
      /Só Chefe, Administrador ou Parlamentar/,
    );

    for (const quem of ['chefe', 'admin', 'parlamentar']) {
      const d = await novaDespesa(quem);
      await expect(decidir(d, quem), `${quem} sem marca`).rejects.toThrow(/despesa_segregacao/);
      await expect(decidir(d, quem, true), `${quem} com marca`).resolves.toBeDefined();
    }
  });

  it('a marca de coincidência só vale quando decisor e lançador são a mesma pessoa', async () => {
    const d = await novaDespesa('interno');
    await expect(decidir(d, 'supervisor', true)).rejects.toThrow(
      /despesa_marca_so_com_coincidencia|Só Chefe, Administrador ou Parlamentar/,
    );
  });

  it('despesa decidida não se edita nem muda a decisão; cancelada não se altera', async () => {
    const d = await novaDespesa('interno');
    await decidir(d, 'supervisor');
    await expect(api`UPDATE despesa SET valor = 1 WHERE id = ${d}`).rejects.toThrow(
      /Despesa decidida não se edita/,
    );
    await expect(
      api`UPDATE despesa SET decidido_por = ${ids.chefe!} WHERE id = ${d}`,
    ).rejects.toThrow(/Despesa decidida não se edita/);
    // O acompanhamento posterior (mudar de etapa) segue permitido.
    await expect(
      api`UPDATE despesa SET etapa_atual_id = ${await etapaDeDespesa('Apresentada à Câmara')} WHERE id = ${d}`,
    ).resolves.toBeDefined();

    const c = await novaDespesa('interno');
    await api`UPDATE despesa SET cancelada_em = now(), cancelada_por = ${ids.interno!},
              justificativa_cancelamento = 'Lançada em duplicidade' WHERE id = ${c}`;
    await expect(api`UPDATE despesa SET descricao = 'x' WHERE id = ${c}`).rejects.toThrow(
      /Despesa cancelada não se altera/,
    );
  });

  it('o motivo da reprovação tem ao menos 10 caracteres; não há coluna de saldo', async () => {
    const d = await novaDespesa('interno');
    await expect(
      api`UPDATE despesa SET motivo_reprovacao = 'curto' WHERE id = ${d}`,
    ).rejects.toThrow(/despesa_motivo_minimo/);
    const colunas = await api<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns WHERE table_name IN ('despesa', 'ceap_categoria', 'ceap_parametro', 'ceap_encerramento')`;
    expect(colunas.map((c) => c.column_name).filter((n) => /saldo/.test(n))).toEqual([]);
  });

  it('o worker e a área pública não alcançam a CEAP', async () => {
    for (const papel of ['worker', 'publico'] as const) {
      const sql = banco.conectar(papel).cliente;
      for (const tabela of ['despesa', 'ceap_parametro', 'ceap_categoria', 'ceap_encerramento']) {
        await expect(sql.unsafe(`SELECT 1 FROM ${tabela}`)).rejects.toThrow(/permission denied/);
      }
    }
  });
});
