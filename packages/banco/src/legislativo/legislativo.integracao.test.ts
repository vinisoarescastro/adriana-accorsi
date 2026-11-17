import type postgres from 'postgres';
import { afterEach, beforeEach, describe, expect, inject, it } from 'vitest';
import { criarBancoDeTeste, type BancoDeTeste } from '../teste/auxiliares.js';

let banco: BancoDeTeste;
let api: postgres.Sql;
let usuarioId: number;

beforeEach(async () => {
  banco = await criarBancoDeTeste(inject('urlAdminDeTeste'));
  api = banco.conectar('api').cliente;
  const [conta] = await api<{ id: number }[]>`
    INSERT INTO conta_acesso (email, verificador_senha) VALUES ('a@exemplo.test', 'h') RETURNING id`;
  const [u] = await api<{ id: number }[]>`
    INSERT INTO usuario (conta_id, nome, perfil) VALUES (${conta!.id}, 'A', 'administrador') RETURNING id`;
  usuarioId = Number(u!.id);
});

afterEach(async () => {
  await banco.encerrar();
});

const cnpjValido = async (valor: string | null) => {
  const [r] = await api<{ ok: boolean }[]>`SELECT cnpj_valido(${valor}) AS ok`;
  return r!.ok;
};

async function novoBeneficiario(cnpj = '11222333000181', situacao = 'ativo') {
  const [b] = await api<{ id: number }[]>`
    INSERT INTO beneficiario (nome_fantasia, razao_social, cnpj, cep, logradouro, numero, bairro,
                              cidade, estado, natureza, situacao, criado_por)
    VALUES ('Prefeitura de Exemplo', 'Município de Exemplo', ${cnpj}, '79002000', 'Rua A', '10',
            'Centro', 'Campo Grande', 'MS', 'municipio', ${situacao}, ${usuarioId})
    RETURNING id`;
  return Number(b!.id);
}

const tipo = async () => {
  const [c] = await api<{ id: number }[]>`
    SELECT id FROM categoria WHERE natureza = 'tipo_proposicao' ORDER BY id LIMIT 1`;
  return Number(c!.id);
};

const etapaDeProjeto = async (papel: string) => {
  const [e] = await api<{ id: number }[]>`
    SELECT e.id FROM etapa e JOIN tipo_processo t ON t.id = e.tipo_processo_id
    WHERE t.tipo = 'projeto_lei' AND e.papel = ${papel} ORDER BY e.ordem LIMIT 1`;
  return Number(e!.id);
};

async function novoProjeto(numero: string | null = null) {
  const [p] = await api<{ id: number }[]>`
    INSERT INTO projeto_lei (criador_id, responsavel_id, titulo, ementa, autoria, numero,
                             tipo_proposicao_id, etapa_atual_id)
    VALUES (${usuarioId}, ${usuarioId}, 'Programa de poda segura', 'Institui o programa.',
            'Dep. Adriana Accorsi', ${numero}, ${await tipo()}, ${await etapaDeProjeto('entrada')})
    RETURNING id`;
  return Number(p!.id);
}

describe('CNPJ', () => {
  it('aceita o numérico e o alfanumérico, e recusa dígito errado, repetido e formato inválido', async () => {
    expect(await cnpjValido('11222333000181')).toBe(true);
    expect(await cnpjValido('12ABC34501DE35')).toBe(true);
    expect(await cnpjValido('11222333000182')).toBe(false);
    expect(await cnpjValido('12ABC34501DE36')).toBe(false);
    expect(await cnpjValido('11111111111111')).toBe(false);
    expect(await cnpjValido('1122233300018')).toBe(false);
    expect(await cnpjValido('12abc34501de35')).toBe(false);
    expect(await cnpjValido(null)).toBe(false);
  });
});

describe('beneficiário', () => {
  it('o banco recusa CNPJ inválido, CEP fora do padrão, estado inexistente e endereço vazio', async () => {
    await expect(novoBeneficiario('11222333000182')).rejects.toThrow(/beneficiario_cnpj_valido/);
    await expect(
      api`UPDATE beneficiario SET cep = '123' WHERE id = ${await novoBeneficiario()}`,
    ).rejects.toThrow(/beneficiario_cep_valido/);
    await expect(
      api`UPDATE beneficiario SET estado = 'XX' WHERE cnpj = '11222333000181'`,
    ).rejects.toThrow(/beneficiario_estado_valido/);
    await expect(
      api`UPDATE beneficiario SET bairro = '  ' WHERE cnpj = '11222333000181'`,
    ).rejects.toThrow(/beneficiario_endereco_preenchido/);
  });

  it('não há dois ativos com o mesmo CNPJ; o inativo libera o CNPJ', async () => {
    const primeiro = await novoBeneficiario();
    await expect(novoBeneficiario()).rejects.toThrow(/beneficiario_cnpj_unico_ativos/);
    await api`UPDATE beneficiario SET situacao = 'inativo' WHERE id = ${primeiro}`;
    await expect(novoBeneficiario()).resolves.toBeGreaterThan(primeiro);
    // Reativar o antigo, com o CNPJ já ocupado, é recusado.
    await expect(
      api`UPDATE beneficiario SET situacao = 'ativo' WHERE id = ${primeiro}`,
    ).rejects.toThrow(/beneficiario_cnpj_unico_ativos/);
  });
});

