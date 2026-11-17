/* eslint-disable @typescript-eslint/no-explicit-any -- corpos JSON das respostas, sem tipo */
import { afterEach, describe, expect, inject, it } from 'vitest';
import { iniciarAmbiente, type Ambiente } from '../teste/auxiliares.js';

let a: Ambiente;
afterEach(async () => {
  await a.encerrar();
});

async function preparar() {
  a = await iniciarAmbiente(inject('urlAdminDeTeste'));
  const admin = await a.criarUsuario({ perfil: 'administrador' });
  const chefe = await a.criarUsuario({ perfil: 'chefe', habilitacoes: ['AT', 'LG'] });
  const supervisor = await a.criarUsuario({ perfil: 'supervisor', habilitacoes: ['AT'] });
  const interno = await a.criarUsuario({ perfil: 'assessor_interno', habilitacoes: ['AT'] });
  const externo = await a.criarUsuario({ perfil: 'assessor_externo', habilitacoes: ['AT'] });
  const semAtendimento = await a.criarUsuario({ perfil: 'assessor_interno', habilitacoes: ['AG'] });
  return {
    emails: { interno: interno.email },
    cookie: {
      admin: await a.sessaoDe(admin.email),
      chefe: await a.sessaoDe(chefe.email),
      supervisor: await a.sessaoDe(supervisor.email),
      interno: await a.sessaoDe(interno.email),
      externo: await a.sessaoDe(externo.email),
      semAtendimento: await a.sessaoDe(semAtendimento.email),
    },
  };
}

let n = 0;
const registrar = async (cookie: string, extra: object = {}) =>
  (
    await a.chamar('POST', '/api/demandas', {
      cookie,
      corpo: {
        solicitante: { nome: `Pessoa ${(n += 1)}`, telefone: `6798${String(1000000 + n)}` },
        titulo: `Pedido ${n}`,
        ...extra,
      },
    })
  ).json().demanda;

const etapaDeDemanda = async (cookie: string, nome: string): Promise<number> =>
  (await a.chamar('GET', '/api/demandas/quadro', { cookie }))
    .json()
    .colunas.find((c: any) => c.etapa.nome === nome).etapa.id;

const tarefa = (cookie: string, extra: object = {}) =>
  a.chamar('POST', '/api/tarefas', {
    cookie,
    corpo: { titulo: 'Ligar para a prefeitura', ...extra },
  });

const ler = async (cookie: string, caminho: string) =>
  (await a.chamar('GET', caminho, { cookie })).json();

describe('tendência do atendimento', () => {
  it('conta por dia as recebidas e as concluídas, sem inventar dias', async () => {
    const { cookie } = await preparar();
    await registrar(cookie.interno);
    const concluida = await registrar(cookie.interno);
    await a.chamar('POST', `/api/demandas/${concluida.id}/mover`, {
      cookie: cookie.interno,
      corpo: { etapaId: await etapaDeDemanda(cookie.interno, 'Concluída') },
    });

    const t = await ler(cookie.interno, '/api/painel/atendimento/tendencia');
    expect(t.dias).toBe(30);
    expect(t.pontos).toHaveLength(30);
    // O relógio de teste está em 12/11/2026: o último dia é hoje.
    expect(t.pontos[29]).toEqual({ dia: '2026-11-12', recebidas: 2, concluidas: 1 });
    expect(t.pontos[0].dia).toBe('2026-10-14');
    expect(t.pontos.slice(0, 29).every((p: any) => p.recebidas === 0 && p.concluidas === 0)).toBe(
      true,
    );
    expect(t.totalRecebidas).toBe(2);
    expect(t.totalConcluidas).toBe(1);
  });

  it('o Assessor Externo só conta o que é dele, e sem a habilitação AT responde 404', async () => {
    const { cookie } = await preparar();
    await registrar(cookie.interno);
    await registrar(cookie.externo);
    expect((await ler(cookie.externo, '/api/painel/atendimento/tendencia')).totalRecebidas).toBe(1);
    expect((await ler(cookie.supervisor, '/api/painel/atendimento/tendencia')).totalRecebidas).toBe(
      2,
    );
    expect(
      (
        await a.chamar('GET', '/api/painel/atendimento/tendencia', {
          cookie: cookie.semAtendimento,
        })
      ).statusCode,
    ).toBe(404);
  });
});

