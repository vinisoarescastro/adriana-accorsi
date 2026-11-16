/* eslint-disable @typescript-eslint/no-explicit-any -- corpos JSON das respostas, sem tipo */
import { afterEach, describe, expect, it } from 'vitest';
import { a, etapaPor, preparar, registrar } from '../demandas/auxiliares-de-demandas.js';

afterEach(async () => {
  await a.encerrar();
});

const etapaDeTarefa = async (cookie: string, nome: string): Promise<number> => {
  const r = (await a.chamar('GET', '/api/tarefas/etapas', { cookie })).json();
  return r.find((e: any) => e.nome === nome).id;
};

const criar = (cookie: string, corpo: object) =>
  a.chamar('POST', '/api/tarefas', {
    cookie,
    corpo: { titulo: 'Ligar para a prefeitura', ...corpo },
  });

describe('criar tarefa', () => {
  it('cria para si, entra na primeira etapa e grava movimentação e trilha', async () => {
    const e = await preparar();
    const r = await criar(e.cookie.interno, { prazo: '2026-12-01' });
    expect(r.statusCode, r.body).toBe(201);
    const t = r.json();
    expect(t).toMatchObject({
      titulo: 'Ligar para a prefeitura',
      status: 'em_andamento',
      etapa: { nome: 'A fazer', papel: 'entrada' },
      responsavel: { id: e.id.interno },
      atrasada: false,
    });
    expect(t.movimentacoes).toHaveLength(1);
    expect((await a.trilha('tarefa.criar')).length).toBe(1);
  });

  it('exige título e recusa prazo anterior a hoje na criação (alterar depois pode)', async () => {
    const e = await preparar();
    expect((await criar(e.cookie.interno, { titulo: '   ' })).statusCode).toBe(400);
    expect((await criar(e.cookie.interno, { prazo: '2026-11-11' })).statusCode).toBe(409);
    const t = (await criar(e.cookie.interno, { prazo: '2026-11-12' })).json();
    const r = await a.chamar('PATCH', `/api/tarefas/${t.id}`, {
      cookie: e.cookie.interno,
      corpo: { prazo: '2026-01-01' },
    });
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().atrasada).toBe(true);
  });

  it('o Assessor Externo cria só para si; designar outra pessoa exige Assessor Interno', async () => {
    const e = await preparar();
    expect((await criar(e.cookie.externo, {})).statusCode).toBe(201);
    expect((await criar(e.cookie.externo, { responsavelId: e.id.interno })).statusCode).toBe(403);
    const r = await criar(e.cookie.interno, { responsavelId: e.id.externo });
    expect(r.statusCode, r.body).toBe(201);
    expect(r.json().responsavel.id).toBe(e.id.externo);
  });

  it('o responsável precisa ser um usuário ativo', async () => {
    const e = await preparar();
    expect((await criar(e.cookie.interno, { responsavelId: 999_999 })).statusCode).toBe(409);
  });
});

describe('vínculo e alcance', () => {
  it('vincula a uma demanda que o autor alcança e filtra a lista pelo vínculo', async () => {
    const e = await preparar();
    const d = (await registrar(e.cookie.interno)).demanda;
    const r = await criar(e.cookie.interno, { vinculo: { tipo: 'demanda', id: d.id } });
    expect(r.statusCode, r.body).toBe(201);
    expect(r.json().vinculo).toEqual({ tipo: 'demanda', id: d.id });
    await criar(e.cookie.interno, {});
    const lista = (
      await a.chamar('GET', `/api/tarefas?vinculoTipo=demanda&vinculoId=${d.id}`, {
        cookie: e.cookie.interno,
      })
    ).json();
    expect(lista.total).toBe(1);
  });

  it('o Assessor Externo não vincula a demanda de outro, nem recebe tarefa de demanda alheia', async () => {
    const e = await preparar();
    const d = (await registrar(e.cookie.interno)).demanda; // do Interno
    expect(
      (await criar(e.cookie.externo, { vinculo: { tipo: 'demanda', id: d.id } })).statusCode,
    ).toBe(404);
    // O Interno tenta passar ao Externo uma tarefa ligada a uma demanda que não é do Externo.
    const r = await criar(e.cookie.interno, {
      responsavelId: e.id.externo,
      vinculo: { tipo: 'demanda', id: d.id },
    });
    expect(r.statusCode).toBe(409);
  });

  it('vínculo inexistente ou demanda cancelada é recusado', async () => {
    const e = await preparar();
    expect(
      (await criar(e.cookie.interno, { vinculo: { tipo: 'demanda', id: 999_999 } })).statusCode,
    ).toBe(404);
    const d = (await registrar(e.cookie.interno)).demanda;
    await a.chamar('POST', `/api/demandas/${d.id}/cancelar`, {
      cookie: e.cookie.supervisor,
      corpo: { justificativa: 'Cadastro em duplicidade' },
    });
    expect(
      (await criar(e.cookie.interno, { vinculo: { tipo: 'demanda', id: d.id } })).statusCode,
    ).toBe(409);
  });

  it('o Assessor Externo vê só as tarefas dele; a de outro é "não encontrada"', async () => {
    const e = await preparar();
    const minha = (await criar(e.cookie.externo, {})).json();
    const alheia = (await criar(e.cookie.interno, {})).json();
    const lista = (await a.chamar('GET', '/api/tarefas', { cookie: e.cookie.externo })).json();
    expect(lista.itens.map((t: any) => t.id)).toEqual([minha.id]);
    expect(
      (await a.chamar('GET', `/api/tarefas/${alheia.id}`, { cookie: e.cookie.externo })).statusCode,
    ).toBe(404);
    expect(
      (
        await a.chamar('PATCH', `/api/tarefas/${alheia.id}`, {
          cookie: e.cookie.externo,
          corpo: { titulo: 'x' },
        })
      ).statusCode,
    ).toBe(404);
    const todas = (await a.chamar('GET', '/api/tarefas', { cookie: e.cookie.supervisor })).json();
    expect(todas.total).toBe(2);
  });
});