describe('projeto de lei', () => {
  it('traz o conjunto inicial de tipos de proposição e de assuntos', async () => {
    const [tipos] = await api<{ total: number }[]>`
      SELECT count(*)::int AS total FROM categoria WHERE natureza = 'tipo_proposicao'`;
    expect(tipos!.total).toBeGreaterThanOrEqual(1);
    const [assuntos] = await api<{ assuntos: number }[]>`
      SELECT count(*)::int AS assuntos FROM categoria WHERE natureza = 'assunto_projeto'`;
    expect(assuntos!.assuntos).toBeGreaterThanOrEqual(1);
  });

  it('o número é único entre os ativos, sem diferenciar maiúsculas; cancelar libera o número', async () => {
    const primeiro = await novoProjeto('PL 100/2026');
    await expect(novoProjeto('pl 100/2026')).rejects.toThrow(/projeto_numero_unico_ativos/);
    await novoProjeto(null);
    await novoProjeto(null); // sem número, quantos quiser
    await api`UPDATE projeto_lei SET cancelado_em = now(), cancelado_por = ${usuarioId},
              justificativa_cancelamento = 'Duplicado por engano' WHERE id = ${primeiro}`;
    await expect(novoProjeto('PL 100/2026')).resolves.toBeGreaterThan(primeiro);
  });

  it('o projeto cancelado não se altera, e o criador não muda', async () => {
    const id = await novoProjeto('PL 1/2026');
    await expect(
      api`UPDATE projeto_lei SET criador_id = ${usuarioId + 1} WHERE id = ${id}`,
    ).rejects.toThrow();
    await api`UPDATE projeto_lei SET cancelado_em = now(), cancelado_por = ${usuarioId},
              justificativa_cancelamento = 'Retirado pela autora' WHERE id = ${id}`;
    await expect(api`UPDATE projeto_lei SET titulo = 'Outro' WHERE id = ${id}`).rejects.toThrow(
      /Projeto cancelado não se altera/,
    );
  });

  it('exige justificativa de ao menos 10 caracteres para cancelar', async () => {
    const id = await novoProjeto();
    await expect(
      api`UPDATE projeto_lei SET cancelado_em = now(), cancelado_por = ${usuarioId},
          justificativa_cancelamento = 'curta' WHERE id = ${id}`,
    ).rejects.toThrow(/projeto_justificativa_minima/);
  });

  it('título, ementa e autoria não podem ficar em branco', async () => {
    const id = await novoProjeto();
    for (const campo of ['titulo', 'ementa', 'autoria']) {
      await expect(
        api.unsafe(`UPDATE projeto_lei SET ${campo} = '  ' WHERE id = ${id}`),
      ).rejects.toThrow(/preenchid/);
    }
  });

  it('o banco recusa mover para etapa de outro fluxo, pelo mecanismo único de movimentação', async () => {
    const id = await novoProjeto();
    const [outra] = await api<{ id: number }[]>`
      SELECT e.id FROM etapa e JOIN tipo_processo t ON t.id = e.tipo_processo_id
      WHERE t.tipo = 'tarefa' LIMIT 1`;
    const [fluxo] = await api<
      { id: number }[]
    >`SELECT id FROM tipo_processo WHERE tipo = 'projeto_lei'`;
    await expect(
      api`INSERT INTO movimentacao (registro_tipo, registro_id, tipo_processo_id, etapa_destino_id, autor_id)
          VALUES ('projeto_lei', ${id}, ${fluxo!.id}, ${outra!.id}, ${usuarioId})`,
    ).rejects.toThrow();
  });
});

describe('assuntos, coautores, comissões e votações', () => {
  it('registra e apaga, sem repetir assunto nem coautor, e recusa resultado desconhecido', async () => {
    const id = await novoProjeto();
    const [saude] = await api<{ id: number }[]>`SELECT id FROM categoria WHERE nome = 'Saúde'`;
    await api`INSERT INTO projeto_assunto (projeto_id, categoria_id) VALUES (${id}, ${saude!.id})`;
    await expect(
      api`INSERT INTO projeto_assunto (projeto_id, categoria_id) VALUES (${id}, ${saude!.id})`,
    ).rejects.toThrow();

    await api`INSERT INTO projeto_coautor (projeto_id, nome) VALUES (${id}, 'Fulano de Tal')`;
    await expect(
      api`INSERT INTO projeto_coautor (projeto_id, nome) VALUES (${id}, 'FULANO DE TAL')`,
    ).rejects.toThrow(/projeto_coautor_nome_unico/);

    await api`INSERT INTO tramitacao_comissao (projeto_id, comissao, data, registrado_por)
              VALUES (${id}, 'CCJC', '2026-11-10', ${usuarioId})`;
    await api`INSERT INTO votacao_projeto (projeto_id, data, resultado, registrado_por)
              VALUES (${id}, '2026-11-11', 'aprovado', ${usuarioId})`;
    await expect(
      api`INSERT INTO votacao_projeto (projeto_id, data, resultado, registrado_por)
          VALUES (${id}, '2026-11-11', 'empate', ${usuarioId})`,
    ).rejects.toThrow(/votacao_resultado_valido/);
    // A votação guarda só o resultado: não há coluna de placar individual.
    const colunas = await api<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns WHERE table_name = 'votacao_projeto'`;
    expect(colunas.map((c) => c.column_name)).not.toEqual(
      expect.arrayContaining(['votos_favoraveis']),
    );
    await api`DELETE FROM votacao_projeto WHERE projeto_id = ${id}`;
    await api`DELETE FROM tramitacao_comissao WHERE projeto_id = ${id}`;
  });
});

describe('permissões', () => {
  it('o worker e a área pública não alcançam o legislativo', async () => {
    for (const papel of ['worker', 'publico'] as const) {
      const sql = banco.conectar(papel).cliente;
      for (const tabela of ['beneficiario', 'projeto_lei', 'categoria', 'votacao_projeto']) {
        await expect(sql.unsafe(`SELECT 1 FROM ${tabela}`)).rejects.toThrow(/permission denied/);
      }
    }
  });
});
