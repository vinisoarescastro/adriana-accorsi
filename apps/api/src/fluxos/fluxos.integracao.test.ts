import { afterEach, describe, expect, inject, it } from 'vitest';
import { iniciarAmbiente, type Ambiente } from '../teste/auxiliares.js';

let a: Ambiente;
afterEach(async () => {
  await a.encerrar();
});

async function preparar() {
  a = await iniciarAmbiente(inject('urlAdminDeTeste'));
  const admin = await a.criarUsuario({ perfil: 'administrador' });
  const supervisor = await a.criarUsuario({ perfil: 'supervisor' });
  const assessor = await a.criarUsuario({ perfil: 'assessor_externo' });
  const parlamentar = await a.criarUsuario({ perfil: 'parlamentar' });
  return {
    cookieAdmin: await a.sessaoDe(admin.email),
    cookieSupervisor: await a.sessaoDe(supervisor.email),
    cookieAssessor: await a.sessaoDe(assessor.email),
    cookieParlamentar: await a.sessaoDe(parlamentar.email),
  };
}

type Etapa = {
  id: number;
  nomeInterno: string;
  papel: string;
  situacao: string;
  rotuloPublico: string | null;
};
type Fluxo = { tipo: string; etapas: Etapa[] };

const fluxo = async (cookie: string, tipo: string) =>
  ((await a.chamar('GET', '/api/fluxos', { cookie })).json() as Fluxo[]).find(
    (f) => f.tipo === tipo,
  )!;

describe('consultar', () => {
  it('todos os perfis consultam os cinco fluxos', async () => {
    const { cookieAssessor } = await preparar();
    const fluxos = (
      await a.chamar('GET', '/api/fluxos', { cookie: cookieAssessor })
    ).json() as Fluxo[];
    expect(fluxos.map((f) => f.tipo)).toEqual([
      'demanda',
      'tarefa',
      'projeto_lei',
      'emenda',
      'despesa_ceap',
    ]);
    expect(fluxos.find((f) => f.tipo === 'demanda')?.etapas).toHaveLength(7);
  });
});

describe('ajustar (Supervisor)', () => {
  it('ajusta rótulo, visibilidade, prazo e ordem, e registra na trilha', async () => {
    const { cookieSupervisor } = await preparar();
    const etapa = (await fluxo(cookieSupervisor, 'demanda')).etapas.find(
      (e) => e.nomeInterno === 'Em triagem',
    )!;

    const r = await a.chamar('PATCH', `/api/fluxos/etapas/${etapa.id}`, {
      cookie: cookieSupervisor,
      corpo: { rotuloPublico: 'Analisando', prazoPadraoDias: 5, visivelPublico: false },
    });
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json()).toMatchObject({
      rotuloPublico: 'Analisando',
      prazoPadraoDias: 5,
      visivelPublico: false,
      papel: 'intermediaria',
    });

    const [registro] = await a.trilha('fluxo.ajustar_etapa');
    expect(registro?.registro_id).toBe(String(etapa.id));
  });

  it('não permite rótulo público fora do fluxo de Demanda, nem nome repetido', async () => {
    const { cookieSupervisor } = await preparar();
    const tarefa = await fluxo(cookieSupervisor, 'tarefa');
    const andamento = tarefa.etapas.find((e) => e.nomeInterno === 'Em andamento')!;

    const publico = await a.chamar('PATCH', `/api/fluxos/etapas/${andamento.id}`, {
      cookie: cookieSupervisor,
      corpo: { rotuloPublico: 'Aberto' },
    });
    expect(publico.statusCode).toBe(400);

    const repetido = await a.chamar('PATCH', `/api/fluxos/etapas/${andamento.id}`, {
      cookie: cookieSupervisor,
      corpo: { nomeInterno: 'A fazer' },
    });
    expect(repetido.statusCode).toBe(409);
  });

  it('o Assessor e o Parlamentar não ajustam (404); o papel não é alterável pela API', async () => {
    const { cookieAssessor, cookieParlamentar, cookieSupervisor } = await preparar();
    const etapa = (await fluxo(cookieSupervisor, 'tarefa')).etapas[1]!;
    for (const cookie of [cookieAssessor, cookieParlamentar]) {
      expect(
        (await a.chamar('PATCH', `/api/fluxos/etapas/${etapa.id}`, { cookie, corpo: { ordem: 3 } }))
          .statusCode,
      ).toBe(404);
    }
    const papel = await a.chamar('PATCH', `/api/fluxos/etapas/${etapa.id}`, {
      cookie: cookieSupervisor,
      corpo: { papel: 'conclusao', nomeInterno: 'Mesmo nome' },
    });
    expect(papel.json().papel).toBe('intermediaria');
  });
});

