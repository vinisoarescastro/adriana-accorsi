import type postgres from 'postgres';
import { afterEach, beforeEach, describe, expect, inject, it } from 'vitest';
import { criarBancoDeTeste, type BancoDeTeste } from '../teste/auxiliares.js';

let banco: BancoDeTeste;
let api: postgres.Sql;
let worker: postgres.Sql;
let usuarioId: number;

beforeEach(async () => {
  banco = await criarBancoDeTeste(inject('urlAdminDeTeste'));
  api = banco.conectar('api').cliente;
  worker = banco.conectar('worker').cliente;
  const [conta] = await api<{ id: number }[]>`
    INSERT INTO conta_acesso (email, verificador_senha) VALUES ('a@exemplo.test', 'h') RETURNING id`;
  const [u] = await api<{ id: number }[]>`
    INSERT INTO usuario (conta_id, nome, perfil) VALUES (${conta!.id}, 'A', 'administrador') RETURNING id`;
  usuarioId = Number(u!.id);
});

afterEach(async () => {
  await banco.encerrar();
});

const etapaDeTarefa = async (papel: string) => {
  const [e] = await api<{ id: number }[]>`
    SELECT e.id FROM etapa e JOIN tipo_processo t ON t.id = e.tipo_processo_id
    WHERE t.tipo = 'tarefa' AND e.papel = ${papel} ORDER BY e.ordem LIMIT 1`;
  return Number(e!.id);
};

async function novaTarefa(extra: { prazo?: string | null; papel?: string } = {}) {
  const etapa = await etapaDeTarefa(extra.papel ?? 'entrada');
  const [t] = await api<{ id: number }[]>`
    INSERT INTO tarefa (criador_id, responsavel_id, titulo, etapa_atual_id, prazo)
    VALUES (${usuarioId}, ${usuarioId}, 'Ligar para a prefeitura', ${etapa}, ${extra.prazo ?? null})
    RETURNING id`;
  return Number(t!.id);
}

