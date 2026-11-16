import { criarBancoDeTeste, type BancoDeTeste } from '@gabinete/banco/teste';
import type postgres from 'postgres';
import { afterEach, beforeEach, describe, expect, inject, it } from 'vitest';
import { GeradorDeAvisosDePrazo, hojeNoGabinete } from './prazos.js';

declare module 'vitest' {
  export interface ProvidedContext {
    urlAdminDeTeste: string;
  }
}

let banco: BancoDeTeste;
let api: postgres.Sql;
let sql: postgres.Sql;
let responsavel: number;
let relogio = new Date('2026-11-12T15:00:00Z'); // 12:00 em São Paulo
const registros: string[] = [];

const gerador = (conexao: postgres.Sql = sql) =>
  new GeradorDeAvisosDePrazo({
    sql: conexao,
    agora: () => relogio,
    registrar: (m) => registros.push(m),
  });

beforeEach(async () => {
  relogio = new Date('2026-11-12T15:00:00Z');
  registros.length = 0;
  banco = await criarBancoDeTeste(inject('urlAdminDeTeste'));
  api = banco.conectar('api').cliente;
  sql = banco.conectar('worker').cliente;
  const [conta] = await api<{ id: number }[]>`
    INSERT INTO conta_acesso (email, verificador_senha) VALUES ('a@exemplo.test', 'h') RETURNING id`;
  const [u] = await api<{ id: number }[]>`
    INSERT INTO usuario (conta_id, nome, perfil) VALUES (${conta!.id}, 'A', 'administrador') RETURNING id`;
  responsavel = Number(u!.id);
});

afterEach(async () => {
  await banco.encerrar();
});

async function etapaDe(tipo: string, papel: string) {
  const [e] = await api<{ id: number }[]>`
    SELECT e.id FROM etapa e JOIN tipo_processo t ON t.id = e.tipo_processo_id
    WHERE t.tipo = ${tipo} AND e.papel = ${papel} ORDER BY e.ordem LIMIT 1`;
  return Number(e!.id);
}

async function tarefa(prazo: string | null, papel = 'entrada', dono = responsavel) {
  const [t] = await api<{ id: number }[]>`
    INSERT INTO tarefa (criador_id, responsavel_id, titulo, etapa_atual_id, prazo)
    VALUES (${dono}, ${dono}, 'Ligar', ${await etapaDe('tarefa', papel)}, ${prazo}) RETURNING id`;
  return Number(t!.id);
}

const avisos = () =>
  api<{ natureza: string; registro_tipo: string; registro_id: string; destinatario_id: string }[]>`
    SELECT natureza, registro_tipo, registro_id, destinatario_id FROM aviso ORDER BY id`;

describe('hoje no gabinete', () => {
  it('usa o fuso de São Paulo, não o do servidor', () => {
    expect(hojeNoGabinete(new Date('2026-11-13T01:00:00Z'))).toBe('2026-11-12');
    expect(hojeNoGabinete(new Date('2026-11-13T03:30:00Z'))).toBe('2026-11-13');
  });
});

describe('aviso de prazo', () => {
  it('avisa prazo próximo (dentro da antecedência de 3 dias) e prazo vencido', async () => {
    const proxima = await tarefa('2026-11-14'); // em 2 dias
    const hoje = await tarefa('2026-11-12');
    const vencida = await tarefa('2026-11-10');
    await tarefa('2026-11-20'); // longe: sem aviso
    await tarefa(null); // sem prazo: sem aviso

    const resumo = await gerador().passar();
    expect(resumo).toMatchObject({ proximos: 2, vencidos: 1, falhas: 0 });
    const lista = await avisos();
    expect(lista).toHaveLength(3);
    const por = (id: number) => lista.find((a) => Number(a.registro_id) === id)?.natureza;
    expect(por(proxima)).toBe('prazo_proximo');
    expect(por(hoje)).toBe('prazo_proximo');
    expect(por(vencida)).toBe('prazo_vencido');
    expect(lista.every((a) => Number(a.destinatario_id) === responsavel)).toBe(true);
  });

  it('gera uma vez por dia por prazo (critério 3): repetir no mesmo dia não duplica', async () => {
    await tarefa('2026-11-13');
    expect((await gerador().passar()).proximos).toBe(1);
    expect((await gerador().passar()).proximos).toBe(0);
    relogio = new Date('2026-11-12T22:00:00Z'); // ainda o mesmo dia em São Paulo
    expect((await gerador().passar()).proximos).toBe(0);
    expect(await avisos()).toHaveLength(1);

    relogio = new Date('2026-11-13T15:00:00Z'); // dia seguinte: novo aviso (agora vence hoje)
    expect((await gerador().passar()).proximos).toBe(1);
    expect(await avisos()).toHaveLength(2);
  });

  it('não avisa tarefa concluída, arquivada, cancelada nem de quem saiu da equipe', async () => {
    await tarefa('2026-11-10', 'conclusao');
    await tarefa('2026-11-10', 'arquivamento');
    const cancelada = await tarefa('2026-11-10');
    await api`UPDATE tarefa SET cancelada_em = now(), cancelada_por = ${responsavel},
                justificativa_cancelamento = 'Não é mais necessária' WHERE id = ${cancelada}`;
    const [c2] = await api<{ id: number }[]>`
      INSERT INTO conta_acesso (email, verificador_senha) VALUES ('b@exemplo.test', 'h') RETURNING id`;
    const [u2] = await api<{ id: number }[]>`
      INSERT INTO usuario (conta_id, nome, perfil) VALUES (${c2!.id}, 'B', 'assessor_interno') RETURNING id`;
    await tarefa('2026-11-10', 'entrada', Number(u2!.id));
    await api`UPDATE usuario SET situacao = 'inativo' WHERE id = ${u2!.id}`;

    expect(await gerador().passar()).toMatchObject({ proximos: 0, vencidos: 0 });
  });

  it('também avisa o prazo de demandas em andamento', async () => {
    const [p] = await api<{ id: number }[]>`
      INSERT INTO pessoa (nome_completo, telefone_normalizado) VALUES ('Maria', '67999990000') RETURNING id`;
    await api`INSERT INTO protocolo_emitido (protocolo) VALUES ('K7M2K7M2K7M2')`;
    const [d] = await api<{ id: number }[]>`
      INSERT INTO demanda (protocolo, segredo_link_hash, segredo_link_cifrado, solicitante_id, responsavel_id, autor_id, titulo, etapa_atual_id, prazo)
      VALUES ('K7M2K7M2K7M2', 'h', 'c', ${p!.id}, ${responsavel}, ${responsavel}, 'Poda', ${await etapaDe('demanda', 'entrada')}, '2026-11-11')
      RETURNING id`;
    expect(await gerador().passar()).toMatchObject({ vencidos: 1 });
    expect((await avisos())[0]).toMatchObject({
      natureza: 'prazo_vencido',
      registro_tipo: 'demanda',
      registro_id: String(d!.id),
    });
  });

  it('respeita a antecedência configurada', async () => {
    await tarefa('2026-11-18'); // em 6 dias
    expect((await gerador().passar()).proximos).toBe(0);
    await api`INSERT INTO parametro (chave, valor) VALUES ('antecedencia_aviso_prazo', '7'::jsonb)`;
    expect((await gerador().passar()).proximos).toBe(1);
  });
});