describe('mover, reabrir, reatribuir e cancelar', () => {
  it('o responsável move; quem não é responsável nem Supervisor não', async () => {
    const e = await preparar();
    const t = (await criar(e.cookie.interno, {})).json();
    const andamento = await etapaDeTarefa(e.cookie.interno, 'Em andamento');
    const outroInterno = await a.criarUsuario({ perfil: 'assessor_interno' });
    const cookieOutro = await a.sessaoDe(outroInterno.email);
    const negado = await a.chamar('POST', `/api/tarefas/${t.id}/mover`, {
      cookie: cookieOutro,
      corpo: { etapaId: andamento },
    });
    expect(negado.statusCode).toBe(403);
    const ok = await a.chamar('POST', `/api/tarefas/${t.id}/mover`, {
      cookie: e.cookie.interno,
      corpo: { etapaId: andamento, observacao: 'Comecei' },
    });
    expect(ok.statusCode, ok.body).toBe(200);
    expect(ok.json().etapa.nome).toBe('Em andamento');
    expect(ok.json().movimentacoes).toHaveLength(2);
    // O Supervisor move qualquer uma.
    const concluida = await etapaDeTarefa(e.cookie.supervisor, 'Concluída');
    expect(
      (
        await a.chamar('POST', `/api/tarefas/${t.id}/mover`, {
          cookie: e.cookie.supervisor,
          corpo: { etapaId: concluida },
        })
      ).json().status,
    ).toBe('concluido');
  });

  it('só o Supervisor reabre uma tarefa concluída', async () => {
    const e = await preparar();
    const t = (await criar(e.cookie.interno, {})).json();
    const concluida = await etapaDeTarefa(e.cookie.interno, 'Concluída');
    const andamento = await etapaDeTarefa(e.cookie.interno, 'Em andamento');
    await a.chamar('POST', `/api/tarefas/${t.id}/mover`, {
      cookie: e.cookie.interno,
      corpo: { etapaId: concluida },
    });
    const recusado = await a.chamar('POST', `/api/tarefas/${t.id}/mover`, {
      cookie: e.cookie.interno,
      corpo: { etapaId: andamento },
    });
    expect(recusado.statusCode).toBe(403);
    const ok = await a.chamar('POST', `/api/tarefas/${t.id}/mover`, {
      cookie: e.cookie.supervisor,
      corpo: { etapaId: andamento },
    });
    expect(ok.statusCode, ok.body).toBe(200);
    expect((await a.trilha('tarefa.reabrir')).length).toBe(1);
  });

  it('recusa etapa de outro fluxo e etapa igual à atual', async () => {
    const e = await preparar();
    const t = (await criar(e.cookie.interno, {})).json();
    const deDemanda = await etapaPor(e.cookie.interno, 'Em triagem').catch(() => 0);
    const recusa = await a.chamar('POST', `/api/tarefas/${t.id}/mover`, {
      cookie: e.cookie.interno,
      corpo: { etapaId: deDemanda || 1 },
    });
    expect([400, 409]).toContain(recusa.statusCode);
    const igual = await a.chamar('POST', `/api/tarefas/${t.id}/mover`, {
      cookie: e.cookie.interno,
      corpo: { etapaId: t.etapa.id },
    });
    expect(igual.statusCode).toBe(409);
  });

  it('concluir a última tarefa de uma demanda NÃO conclui a demanda', async () => {
    const e = await preparar();
    const d = (await registrar(e.cookie.interno)).demanda;
    const t = (await criar(e.cookie.interno, { vinculo: { tipo: 'demanda', id: d.id } })).json();
    await a.chamar('POST', `/api/tarefas/${t.id}/mover`, {
      cookie: e.cookie.interno,
      corpo: { etapaId: await etapaDeTarefa(e.cookie.interno, 'Concluída') },
    });
    const depois = (
      await a.chamar('GET', `/api/demandas/${d.id}`, { cookie: e.cookie.interno })
    ).json();
    expect(depois.status).toBe('em_andamento');
    expect(depois.etapa.papel).toBe(d.etapa.papel);
  });

  it('reatribuir exige Assessor Interno, avisa o novo responsável e não avisa quem reatribuiu', async () => {
    const e = await preparar();
    const t = (await criar(e.cookie.supervisor, {})).json();
    expect(
      (
        await a.chamar('POST', `/api/tarefas/${t.id}/reatribuir`, {
          cookie: e.cookie.externo,
          corpo: { responsavelId: e.id.externo },
        })
      ).statusCode,
    ).toBe(404);
    const r = await a.chamar('POST', `/api/tarefas/${t.id}/reatribuir`, {
      cookie: e.cookie.supervisor,
      corpo: { responsavelId: e.id.interno },
    });
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().responsavel.id).toBe(e.id.interno);
    const { cliente } = a.banco.conectar('api');
    const avisos = await cliente<{ destinatario_id: string; natureza: string }[]>`
      SELECT destinatario_id, natureza FROM aviso ORDER BY id`;
    expect(avisos.map((v) => [Number(v.destinatario_id), v.natureza])).toEqual([
      [e.id.interno, 'tarefa_reatribuida'],
    ]);
    // O mesmo responsável é conflito.
    expect(
      (
        await a.chamar('POST', `/api/tarefas/${t.id}/reatribuir`, {
          cookie: e.cookie.supervisor,
          corpo: { responsavelId: e.id.interno },
        })
      ).statusCode,
    ).toBe(409);
  });

  it('designar a outra pessoa na criação avisa o designado', async () => {
    const e = await preparar();
    await criar(e.cookie.supervisor, { responsavelId: e.id.interno });
    await criar(e.cookie.supervisor, {}); // para si: sem aviso
    const { cliente } = a.banco.conectar('api');
    const avisos = await cliente<{ destinatario_id: string; natureza: string }[]>`
      SELECT destinatario_id, natureza FROM aviso`;
    expect(avisos).toHaveLength(1);
    expect(Number(avisos[0]!.destinatario_id)).toBe(e.id.interno);
    expect(avisos[0]!.natureza).toBe('tarefa_designada');
  });

  it('cancelar exige justificativa de 10 caracteres e deixa a tarefa só de leitura', async () => {
    const e = await preparar();
    const t = (await criar(e.cookie.interno, {})).json();
    expect(
      (
        await a.chamar('POST', `/api/tarefas/${t.id}/cancelar`, {
          cookie: e.cookie.interno,
          corpo: { justificativa: 'curta' },
        })
      ).statusCode,
    ).toBe(400);
    const r = await a.chamar('POST', `/api/tarefas/${t.id}/cancelar`, {
      cookie: e.cookie.interno,
      corpo: { justificativa: 'Já foi resolvido por telefone' },
    });
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().status).toBe('cancelada');
    for (const [metodo, url, corpo] of [
      ['PATCH', `/api/tarefas/${t.id}`, { titulo: 'x' }],
      ['POST', `/api/tarefas/${t.id}/cancelar`, { justificativa: 'Já foi resolvido por telefone' }],
      ['POST', `/api/tarefas/${t.id}/reatribuir`, { responsavelId: e.id.supervisor }],
    ] as const) {
      expect((await a.chamar(metodo, url, { cookie: e.cookie.supervisor, corpo })).statusCode).toBe(
        409,
      );
    }
  });
});

describe('listagem', () => {
  it('filtra por status, atraso, responsável e "minhas", e pagina', async () => {
    const e = await preparar();
    const t1 = (await criar(e.cookie.interno, { prazo: '2026-11-12', titulo: 'Poda' })).json();
    await criar(e.cookie.supervisor, { titulo: 'Ofício' });
    await a.chamar('PATCH', `/api/tarefas/${t1.id}`, {
      cookie: e.cookie.interno,
      corpo: { prazo: '2026-10-01' },
    });
    const get = async (q: string) =>
      (await a.chamar('GET', `/api/tarefas${q}`, { cookie: e.cookie.supervisor })).json();
    expect((await get('?atrasadas=true')).total).toBe(1);
    expect((await get('?minhas=true')).total).toBe(1);
    expect((await get(`?responsavelId=${e.id.interno}`)).total).toBe(1);
    expect((await get('?busca=ofício')).total).toBe(1);
    expect((await get('?status=concluido')).total).toBe(0);
    expect((await get('?porPagina=1')).itens).toHaveLength(1);
    expect(
      (await a.chamar('GET', '/api/tarefas?porPagina=500', { cookie: e.cookie.supervisor }))
        .statusCode,
    ).toBe(400);
  });
});
