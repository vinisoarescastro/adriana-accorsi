import type postgres from 'postgres';
import { afterEach, beforeEach, describe, expect, inject, it } from 'vitest';
import { criarBancoDeTeste, type BancoDeTeste } from '../teste/auxiliares.js';
import {
  etapaAtualDoRegistro,
  etapaDeEntrada,
  registrarMovimentacao,
  statusPeloPapel,
} from './movimentacao.js';

let banco: BancoDeTeste;
let api: postgres.Sql;
let dono: postgres.Sql;
let autorId: number;

beforeEach(async () => {
  banco = await criarBancoDeTeste(inject('urlAdminDeTeste'));
  api = banco.conectar('api').cliente;
  dono = banco.conectar('migracao').cliente;
  const [conta] = await api<{ id: number }[]>`
    INSERT INTO conta_acesso (email, verificador_senha) VALUES ('a@exemplo.test', 'h') RETURNING id`;
  const [u] = await api<{ id: number }[]>`
    INSERT INTO usuario (conta_id, nome, perfil) VALUES (${conta!.id}, 'A', 'administrador') RETURNING id`;
  autorId = Number(u!.id);
});

afterEach(async () => {
  await banco.encerrar();
});

const etapaPor = async (tipo: string, nome: string) => {
  const [e] = await api<{ id: string; papel: string }[]>`
    SELECT e.id, e.papel FROM etapa e JOIN tipo_processo t ON t.id = e.tipo_processo_id
    WHERE t.tipo = ${tipo} AND e.nome_interno = ${nome}`;
  return { id: Number(e!.id), papel: e!.papel };
};

describe('fluxos federais provisionados', () => {
  it('cada tipo tem os conjuntos esperados e a estrutura exigida', async () => {
    const linhas = await api<
      { tipo: string; total: string; entradas: string; arquivos: string; conclusoes: string }[]
    >`
      SELECT t.tipo, count(*) AS total,
             count(*) FILTER (WHERE e.papel = 'entrada') AS entradas,
             count(*) FILTER (WHERE e.papel = 'arquivamento') AS arquivos,
             count(*) FILTER (WHERE e.papel = 'conclusao') AS conclusoes
      FROM etapa e JOIN tipo_processo t ON t.id = e.tipo_processo_id
      GROUP BY t.tipo ORDER BY t.tipo`;
    const porTipo = Object.fromEntries(linhas.map((l) => [l.tipo, l]));

    expect(Object.keys(porTipo).sort()).toEqual([
      'demanda',
      'despesa_ceap',
      'emenda',
      'projeto_lei',
      'tarefa',
    ]);
    expect(Number(porTipo.demanda?.total)).toBe(7);
    expect(Number(porTipo.tarefa?.total)).toBe(4);
    expect(Number(porTipo.projeto_lei?.total)).toBe(12);
    expect(Number(porTipo.emenda?.total)).toBe(9);
    expect(Number(porTipo.despesa_ceap?.total)).toBe(8);
    for (const l of linhas) {
      expect(Number(l.entradas), l.tipo).toBe(1);
      expect(Number(l.arquivos), l.tipo).toBe(1);
      expect(Number(l.conclusoes), l.tipo).toBeGreaterThanOrEqual(1);
    }
  });

  it('só a demanda tem rótulo e visibilidade públicos', async () => {
    const [r] = await api<{ publicas: string }[]>`
      SELECT count(*) AS publicas FROM etapa e JOIN tipo_processo t ON t.id = e.tipo_processo_id
      WHERE t.tipo <> 'demanda' AND (e.rotulo_publico IS NOT NULL OR e.visivel_publico)`;
    expect(Number(r?.publicas)).toBe(0);

    const [d] = await api<{ rotulo: string }[]>`
      SELECT rotulo_publico AS rotulo FROM etapa WHERE nome_interno = 'Aguardando terceiros'`;
    expect(d?.rotulo).toBe('Em andamento');
  });
});