describe('pendências de quem entrou', () => {
  it('lista as tarefas e as demandas do usuário, as atrasadas e de prazo mais próximo primeiro', async () => {
    const { cookie } = await preparar();
    await tarefa(cookie.interno, { titulo: 'Sem prazo' });
    await tarefa(cookie.interno, { titulo: 'Para dezembro', prazo: '2026-12-20' });
    const tarefaAtrasada = (
      await tarefa(cookie.interno, { titulo: 'Para amanhã', prazo: '2026-11-13' })
    ).json();
    await a.chamar('PATCH', `/api/tarefas/${tarefaAtrasada.id}`, {
      cookie: cookie.interno,
      corpo: { prazo: '2026-11-01' },
    });
    await registrar(cookie.interno, { prazo: '2026-11-05' });
    await registrar(cookie.supervisor); // de outra pessoa: não entra nas pendências do Interno

    const p = await ler(cookie.interno, '/api/painel/pendencias');
    expect(p.tarefas.map((t: any) => t.titulo)).toEqual([
      'Para amanhã',
      'Para dezembro',
      'Sem prazo',
    ]);
    expect(p.tarefas[0]).toMatchObject({ atrasada: true });
    expect(p.tarefas[1]).toMatchObject({ atrasada: false });
    expect(p.totalDeTarefas).toBe(3);
    expect(p.demandas).toHaveLength(1);
    expect(p.demandas[0]).toMatchObject({ atrasada: true, etapa: 'Recebida' });
    expect(p.demandas[0].protocolo).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    expect(p.totalDeDemandas).toBe(1);
  });

  it('sem atendimento, só as tarefas; tarefa concluída e cancelada não são pendência', async () => {
    const { cookie } = await preparar();
    const feita = (await tarefa(cookie.semAtendimento, { titulo: 'Feita' })).json();
    const cancelada = (await tarefa(cookie.semAtendimento, { titulo: 'Cancelada' })).json();
    await tarefa(cookie.semAtendimento, { titulo: 'Aberta' });
    const etapas = (
      await a.chamar('GET', '/api/tarefas/etapas', { cookie: cookie.semAtendimento })
    ).json();
    await a.chamar('POST', `/api/tarefas/${feita.id}/mover`, {
      cookie: cookie.semAtendimento,
      corpo: { etapaId: etapas.find((e: any) => e.nome === 'Concluída').id },
    });
    await a.chamar('POST', `/api/tarefas/${cancelada.id}/cancelar`, {
      cookie: cookie.semAtendimento,
      corpo: { justificativa: 'Já resolvida por telefone' },
    });
    const p = await ler(cookie.semAtendimento, '/api/painel/pendencias');
    expect(p.tarefas.map((t: any) => t.titulo)).toEqual(['Aberta']);
    expect(p.demandas).toBeNull();
  });
});

describe('atividade recente', () => {
  it('mostra as passagens de etapa que o usuário alcança, a mais recente primeiro', async () => {
    const { cookie } = await preparar();
    const d = await registrar(cookie.interno);
    a.relogio.avancar(60_000);
    await a.chamar('POST', `/api/demandas/${d.id}/mover`, {
      cookie: cookie.interno,
      corpo: { etapaId: await etapaDeDemanda(cookie.interno, 'Em triagem') },
    });
    a.relogio.avancar(60_000);
    await tarefa(cookie.interno, { titulo: 'Tarefa da atividade' });

    const atividade = await ler(cookie.interno, '/api/painel/atividade');
    expect(atividade.map((x: any) => [x.tipo, x.etapa])).toEqual([
      ['tarefa', 'A fazer'],
      ['demanda', 'Em triagem'],
      ['demanda', 'Recebida'],
    ]);
    expect(atividade[0]).toMatchObject({ titulo: 'Tarefa da atividade' });
  });

  it('não vaza o que o usuário não alcança: o Externo não vê o alheio, e sem AT não há demandas', async () => {
    const { cookie } = await preparar();
    await registrar(cookie.interno);
    await registrar(cookie.externo);
    await tarefa(cookie.interno, { titulo: 'Do Interno' });
    expect(
      (await ler(cookie.externo, '/api/painel/atividade')).filter((x: any) => x.tipo === 'demanda'),
    ).toHaveLength(1);
    expect(
      (await ler(cookie.externo, '/api/painel/atividade')).some(
        (x: any) => x.titulo === 'Do Interno',
      ),
    ).toBe(false);
    expect(
      (await ler(cookie.semAtendimento, '/api/painel/atividade')).some(
        (x: any) => x.tipo === 'demanda',
      ),
    ).toBe(false);
  });
});

describe('carga da equipe', () => {
  it('é do Chefe em diante: abertas, atrasadas e concluídas por pessoa, e a composição por perfil', async () => {
    const { cookie } = await preparar();
    await registrar(cookie.interno);
    const feita = await registrar(cookie.interno, { prazo: '2026-11-01' });
    await a.chamar('POST', `/api/demandas/${feita.id}/mover`, {
      cookie: cookie.interno,
      corpo: { etapaId: await etapaDeDemanda(cookie.interno, 'Concluída') },
    });
    await tarefa(cookie.interno, { titulo: 'Atrasada' }).then(async (r) =>
      a.chamar('PATCH', `/api/tarefas/${r.json().id}`, {
        cookie: cookie.interno,
        corpo: { prazo: '2026-11-01' },
      }),
    );

    const e = await ler(cookie.chefe, '/api/painel/equipe');
    expect(e.periodoDias).toBe(30);
    const deles = e.pessoas.find(
      (p: any) => p.perfil === 'assessor_interno' && p.demandasAbertas > 0,
    );
    expect(deles).toMatchObject({
      demandasAbertas: 1,
      tarefasAbertas: 1,
      atrasadas: 1,
      concluidasNoPeriodo: 1,
    });
    expect(e.porPerfil.find((x: any) => x.perfil === 'assessor_interno').total).toBe(2);
    expect(e.pessoas.reduce((s: number, p: any) => s + p.demandasAbertas, 0)).toBe(1);
  });

  it('os demais perfis recebem 404', async () => {
    const { cookie } = await preparar();
    for (const quem of ['supervisor', 'interno', 'externo'] as const) {
      expect(
        (await a.chamar('GET', '/api/painel/equipe', { cookie: cookie[quem] })).statusCode,
        quem,
      ).toBe(404);
    }
    expect((await a.chamar('GET', '/api/painel/equipe', { cookie: cookie.admin })).statusCode).toBe(
      200,
    );
  });
});