describe('tarefa', () => {
  it('exige título, vínculo completo e justificativa de 10 caracteres ao cancelar', async () => {
    const etapa = await etapaDeTarefa('entrada');
    await expect(
      api`INSERT INTO tarefa (criador_id, responsavel_id, titulo, etapa_atual_id)
          VALUES (${usuarioId}, ${usuarioId}, '   ', ${etapa})`,
    ).rejects.toThrow(/tarefa_titulo_preenchido/);
    await expect(
      api`INSERT INTO tarefa (criador_id, responsavel_id, titulo, etapa_atual_id, vinculo_tipo)
          VALUES (${usuarioId}, ${usuarioId}, 'x', ${etapa}, 'demanda')`,
    ).rejects.toThrow(/tarefa_vinculo_completo/);

    const id = await novaTarefa();
    await expect(
      api`UPDATE tarefa SET cancelada_em = now(), cancelada_por = ${usuarioId},
            justificativa_cancelamento = 'curta' WHERE id = ${id}`,
    ).rejects.toThrow(/tarefa_justificativa_minima/);
  });

  it('cancelada não se altera, e não há coluna de status', async () => {
    const id = await novaTarefa();
    await api`UPDATE tarefa SET cancelada_em = now(), cancelada_por = ${usuarioId},
                justificativa_cancelamento = 'Não é mais necessária' WHERE id = ${id}`;
    await expect(api`UPDATE tarefa SET titulo = 'Outro' WHERE id = ${id}`).rejects.toThrow(
      /Tarefa cancelada não se altera/,
    );
    const colunas = await api<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns WHERE table_name = 'tarefa'`;
    expect(colunas.map((c) => c.column_name)).not.toContain('status');
  });
});

describe('aviso', () => {
  const novo = async (extra = '') => {
    const id = await novaTarefa();
    const [a] = await api<{ id: number }[]>`
      INSERT INTO aviso (destinatario_id, natureza, registro_tipo, registro_id, expira_em, chave_unica)
      VALUES (${usuarioId}, 'tarefa_designada', 'tarefa', ${id}, now() + interval '60 days',
              ${extra === '' ? null : extra}) RETURNING id`;
    return Number(a!.id);
  };

  it('só a leitura e a expiração mudam', async () => {
    const id = await novo();
    await api`UPDATE aviso SET lido_em = now(), expira_em = now() + interval '30 days' WHERE id = ${id}`;
    await expect(api`UPDATE aviso SET natureza = 'mencao' WHERE id = ${id}`).rejects.toThrow(
      /Só a leitura e a expiração/,
    );
    await expect(
      api`UPDATE aviso SET destinatario_id = destinatario_id + 1 WHERE id = ${id}`,
    ).rejects.toThrow();
  });

  it('a chave única não aceita dado pessoal e não se repete', async () => {
    await novo('prazo_proximo:tarefa:1:2026-11-12');
    await expect(novo('prazo_proximo:tarefa:1:2026-11-12')).rejects.toThrow(
      /aviso_chave_unica_key/,
    );
    await expect(novo('maria@exemplo.test')).rejects.toThrow(/aviso_chave_sem_dado_pessoal/);
  });

  it('nenhum papel apaga aviso (só o expurgo, pela função)', async () => {
    await expect(api`DELETE FROM aviso`).rejects.toThrow(/permission denied/);
    await expect(worker`DELETE FROM aviso`).rejects.toThrow(/permission denied/);
  });
});

describe('o worker de prazos', () => {
  it('só insere em aviso e lê a visão de prazos; nada mais', async () => {
    const id = await novaTarefa({ prazo: '2026-11-14' });
    const abertos = await worker<{ registro_tipo: string; registro_id: number }[]>`
      SELECT registro_tipo, registro_id FROM vw_prazo_aberto`;
    expect(abertos.map((a) => Number(a.registro_id))).toContain(id);

    await worker`INSERT INTO aviso (destinatario_id, natureza, registro_tipo, registro_id, expira_em, chave_unica)
      VALUES (${usuarioId}, 'prazo_proximo', 'tarefa', ${id}, now() + interval '60 days', 'prazo_proximo:tarefa:1:2026-11-12')
      ON CONFLICT DO NOTHING`;
    // O mesmo aviso no mesmo dia não se repete (e o conflito não é erro).
    await worker`INSERT INTO aviso (destinatario_id, natureza, registro_tipo, registro_id, expira_em, chave_unica)
      VALUES (${usuarioId}, 'prazo_proximo', 'tarefa', ${id}, now() + interval '60 days', 'prazo_proximo:tarefa:1:2026-11-12')
      ON CONFLICT DO NOTHING`;
    const [contagem] = await api<{ total: number }[]>`SELECT count(*)::int AS total FROM aviso`;
    expect(contagem?.total).toBe(1);

    for (const recusado of [
      worker`SELECT 1 FROM tarefa`,
      worker`SELECT 1 FROM aviso`,
      worker`UPDATE aviso SET lido_em = now()`,
      worker`DELETE FROM aviso`,
      worker`INSERT INTO tarefa (criador_id, responsavel_id, titulo, etapa_atual_id) VALUES (1, 1, 'x', 1)`,
      worker`UPDATE tarefa SET titulo = 'x'`,
      worker`INSERT INTO trilha (origem, operacao, entidade) VALUES ('worker', 'x', 'x')`,
    ]) {
      await expect(recusado).rejects.toThrow(/permission denied/);
    }
  });

  it('a visão de prazos esconde cancelada, concluída e quem saiu da equipe', async () => {
    const aberta = await novaTarefa({ prazo: '2026-11-14' });
    const concluida = await novaTarefa({ prazo: '2026-11-14', papel: 'conclusao' });
    const cancelada = await novaTarefa({ prazo: '2026-11-14' });
    await api`UPDATE tarefa SET cancelada_em = now(), cancelada_por = ${usuarioId},
                justificativa_cancelamento = 'Não é mais necessária' WHERE id = ${cancelada}`;
    const ids = (
      await worker<{ registro_id: number }[]>`SELECT registro_id FROM vw_prazo_aberto`
    ).map((r) => Number(r.registro_id));
    expect(ids).toContain(aberta);
    expect(ids).not.toContain(concluida);
    expect(ids).not.toContain(cancelada);
  });

  it('a antecedência padrão é 3 dias e o parâmetro a muda, dentro de 1 a 30', async () => {
    const dias = async () =>
      (await worker<{ d: number }[]>`SELECT antecedencia_do_aviso_de_prazo() AS d`)[0]!.d;
    expect(await dias()).toBe(3);
    await api`INSERT INTO parametro (chave, valor) VALUES ('antecedencia_aviso_prazo', '7'::jsonb)`;
    expect(await dias()).toBe(7);
    await api`UPDATE parametro SET valor = '99'::jsonb WHERE chave = 'antecedencia_aviso_prazo'`;
    expect(await dias()).toBe(3);
  });

  it('o expurgo apaga só o expirado', async () => {
    const id = await novaTarefa();
    await api`INSERT INTO aviso (destinatario_id, natureza, registro_tipo, registro_id, expira_em)
      VALUES (${usuarioId}, 'tarefa_designada', 'tarefa', ${id}, '2026-01-01T00:00:00Z'),
             (${usuarioId}, 'tarefa_designada', 'tarefa', ${id}, '2027-01-01T00:00:00Z')`;
    const [feito] = await worker<{ apagados: number }[]>`
      SELECT expurgar_avisos('2026-06-01T00:00:00Z') AS apagados`;
    expect(feito?.apagados).toBe(1);
    const [restante] = await api<{ restam: number }[]>`SELECT count(*)::int AS restam FROM aviso`;
    expect(restante?.restam).toBe(1);
  });
});

describe('agenda', () => {
  const compromisso = async (extra = '') => {
    const [c] = await api<{ id: number }[]>`
      INSERT INTO compromisso (criador_id, titulo, inicio, fim)
      VALUES (${usuarioId}, ${'Reunião' + extra}, '2026-11-20T10:00:00Z', '2026-11-20T11:00:00Z') RETURNING id`;
    return Number(c!.id);
  };

  it('nasce com visibilidade "participantes" e envolvendo a Parlamentar', async () => {
    const id = await compromisso();
    const [c] = await api<{ visibilidade: string; envolve_parlamentar: boolean }[]>`
      SELECT visibilidade, envolve_parlamentar FROM compromisso WHERE id = ${id}`;
    expect(c).toEqual({ visibilidade: 'participantes', envolve_parlamentar: true });
  });

  it('recusa visibilidade inválida, fim antes do início e alteração depois de cancelado', async () => {
    await expect(
      api`INSERT INTO compromisso (criador_id, titulo, inicio, fim, visibilidade)
          VALUES (${usuarioId}, 'x', now(), now(), 'secreto')`,
    ).rejects.toThrow(/compromisso_visibilidade_valida/);
    await expect(
      api`INSERT INTO compromisso (criador_id, titulo, inicio, fim)
          VALUES (${usuarioId}, 'x', now(), now() - interval '1 hour')`,
    ).rejects.toThrow(/compromisso_periodo_valido/);
    const id = await compromisso();
    await api`UPDATE compromisso SET cancelado_em = now(), cancelado_por = ${usuarioId} WHERE id = ${id}`;
    await expect(api`UPDATE compromisso SET titulo = 'Outro' WHERE id = ${id}`).rejects.toThrow(
      /Compromisso cancelado não se altera/,
    );
  });

  it('a resposta do participante é só informativa: recusar não remove nem cancela', async () => {
    const id = await compromisso();
    await api`INSERT INTO participante_interno (compromisso_id, usuario_id) VALUES (${id}, ${usuarioId})`;
    await api`UPDATE participante_interno SET resposta = 'recusado', respondido_em = now()
              WHERE compromisso_id = ${id}`;
    const [p] = await api<{ resposta: string }[]>`
      SELECT resposta FROM participante_interno WHERE compromisso_id = ${id}`;
    expect(p?.resposta).toBe('recusado');
    const [c] = await api<{ cancelado_em: Date | null }[]>`
      SELECT cancelado_em FROM compromisso WHERE id = ${id}`;
    expect(c?.cancelado_em).toBeNull();
  });

  it('o bloqueio só se cancela', async () => {
    const [b] = await api<{ id: number }[]>`
      INSERT INTO bloqueio_indisponibilidade (criador_id, inicio, fim)
      VALUES (${usuarioId}, '2026-11-21T10:00:00Z', '2026-11-21T12:00:00Z') RETURNING id`;
    await expect(
      api`UPDATE bloqueio_indisponibilidade SET fim = fim + interval '1 hour' WHERE id = ${b!.id}`,
    ).rejects.toThrow(/só se cancela/);
    await api`UPDATE bloqueio_indisponibilidade SET cancelado_em = now(), cancelado_por = ${usuarioId} WHERE id = ${b!.id}`;
  });
});

describe('eventos e presença', () => {
  const evento = async () => {
    const [e] = await api<{ id: number }[]>`
      INSERT INTO evento (criador_id, nome, inicio) VALUES (${usuarioId}, 'Audiência pública', now()) RETURNING id`;
    return Number(e!.id);
  };
  const pessoa = async () => {
    const [p] = await api<{ id: number }[]>`
      INSERT INTO pessoa (nome_completo, telefone_normalizado) VALUES ('Maria', '67999990000') RETURNING id`;
    return Number(p!.id);
  };

  it('não se registra, corrige nem remove presença em evento encerrado', async () => {
    const e = await evento();
    const p = await pessoa();
    await api`INSERT INTO participacao_evento (evento_id, pessoa_id, registrado_por) VALUES (${e}, ${p}, ${usuarioId})`;
    await api`UPDATE evento SET situacao = 'encerrado', encerrado_em = now(), encerrado_por = ${usuarioId} WHERE id = ${e}`;
    await expect(
      api`UPDATE participacao_evento SET observacao = 'x' WHERE evento_id = ${e}`,
    ).rejects.toThrow(/evento encerrado/);
    await expect(api`DELETE FROM participacao_evento WHERE evento_id = ${e}`).rejects.toThrow(
      /evento encerrado/,
    );
    const outra = await (async () => {
      const [q] = await api<{ id: number }[]>`
        INSERT INTO pessoa (nome_completo, telefone_normalizado) VALUES ('José', '67999990001') RETURNING id`;
      return Number(q!.id);
    })();
    await expect(
      api`INSERT INTO participacao_evento (evento_id, pessoa_id, registrado_por) VALUES (${e}, ${outra}, ${usuarioId})`,
    ).rejects.toThrow(/evento encerrado/);
  });

  it('a mesma pessoa não consta duas vezes no evento', async () => {
    const e = await evento();
    const p = await pessoa();
    await api`INSERT INTO participacao_evento (evento_id, pessoa_id, registrado_por) VALUES (${e}, ${p}, ${usuarioId})`;
    await expect(
      api`INSERT INTO participacao_evento (evento_id, pessoa_id, registrado_por) VALUES (${e}, ${p}, ${usuarioId})`,
    ).rejects.toThrow(/participacao_evento_pkey/);
  });

  it('evento encerrado não se altera', async () => {
    const e = await evento();
    await api`UPDATE evento SET situacao = 'encerrado', encerrado_em = now(), encerrado_por = ${usuarioId} WHERE id = ${e}`;
    await expect(api`UPDATE evento SET nome = 'Outro' WHERE id = ${e}`).rejects.toThrow(
      /Evento encerrado não se altera/,
    );
  });
});