describe('regras estruturais (RN-FLU-01 a 03)', () => {
  it('recusa uma segunda etapa de Entrada ou de Arquivamento', async () => {
    const tipo = await api<{ id: string }[]>`SELECT id FROM tipo_processo WHERE tipo = 'tarefa'`;
    await expect(
      api`INSERT INTO etapa (tipo_processo_id, nome_interno, ordem, papel) VALUES (${tipo[0]!.id}, 'Outra entrada', 9, 'entrada')`,
    ).rejects.toThrow(/exatamente uma etapa de Entrada/);
    await expect(
      api`INSERT INTO etapa (tipo_processo_id, nome_interno, ordem, papel) VALUES (${tipo[0]!.id}, 'Outro arquivo', 9, 'arquivamento')`,
    ).rejects.toThrow(/exatamente uma etapa de Arquivamento/);
  });

  it('não desativa Entrada nem Arquivamento, nem a última Conclusão', async () => {
    const entrada = await etapaPor('tarefa', 'A fazer');
    const arquivo = await etapaPor('tarefa', 'Encerrada');
    const conclusao = await etapaPor('tarefa', 'Concluída');
    for (const e of [entrada, arquivo]) {
      await expect(api`UPDATE etapa SET situacao = 'inativa' WHERE id = ${e.id}`).rejects.toThrow(
        /não podem ser desativadas/,
      );
    }
    await expect(
      api`UPDATE etapa SET situacao = 'inativa' WHERE id = ${conclusao.id}`,
    ).rejects.toThrow(/ao menos uma etapa de Conclusão/);
  });

  it('aceita uma segunda Conclusão e então permite desativar a primeira', async () => {
    const tipo = await api<{ id: string }[]>`SELECT id FROM tipo_processo WHERE tipo = 'tarefa'`;
    const primeira = await etapaPor('tarefa', 'Concluída');
    await api`INSERT INTO etapa (tipo_processo_id, nome_interno, ordem, papel) VALUES (${tipo[0]!.id}, 'Cancelada', 9, 'conclusao')`;
    await api`UPDATE etapa SET situacao = 'inativa' WHERE id = ${primeira.id}`;
  });

  it('o papel de uma etapa nunca muda, e o nome é único entre as ativas', async () => {
    const intermediaria = await etapaPor('tarefa', 'Em andamento');
    await expect(
      api`UPDATE etapa SET papel = 'conclusao' WHERE id = ${intermediaria.id}`,
    ).rejects.toThrow(/papel de uma etapa não pode/);
    await expect(
      api`UPDATE etapa SET nome_interno = 'a fazer' WHERE id = ${intermediaria.id}`,
    ).rejects.toThrow(/etapa_nome_unico_ativas/);
  });

  it('recusa rótulo público fora do fluxo de Demanda', async () => {
    const intermediaria = await etapaPor('tarefa', 'Em andamento');
    await expect(
      api`UPDATE etapa SET rotulo_publico = 'x' WHERE id = ${intermediaria.id}`,
    ).rejects.toThrow(/só existem no fluxo de Demanda/);
  });
});