describe('expurgo', () => {
  it('apaga só os avisos expirados', async () => {
    const id = await tarefa(null);
    await api`INSERT INTO aviso (destinatario_id, natureza, registro_tipo, registro_id, expira_em)
      VALUES (${responsavel}, 'tarefa_designada', 'tarefa', ${id}, '2026-11-01T00:00:00Z'),
             (${responsavel}, 'tarefa_designada', 'tarefa', ${id}, '2026-12-01T00:00:00Z')`;
    expect((await gerador().passar()).expurgados).toBe(1);
    expect(await avisos()).toHaveLength(1);
  });
});

describe('robustez', () => {
  it('um item que falha não impede os outros (critério 3)', async () => {
    const boa = await tarefa('2026-11-10');
    const ruim = await tarefa('2026-11-11');
    // O banco passa a recusar o aviso de UMA das tarefas: a passagem segue para a outra.
    await banco
      .conectar('migracao')
      .cliente.unsafe(
        `ALTER TABLE aviso ADD CONSTRAINT teste_recusa_a_ruim CHECK (registro_id <> ${ruim})`,
      );
    const resumo = await gerador().passar();
    expect(resumo).toMatchObject({ vencidos: 1, falhas: 1 });
    expect(registros.some((m) => m.includes(`tarefa ${ruim}`))).toBe(true);
    expect((await avisos()).map((a) => Number(a.registro_id))).toEqual([boa]);
  });

  it('uma passagem que falha não derruba o processo: registra, e repete em 5 minutos', async () => {
    await tarefa('2026-11-10');
    const quebrado = banco.conectar('worker').cliente;
    await quebrado.end({ timeout: 1 });
    const g = gerador(quebrado);
    expect(await g.passarSeDevido()).toBeNull(); // não lançou
    expect(registros.some((m) => m.includes('falha na passagem de prazos'))).toBe(true);

    // Dentro dos 5 minutos, nem tenta; depois deles, tenta de novo (e falha de novo, sem lançar).
    registros.length = 0;
    relogio = new Date(relogio.getTime() + 60_000);
    expect(await g.passarSeDevido()).toBeNull();
    expect(registros).toHaveLength(0);
    relogio = new Date(relogio.getTime() + 5 * 60_000);
    expect(await g.passarSeDevido()).toBeNull();
    expect(registros).toHaveLength(1);
  });

  it('passa de hora em hora', async () => {
    await tarefa('2026-11-10');
    const g = gerador();
    expect(await g.passarSeDevido()).toMatchObject({ vencidos: 1 });
    relogio = new Date(relogio.getTime() + 30 * 60_000);
    expect(await g.passarSeDevido()).toBeNull();
    relogio = new Date(relogio.getTime() + 31 * 60_000);
    expect(await g.passarSeDevido()).not.toBeNull();
  });
});

describe('o papel do worker (critério 4)', () => {
  it('só consegue inserir em aviso: qualquer outra escrita é recusada', async () => {
    const id = await tarefa('2026-11-10');
    for (const recusado of [
      sql`UPDATE tarefa SET titulo = 'x'`,
      sql`DELETE FROM tarefa`,
      sql`INSERT INTO tarefa (criador_id, responsavel_id, titulo, etapa_atual_id) VALUES (1, 1, 'x', 1)`,
      sql`UPDATE aviso SET lido_em = now()`,
      sql`DELETE FROM aviso`,
      sql`SELECT * FROM aviso`,
      sql`UPDATE demanda SET titulo = 'x'`,
      sql`INSERT INTO trilha (origem, operacao, entidade) VALUES ('worker', 'x', 'x')`,
      sql`UPDATE usuario SET situacao = 'inativo'`,
      sql`SELECT titulo FROM tarefa WHERE id = ${id}`,
    ]) {
      await expect(recusado).rejects.toThrow(/permission denied/);
    }
  });
});
