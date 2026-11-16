/* eslint-disable @typescript-eslint/no-explicit-any -- corpos JSON das respostas, sem tipo */
import { afterEach, describe, expect, it } from 'vitest';
import {
  a,
  etapaPor,
  preparar,
  registrar,
  novaDemanda,
} from './demandas/auxiliares-de-demandas.js';

afterEach(async () => {
  await a.encerrar();
});

const nomeDe = async (id: number): Promise<string> => {
  const { cliente } = a.banco.conectar('api');
  const [u] = await cliente<{ nome: string }[]>`SELECT nome FROM usuario WHERE id = ${id}`;
  return u!.nome;
};

const mencoes = async () => {
  const { cliente } = a.banco.conectar('api');
  return cliente<{ destinatario_id: string; origem_id: string | null; registro_tipo: string }[]>`
    SELECT destinatario_id, origem_id, registro_tipo FROM aviso WHERE natureza = 'mencao' ORDER BY id`;
};

describe('menções (@Nome) em textos livres', () => {
  it('na descrição da tarefa: avisa quem o texto cita, nunca o autor nem quem só foi enviado no corpo', async () => {
    const e = await preparar();
    const nome = await nomeDe(e.id.supervisor);
    const r = await a.chamar('POST', '/api/tarefas', {
      cookie: e.cookie.interno,
      corpo: {
        titulo: 'Preparar a reunião',
        descricao: `Alinhar a pauta com @${nome}.`,
        // O supervisor consta no texto; o externo, não: só o primeiro é avisado.
        mencoes: [e.id.supervisor, e.id.externo, e.id.interno],
      },
    });
    expect(r.statusCode, r.body).toBe(201);
    const avisos = await mencoes();
    expect(avisos).toHaveLength(1);
    expect(Number(avisos[0]!.destinatario_id)).toBe(e.id.supervisor);
    expect(Number(avisos[0]!.origem_id)).toBe(e.id.interno);
    expect(avisos[0]!.registro_tipo).toBe('tarefa');
  });

  it('editar o texto não avisa de novo quem já constava, mas avisa o recém-citado', async () => {
    const e = await preparar();
    const supervisor = await nomeDe(e.id.supervisor);
    const externo = await nomeDe(e.id.externo);
    const t = (
      await a.chamar('POST', '/api/tarefas', {
        cookie: e.cookie.interno,
        corpo: {
          titulo: 'Tarefa',
          descricao: `Ver com @${supervisor}`,
          mencoes: [e.id.supervisor],
        },
      })
    ).json();
    const r = await a.chamar('PATCH', `/api/tarefas/${t.id}`, {
      cookie: e.cookie.interno,
      corpo: {
        descricao: `Ver com @${supervisor} e @${externo}`,
        mencoes: [e.id.supervisor, e.id.externo],
      },
    });
    expect(r.statusCode, r.body).toBe(200);
    expect((await mencoes()).map((m) => Number(m.destinatario_id))).toEqual([
      e.id.supervisor,
      e.id.externo,
    ]);
  });

  it('na observação de mover a tarefa e da demanda', async () => {
    const e = await preparar();
    const supervisor = await nomeDe(e.id.supervisor);
    const etapas = (
      await a.chamar('GET', '/api/tarefas/etapas', { cookie: e.cookie.interno })
    ).json();
    const t = (
      await a.chamar('POST', '/api/tarefas', { cookie: e.cookie.interno, corpo: { titulo: 'T' } })
    ).json();
    const r = await a.chamar('POST', `/api/tarefas/${t.id}/mover`, {
      cookie: e.cookie.interno,
      corpo: {
        etapaId: etapas.find((x: any) => x.papel === 'intermediaria').id,
        observacao: `Falta a assinatura de @${supervisor}`,
        mencoes: [e.id.supervisor],
      },
    });
    expect(r.statusCode, r.body).toBe(200);

    const d = (await registrar(e.cookie.interno)).demanda;
    const rd = await a.chamar('POST', `/api/demandas/${d.id}/mover`, {
      cookie: e.cookie.interno,
      corpo: {
        etapaId: await etapaPor(e.cookie.interno, 'Em triagem'),
        observacao: `Conferir com @${supervisor}`,
        mencoes: [e.id.supervisor],
      },
    });
    expect(rd.statusCode, rd.body).toBe(200);
    expect((await mencoes()).map((m) => m.registro_tipo)).toEqual(['tarefa', 'demanda']);
  });

  it('na descrição da demanda: só avisa quem tem Atendimento', async () => {
    const e = await preparar();
    const interno = await nomeDe(e.id.interno);
    const sem = await nomeDe(e.id.semAtendimento);
    const r = await registrar(
      e.cookie.supervisor,
      novaDemanda({
        descricao: `Falar com @${interno} e @${sem}`,
        mencoes: [e.id.interno, e.id.semAtendimento],
      }),
    );
    expect(r.demanda.id).toBeGreaterThan(0);
    expect((await mencoes()).map((m) => Number(m.destinatario_id))).toEqual([e.id.interno]);
  });

  it('a caixa de avisos traz quem mencionou e o título do registro', async () => {
    const e = await preparar();
    const supervisor = await nomeDe(e.id.supervisor);
    const autor = await nomeDe(e.id.interno);
    await a.chamar('POST', '/api/tarefas', {
      cookie: e.cookie.interno,
      corpo: {
        titulo: 'Preparar a reunião',
        descricao: `Alinhar com @${supervisor}`,
        mencoes: [e.id.supervisor],
        responsavelId: e.id.interno,
      },
    });
    const caixa = (await a.chamar('GET', '/api/avisos', { cookie: e.cookie.supervisor })).json();
    const mencao = caixa.itens.find((i: any) => i.natureza === 'mencao');
    expect(mencao).toMatchObject({
      de: autor,
      registro: { tipo: 'tarefa', titulo: 'Preparar a reunião' },
    });
  });
});