describe('estruturar (Administrador)', () => {
  it('cria etapa Intermediária ou de Conclusão e a desativa, mas não mexe em Entrada nem Arquivamento', async () => {
    const { cookieAdmin, cookieSupervisor } = await preparar();

    const criada = await a.chamar('POST', '/api/fluxos/tarefa/etapas', {
      cookie: cookieAdmin,
      corpo: { nomeInterno: 'Aguardando retorno', papel: 'intermediaria' },
    });
    expect(criada.statusCode).toBe(201);
    expect(criada.json()).toMatchObject({ ordem: 5, papel: 'intermediaria', situacao: 'ativa' });

    const desativada = await a.chamar('PUT', `/api/fluxos/etapas/${criada.json().id}/situacao`, {
      cookie: cookieAdmin,
      corpo: { situacao: 'inativa' },
    });
    expect(desativada.json().situacao).toBe('inativa');

    const tarefa = await fluxo(cookieAdmin, 'tarefa');
    const entrada = tarefa.etapas.find((e) => e.papel === 'entrada')!;
    const arquivamento = tarefa.etapas.find((e) => e.papel === 'arquivamento')!;
    for (const e of [entrada, arquivamento]) {
      const r = await a.chamar('PUT', `/api/fluxos/etapas/${e.id}/situacao`, {
        cookie: cookieAdmin,
        corpo: { situacao: 'inativa' },
      });
      expect(r.statusCode).toBe(409);
      expect(r.json().mensagem).toMatch(/não podem ser desativadas/);
    }

    const segundaEntrada = await a.chamar('POST', '/api/fluxos/tarefa/etapas', {
      cookie: cookieAdmin,
      corpo: { nomeInterno: 'Outra entrada', papel: 'entrada' },
    });
    expect(segundaEntrada.statusCode).toBe(400);

    expect(
      (
        await a.chamar('POST', '/api/fluxos/tarefa/etapas', {
          cookie: cookieSupervisor,
          corpo: { nomeInterno: 'X', papel: 'conclusao' },
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (
        await a.chamar('POST', '/api/fluxos/inexistente/etapas', {
          cookie: cookieAdmin,
          corpo: { nomeInterno: 'X', papel: 'conclusao' },
        })
      ).statusCode,
    ).toBe(404);
  });

  it('não desativa a única Conclusão ativa', async () => {
    const { cookieAdmin } = await preparar();
    const conclusao = (await fluxo(cookieAdmin, 'tarefa')).etapas.find(
      (e) => e.papel === 'conclusao',
    )!;
    const r = await a.chamar('PUT', `/api/fluxos/etapas/${conclusao.id}/situacao`, {
      cookie: cookieAdmin,
      corpo: { situacao: 'inativa' },
    });
    expect(r.statusCode).toBe(409);
    expect(r.json().mensagem).toMatch(/Conclusão/);
  });

  it('etapa de Demanda criada pode ter rótulo e visibilidade públicos', async () => {
    const { cookieAdmin } = await preparar();
    const r = await a.chamar('POST', '/api/fluxos/demanda/etapas', {
      cookie: cookieAdmin,
      corpo: {
        nomeInterno: 'Aguardando documentos',
        papel: 'intermediaria',
        rotuloPublico: 'Em andamento',
        visivelPublico: true,
        prazoPadraoDias: 10,
      },
    });
    expect(r.statusCode, r.body).toBe(201);
    expect(r.json()).toMatchObject({
      rotuloPublico: 'Em andamento',
      visivelPublico: true,
      prazoPadraoDias: 10,
    });
  });
});
