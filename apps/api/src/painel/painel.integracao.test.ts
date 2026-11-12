/* eslint-disable @typescript-eslint/no-explicit-any -- corpos JSON das respostas, sem tipo */
import { afterEach, describe, expect, inject, it } from 'vitest';
import { iniciarAmbiente, type Ambiente } from '../teste/auxiliares.js';

let a: Ambiente;
afterEach(async () => {
  await a.encerrar();
});

const hora = 3_600_000;

async function preparar() {
  a = await iniciarAmbiente(inject('urlAdminDeTeste'));
  const admin = await a.criarUsuario({ perfil: 'administrador' });
  const supervisor = await a.criarUsuario({ perfil: 'supervisor', habilitacoes: ['AT'] });
  const interno = await a.criarUsuario({ perfil: 'assessor_interno', habilitacoes: ['AT'] });
  const externo = await a.criarUsuario({ perfil: 'assessor_externo', habilitacoes: ['AT'] });
  const semAtendimento = await a.criarUsuario({ perfil: 'supervisor', habilitacoes: ['AG'] });
  return {
    emails: { interno: interno.email },
    cookie: {
      admin: await a.sessaoDe(admin.email),
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
        solicitante: { nome: `Pessoa ${(n += 1)}`, telefone: `6799${String(1000000 + n)}` },
        titulo: `Pedido ${n}`,
        ...extra,
      },
    })
  ).json().demanda;

const etapa = async (cookie: string, nome: string): Promise<number> =>
  (await a.chamar('GET', '/api/demandas/quadro', { cookie }))
    .json()
    .colunas.find((c: any) => c.etapa.nome === nome).etapa.id;

const painel = async (cookie: string) =>
  (await a.chamar('GET', '/api/painel/atendimento', { cookie })).json();

describe('painel de atendimento', () => {
  it('conta abertas, atrasadas, paradas, novas, concluídas no mês e as minhas', async () => {
    const { cookie } = await preparar();
    expect(await painel(cookie.interno)).toMatchObject({
      abertas: 0,
      atrasadas: 0,
      paradas: 0,
      novasNaSemana: 0,
      concluidasNoMes: 0,
      minhasAbertas: 0,
      limiteParadoDias: 14,
    });

    await registrar(cookie.interno);
    await registrar(cookie.interno, { prazo: '2026-11-10' }); // vencido em relação a 12/11
    await registrar(cookie.supervisor);
    const concluida = await registrar(cookie.interno);
    const cancelada = await registrar(cookie.interno);
    await a.chamar('POST', `/api/demandas/${concluida.id}/mover`, {
      cookie: cookie.interno,
      corpo: { etapaId: await etapa(cookie.interno, 'Concluída') },
    });
    await a.chamar('POST', `/api/demandas/${cancelada.id}/cancelar`, {
      cookie: cookie.supervisor,
      corpo: { justificativa: 'Registrada por engano' },
    });

    const p = await painel(cookie.interno);
    expect(p).toMatchObject({
      abertas: 3, // 2 do Interno + 1 do Supervisor; a concluída e a cancelada não contam
      atrasadas: 1,
      novasNaSemana: 4, // as 5 menos a cancelada
      concluidasNoMes: 1,
      minhasAbertas: 2,
    });
    expect(p.porEtapa.find((e: any) => e.nome === 'Recebida').total).toBe(3);
    expect(p.porEtapa.find((e: any) => e.nome === 'Concluída').total).toBe(1);
    expect(p.porEtapa.reduce((s: number, e: any) => s + e.total, 0)).toBe(4);
  });

  it('as mesmas contas da listagem: o painel nunca mostra o que a lista não mostraria', async () => {
    const { cookie } = await preparar();
    for (let i = 0; i < 4; i += 1) await registrar(cookie.interno);
    await registrar(cookie.externo);
    await registrar(cookie.externo, { prazo: '2026-01-01' });

    for (const quem of ['interno', 'supervisor', 'externo'] as const) {
      const p = await painel(cookie[quem]);
      const abertas = (
        await a.chamar('GET', '/api/demandas?status=em_andamento', { cookie: cookie[quem] })
      ).json().total;
      const atrasadas = (
        await a.chamar('GET', '/api/demandas?atrasadas=true', { cookie: cookie[quem] })
      ).json().total;
      expect(p.abertas, quem).toBe(abertas);
      expect(p.atrasadas, quem).toBe(atrasadas);
    }
    expect((await painel(cookie.externo)).abertas).toBe(2);
    expect((await painel(cookie.interno)).abertas).toBe(6);
  });

  it('"parada" é a demanda em andamento sem movimento além do limite (do parâmetro, ou 14 dias)', async () => {
    const { cookie, emails } = await preparar();
    await registrar(cookie.interno);
    expect((await painel(cookie.interno)).paradas).toBe(0);

    // A sessão vale 12 h: depois de avançar dias no relógio de teste, entra de novo.
    a.relogio.avancar(15 * 24 * hora);
    const depois = await a.sessaoDe(emails.interno);
    expect((await painel(depois)).paradas).toBe(1);

    // Mover a demanda desfaz o "parada".
    const id = (await a.chamar('GET', '/api/demandas', { cookie: depois })).json().itens[0].id;
    await a.chamar('POST', `/api/demandas/${id}/mover`, {
      cookie: depois,
      corpo: { etapaId: await etapa(depois, 'Em triagem') },
    });
    expect((await painel(depois)).paradas).toBe(0);

    // O limite é configurável.
    await a.banco.conectar('api')
      .cliente`INSERT INTO parametro (chave, valor) VALUES ('limite_parado.demanda', '3'::jsonb)`;
    a.relogio.avancar(4 * 24 * hora);
    const muitoDepois = await a.sessaoDe(emails.interno);
    expect(await painel(muitoDepois)).toMatchObject({ paradas: 1, limiteParadoDias: 3 });
  });

  it('exige a habilitação AT (404 sem ela)', async () => {
    const { cookie } = await preparar();
    expect(
      (await a.chamar('GET', '/api/painel/atendimento', { cookie: cookie.semAtendimento }))
        .statusCode,
    ).toBe(404);
  });
});