describe('movimentação (mecanismo único)', () => {
  const abrir = () => banco.conectar('api');

  it('registra a entrada e as transições, e deriva o status do papel da etapa', async () => {
    const conexao = abrir();
    const entrada = await etapaDeEntrada(conexao.bd, 'demanda');
    expect(entrada.papel).toBe('entrada');

    await conexao.bd.transaction(async (tx) => {
      await registrarMovimentacao(tx, {
        registroTipo: 'demanda',
        registroId: 1,
        etapaOrigemId: null,
        etapaDestinoId: entrada.id,
        autorId,
      });
    });
    expect((await etapaAtualDoRegistro(conexao.bd, 'demanda', 1))?.papel).toBe('entrada');

    const andamento = await etapaPor('demanda', 'Em andamento');
    const concluida = await etapaPor('demanda', 'Concluída');
    await conexao.bd.transaction(async (tx) => {
      await registrarMovimentacao(tx, {
        registroTipo: 'demanda',
        registroId: 1,
        etapaOrigemId: entrada.id,
        etapaDestinoId: andamento.id,
        autorId,
      });
      await registrarMovimentacao(tx, {
        registroTipo: 'demanda',
        registroId: 1,
        etapaOrigemId: andamento.id,
        etapaDestinoId: concluida.id,
        autorId,
        observacao: 'Resolvido',
      });
    });

    const atual = await etapaAtualDoRegistro(conexao.bd, 'demanda', 1);
    expect(atual).toMatchObject({ nome: 'Concluída', papel: 'conclusao' });
    expect(statusPeloPapel(atual!.papel)).toBe('concluido');
  });

  it('o status vem só do papel', () => {
    expect(statusPeloPapel('entrada')).toBe('em_andamento');
    expect(statusPeloPapel('intermediaria')).toBe('em_andamento');
    expect(statusPeloPapel('conclusao')).toBe('concluido');
    expect(statusPeloPapel('arquivamento')).toBe('arquivado');
  });

  it('recusa etapa de outro fluxo e etapa inativa', async () => {
    const conexao = abrir();
    const deTarefa = await etapaPor('tarefa', 'Em andamento');
    await expect(
      conexao.bd.transaction((tx) =>
        registrarMovimentacao(tx, {
          registroTipo: 'demanda',
          registroId: 7,
          etapaOrigemId: null,
          etapaDestinoId: deTarefa.id,
          autorId,
        }),
      ),
    ).rejects.toMatchObject({
      cause: { message: expect.stringMatching(/não pertence ao fluxo/) as unknown },
    });

    const tipo = await api<{ id: string }[]>`SELECT id FROM tipo_processo WHERE tipo = 'tarefa'`;
    const [extra] = await api<{ id: string }[]>`
      INSERT INTO etapa (tipo_processo_id, nome_interno, ordem, papel, situacao)
      VALUES (${tipo[0]!.id}, 'Parada', 9, 'intermediaria', 'inativa') RETURNING id`;
    await expect(
      conexao.bd.transaction((tx) =>
        registrarMovimentacao(tx, {
          registroTipo: 'tarefa',
          registroId: 7,
          etapaOrigemId: null,
          etapaDestinoId: Number(extra!.id),
          autorId,
        }),
      ),
    ).rejects.toMatchObject({ cause: { message: expect.stringMatching(/inativa/) as unknown } });
  });

  it('emenda e destinação usam o mesmo fluxo; despesa usa o da CEAP', async () => {
    const conexao = abrir();
    for (const [registroTipo, fluxo] of [
      ['emenda', 'emenda'],
      ['destinacao', 'emenda'],
      ['despesa', 'despesa_ceap'],
    ] as const) {
      const entrada = await etapaDeEntrada(conexao.bd, fluxo);
      await conexao.bd.transaction((tx) =>
        registrarMovimentacao(tx, {
          registroTipo,
          registroId: 1,
          etapaOrigemId: null,
          etapaDestinoId: entrada.id,
          autorId,
        }),
      );
    }
    const naoPermitido = await etapaDeEntrada(conexao.bd, 'emenda');
    await expect(
      conexao.bd.transaction((tx) =>
        registrarMovimentacao(tx, {
          registroTipo: 'despesa',
          registroId: 2,
          etapaOrigemId: null,
          etapaDestinoId: naoPermitido.id,
          autorId,
        }),
      ),
    ).rejects.toBeDefined();
  });

  it('a movimentação é imutável, e etapa já usada não se desativa', async () => {
    const conexao = abrir();
    const intermediaria = await etapaPor('tarefa', 'Em andamento');
    await conexao.bd.transaction((tx) =>
      registrarMovimentacao(tx, {
        registroTipo: 'tarefa',
        registroId: 1,
        etapaOrigemId: null,
        etapaDestinoId: intermediaria.id,
        autorId,
      }),
    );

    await expect(dono`UPDATE movimentacao SET observacao = 'x'`).rejects.toThrow(/imutável/);
    await expect(dono`DELETE FROM movimentacao`).rejects.toThrow(/imutável/);
    await expect(dono`TRUNCATE movimentacao`).rejects.toThrow(/imutável/);
    await expect(
      api`UPDATE etapa SET situacao = 'inativa' WHERE id = ${intermediaria.id}`,
    ).rejects.toThrow(/Etapa com registros não pode ser desativada/);
  });

  it('um vínculo aponta para um único registro', async () => {
    await api`INSERT INTO vinculo (origem_tipo, origem_id, destino_tipo, destino_id, criado_por)
              VALUES ('tarefa', 1, 'demanda', 10, ${autorId})`;
    await expect(
      api`INSERT INTO vinculo (origem_tipo, origem_id, destino_tipo, destino_id, criado_por)
          VALUES ('tarefa', 1, 'projeto_lei', 5, ${autorId})`,
    ).rejects.toThrow(/vinculo_origem_unica/);
    await expect(
      api`INSERT INTO vinculo (origem_tipo, origem_id, destino_tipo, destino_id, criado_por)
          VALUES ('fantasma', 1, 'demanda', 10, ${autorId})`,
    ).rejects.toThrow(/vinculo_origem_valida/);
  });
});
