/* eslint-disable @typescript-eslint/no-explicit-any -- corpos JSON das respostas, sem tipo */
import { afterEach, describe, expect, it } from 'vitest';
import {
  a,
  categoriaPor,
  etapaDeProjeto,
  novoProjeto,
  preparar,
} from './auxiliares-de-projetos.js';

afterEach(async () => {
  await a.encerrar();
});

const post = (cookie: string, url: string, corpo: object) =>
  a.chamar('POST', url, { cookie, corpo });

describe('cadastrar projeto de lei', () => {
  it('nasce na Entrada do fluxo federal, com movimentação e trilha', async () => {
    const e = await preparar();
    const p = await novoProjeto(e.cookie.interno, { numero: 'PL 100/2026', prazo: '2026-12-01' });
    expect(p).toMatchObject({
      titulo: 'Programa de poda segura',
      numero: 'PL 100/2026',
      status: 'em_andamento',
      atrasado: false,
      etapa: { nome: 'Em redação', papel: 'entrada' },
      responsavel: { id: e.id.interno },
      tipoProposicao: { nome: 'Projeto de lei' },
    });
    expect(p.movimentacoes).toHaveLength(1);
    expect((await a.trilha('projeto.criar')).length).toBe(1);
  });

  it('título, ementa e autoria são obrigatórios', async () => {
    const e = await preparar();
    const tipo = await categoriaPor(e.cookie.interno, 'Projeto de lei');
    const base = { titulo: 'X', ementa: 'Y', autoria: 'Z', tipoProposicaoId: tipo };
    expect((await post(e.cookie.interno, '/api/projetos', base)).statusCode).toBe(201);
    for (const campo of ['titulo', 'ementa', 'autoria']) {
      const r = await post(e.cookie.interno, '/api/projetos', { ...base, [campo]: '   ' });
      expect(r.statusCode, campo).toBe(400);
    }
  });

  it('o número é único entre os ativos; sem número vale quantas vezes quiser; cancelar libera', async () => {
    const e = await preparar();
    const um = await novoProjeto(e.cookie.interno, { numero: 'PL 7/2026' });
    const tipo = await categoriaPor(e.cookie.interno, 'Projeto de lei');
    const repetido = await post(e.cookie.interno, '/api/projetos', {
      titulo: 'Outro',
      ementa: 'Outro projeto.',
      autoria: 'Dep. A',
      tipoProposicaoId: tipo,
      numero: 'pl 7/2026',
    });
    expect(repetido.statusCode).toBe(409);
    await novoProjeto(e.cookie.interno);
    await novoProjeto(e.cookie.interno);

    const cancelar = await post(e.cookie.supervisor, `/api/projetos/${um.id}/cancelar`, {
      justificativa: 'Cadastrado em duplicidade',
    });
    expect(cancelar.statusCode, cancelar.body).toBe(200);
    await novoProjeto(e.cookie.interno, { numero: 'PL 7/2026' });
  });

  it('recusa prazo anterior a hoje na criação; alterar depois pode', async () => {
    const e = await preparar();
    const tipo = await categoriaPor(e.cookie.interno, 'Projeto de lei');
    const corpo = { titulo: 'X', ementa: 'Y', autoria: 'Z', tipoProposicaoId: tipo };
    expect(
      (await post(e.cookie.interno, '/api/projetos', { ...corpo, prazo: '2026-11-11' })).statusCode,
    ).toBe(409);
    const p = await novoProjeto(e.cookie.interno, { prazo: '2026-11-12' });
    const r = await a.chamar('PATCH', `/api/projetos/${p.id}`, {
      cookie: e.cookie.interno,
      corpo: { prazo: '2026-01-01' },
    });
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().atrasado).toBe(true);
  });

  it('o tipo de proposição e os assuntos precisam existir, ser da natureza certa e estar ativos', async () => {
    const e = await preparar();
    const tipo = await categoriaPor(e.cookie.interno, 'Projeto de lei');
    const saude = await categoriaPor(e.cookie.interno, 'Saúde');
    const base = { titulo: 'X', ementa: 'Y', autoria: 'Z' };
    // Um assunto no lugar do tipo, e o tipo no lugar do assunto.
    expect(
      (await post(e.cookie.interno, '/api/projetos', { ...base, tipoProposicaoId: saude }))
        .statusCode,
    ).toBe(409);
    expect(
      (
        await post(e.cookie.interno, '/api/projetos', {
          ...base,
          tipoProposicaoId: tipo,
          assuntos: [tipo],
        })
      ).statusCode,
    ).toBe(409);
    const ok = await post(e.cookie.interno, '/api/projetos', {
      ...base,
      tipoProposicaoId: tipo,
      assuntos: [saude, saude],
      coautores: ['Fulano de Tal', 'fulano de tal', 'Beltrano'],
    });
    expect(ok.statusCode, ok.body).toBe(201);
    expect(ok.json().assuntos).toEqual([{ id: saude, nome: 'Saúde' }]);
    expect(ok.json().coautores.map((c: any) => c.nome)).toEqual(['Beltrano', 'Fulano de Tal']);

    // Categoria inativa deixa de ser aceita.
    await a.chamar('PUT', `/api/legislativo/categorias/${saude}/situacao`, {
      cookie: e.cookie.supervisor,
      corpo: { situacao: 'inativa' },
    });
    expect(
      (
        await post(e.cookie.interno, '/api/projetos', {
          ...base,
          tipoProposicaoId: tipo,
          assuntos: [saude],
        })
      ).statusCode,
    ).toBe(409);
  });

  it('o responsável precisa ser ativo, de nível Assessor Interno e ter a habilitação LG', async () => {
    const e = await preparar();
    const tipo = await categoriaPor(e.cookie.interno, 'Projeto de lei');
    const base = { titulo: 'X', ementa: 'Y', autoria: 'Z', tipoProposicaoId: tipo };
    const com = (responsavelId: number) =>
      post(e.cookie.interno, '/api/projetos', { ...base, responsavelId }).then((r) => r.statusCode);
    expect(await com(e.id.interno2)).toBe(201);
    expect(await com(e.id.semLegislativo)).toBe(409);
    expect(await com(e.id.externo)).toBe(409);
    expect(await com(999_999)).toBe(409);
  });
});

describe('mover pelo fluxo federal', () => {
  it('percorre as etapas do fluxo, com o histórico, e o status vem do papel da etapa', async () => {
    const e = await preparar();
    const p = await novoProjeto(e.cookie.interno);
    for (const [nome, status] of [
      ['Protocolado', 'em_andamento'],
      ['Na comissão de constituição e justiça', 'em_andamento'],
      ['Sancionado', 'concluido'],
      ['Arquivado', 'arquivado'],
    ] as const) {
      const r = await post(e.cookie.interno, `/api/projetos/${p.id}/mover`, {
        etapaId: await etapaDeProjeto(e.cookie.interno, nome),
        observacao: `Movido para ${nome}`,
      });
      if (nome === 'Arquivado') {
        // Quem sai de concluído para arquivado não reabre: é só encerrar de vez.
        expect(r.statusCode, r.body).toBe(200);
      }
      expect(r.json().status, nome).toBe(status);
    }
    const ficha = (
      await a.chamar('GET', `/api/projetos/${p.id}`, { cookie: e.cookie.interno })
    ).json();
    expect(ficha.movimentacoes.map((m: any) => m.para)).toEqual([
      'Em redação',
      'Protocolado',
      'Na comissão de constituição e justiça',
      'Sancionado',
      'Arquivado',
    ]);
  });

  it('recusa etapa de outro fluxo, etapa inativa e a mesma etapa', async () => {
    const e = await preparar();
    const p = await novoProjeto(e.cookie.interno);
    const tarefas = (
      await a.chamar('GET', '/api/tarefas/etapas', { cookie: e.cookie.interno })
    ).json();
    expect(
      (await post(e.cookie.interno, `/api/projetos/${p.id}/mover`, { etapaId: tarefas[0].id }))
        .statusCode,
    ).toBe(400);
    expect(
      (await post(e.cookie.interno, `/api/projetos/${p.id}/mover`, { etapaId: p.etapa.id }))
        .statusCode,
    ).toBe(409);
    const [protocolado] = await a.banco.conectar('api').cliente<
      { id: string }[]
    >`SELECT id FROM etapa WHERE nome_interno = 'Protocolado'`;
    await a.banco.conectar('api')
      .cliente`UPDATE etapa SET situacao = 'inativa' WHERE id = ${protocolado!.id}`;
    expect(
      (
        await post(e.cookie.interno, `/api/projetos/${p.id}/mover`, {
          etapaId: Number(protocolado!.id),
        })
      ).statusCode,
    ).toBe(409);
  });

  it('move o Supervisor ou o Assessor Interno responsável; outro Assessor Interno não', async () => {
    const e = await preparar();
    const p = await novoProjeto(e.cookie.interno);
    const protocolado = await etapaDeProjeto(e.cookie.interno, 'Protocolado');
    const emVotacao = await etapaDeProjeto(e.cookie.interno, 'Em votação');
    const na = await etapaDeProjeto(e.cookie.interno, 'Na casa revisora');
    expect(
      (await post(e.cookie.interno2, `/api/projetos/${p.id}/mover`, { etapaId: protocolado }))
        .statusCode,
    ).toBe(403);
    expect(
      (await post(e.cookie.interno, `/api/projetos/${p.id}/mover`, { etapaId: protocolado }))
        .statusCode,
    ).toBe(200);
    expect(
      (await post(e.cookie.supervisor, `/api/projetos/${p.id}/mover`, { etapaId: emVotacao }))
        .statusCode,
    ).toBe(200);
    expect(
      (await post(e.cookie.parlamentar, `/api/projetos/${p.id}/mover`, { etapaId: na })).statusCode,
    ).toBe(200);
  });

  it('reabrir um projeto encerrado é do Supervisor ou superior', async () => {
    const e = await preparar();
    const p = await novoProjeto(e.cookie.interno);
    const rejeitado = await etapaDeProjeto(e.cookie.interno, 'Rejeitado');
    const protocolado = await etapaDeProjeto(e.cookie.interno, 'Protocolado');
    await post(e.cookie.interno, `/api/projetos/${p.id}/mover`, { etapaId: rejeitado });
    expect(
      (await post(e.cookie.interno, `/api/projetos/${p.id}/mover`, { etapaId: protocolado }))
        .statusCode,
    ).toBe(403);
    const r = await post(e.cookie.supervisor, `/api/projetos/${p.id}/mover`, {
      etapaId: protocolado,
    });
    expect(r.statusCode, r.body).toBe(200);
    expect((await a.trilha('projeto.reabrir')).length).toBe(1);
  });
});

describe('reatribuir e cancelar', () => {
  it('reatribuir e cancelar são do Supervisor em diante; cancelar exige justificativa de 10 caracteres', async () => {
    const e = await preparar();
    const p = await novoProjeto(e.cookie.interno);
    expect(
      (
        await post(e.cookie.interno, `/api/projetos/${p.id}/reatribuir`, {
          responsavelId: e.id.interno2,
        })
      ).statusCode,
    ).toBe(404);
    const r = await post(e.cookie.supervisor, `/api/projetos/${p.id}/reatribuir`, {
      responsavelId: e.id.interno2,
    });
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().responsavel.id).toBe(e.id.interno2);
    expect(
      (
        await post(e.cookie.supervisor, `/api/projetos/${p.id}/reatribuir`, {
          responsavelId: e.id.interno2,
        })
      ).statusCode,
    ).toBe(409);

    expect(
      (
        await post(e.cookie.supervisor, `/api/projetos/${p.id}/cancelar`, {
          justificativa: 'curta',
        })
      ).statusCode,
    ).toBe(400);
    const cancelado = await post(e.cookie.supervisor, `/api/projetos/${p.id}/cancelar`, {
      justificativa: 'Retirado pela autora do projeto',
    });
    expect(cancelado.statusCode, cancelado.body).toBe(200);
    expect(cancelado.json()).toMatchObject({ status: 'cancelado', atrasado: false });
    expect((await a.trilha('projeto.cancelar')).length).toBe(1);
  });

  it('o projeto cancelado não se altera mais (nem por quem tem nível)', async () => {
    const e = await preparar();
    const p = await novoProjeto(e.cookie.interno);
    await post(e.cookie.supervisor, `/api/projetos/${p.id}/cancelar`, {
      justificativa: 'Retirado pela autora do projeto',
    });
    const etapa = await etapaDeProjeto(e.cookie.interno, 'Protocolado');
    expect(
      (await post(e.cookie.supervisor, `/api/projetos/${p.id}/mover`, { etapaId: etapa }))
        .statusCode,
    ).toBe(409);
    expect(
      (
        await a.chamar('PATCH', `/api/projetos/${p.id}`, {
          cookie: e.cookie.supervisor,
          corpo: { titulo: 'Novo' },
        })
      ).statusCode,
    ).toBe(409);
    expect(
      (
        await post(e.cookie.supervisor, `/api/projetos/${p.id}/cancelar`, {
          justificativa: 'Mais uma vez, outra justificativa',
        })
      ).statusCode,
    ).toBe(409);
  });
});

describe('quadro, consolidado e atrasados', () => {
  it('lista e filtra; o atraso é derivado na leitura e nunca gravado', async () => {
    const e = await preparar();
    const antigo = await novoProjeto(e.cookie.interno, {
      titulo: 'Projeto antigo',
      prazo: '2026-11-20',
    });
    await novoProjeto(e.cookie.interno, { titulo: 'Projeto em dia', prazo: '2027-01-10' });
    await novoProjeto(e.cookie.interno2, { titulo: 'Sem prazo' });

    let cookie = e.cookie.interno;
    const lista = async (q: string) =>
      (await a.chamar('GET', `/api/projetos?${q}`, { cookie })).json();
    expect((await lista('atrasados=true')).total).toBe(0);

    // O tempo passa: o mesmo registro vira atrasado, sem nenhuma escrita.
    a.relogio.avancar(30 * 24 * 3600 * 1000);
    cookie = await a.sessaoDe(e.contas.interno.email); // a sessão antiga expirou com o tempo
    const atrasados = await lista('atrasados=true');
    expect(atrasados.total).toBe(1);
    expect(atrasados.itens[0]).toMatchObject({ id: antigo.id, atrasado: true });
    expect((await lista('meus=true')).total).toBe(2);
    expect((await lista('busca=em%20dia')).total).toBe(1);

    // Concluir o projeto tira o atraso.
    await post(cookie, `/api/projetos/${antigo.id}/mover`, {
      etapaId: await etapaDeProjeto(cookie, 'Sancionado'),
    });
    expect((await lista('atrasados=true')).total).toBe(0);
    expect((await lista('status=concluido')).total).toBe(1);
    const colunas = await a.banco.conectar('api').cliente<
      { column_name: string }[]
    >`SELECT column_name FROM information_schema.columns WHERE table_name = 'projeto_lei'`;
    expect(colunas.map((c) => c.column_name)).not.toEqual(expect.arrayContaining(['status']));
    expect(colunas.map((c) => c.column_name)).not.toEqual(expect.arrayContaining(['atrasado']));
  });

  it('o consolidado conta por situação e por etapa', async () => {
    const e = await preparar();
    const um = await novoProjeto(e.cookie.interno, { prazo: '2026-11-13' });
    const dois = await novoProjeto(e.cookie.interno);
    await novoProjeto(e.cookie.interno2);
    a.relogio.avancar(5 * 24 * 3600 * 1000);
    const interno = await a.sessaoDe(e.contas.interno.email);
    const supervisor = await a.sessaoDe(e.contas.supervisor.email);
    await post(interno, `/api/projetos/${dois.id}/mover`, {
      etapaId: await etapaDeProjeto(interno, 'Sancionado'),
    });
    await post(supervisor, `/api/projetos/${um.id}/cancelar`, {
      justificativa: 'Cadastrado por engano mesmo',
    });
    const c = (await a.chamar('GET', '/api/projetos/consolidado', { cookie: interno })).json();
    expect(c).toMatchObject({
      emAndamento: 1,
      atrasados: 0,
      concluidos: 1,
      arquivados: 0,
      cancelados: 1,
      minhasEmAndamento: 0,
    });
    const emRedacao = c.porEtapa.find((x: any) => x.nome === 'Em redação');
    expect(emRedacao.total).toBe(1);
    expect(c.porEtapa.find((x: any) => x.nome === 'Sancionado').total).toBe(1);
  });
});

describe('quem alcança o legislativo', () => {
  it('sem a habilitação LG (ou sem nível), o módulo responde não encontrado, até para ler', async () => {
    const e = await preparar();
    const p = await novoProjeto(e.cookie.interno);
    const ler = (cookie: string, url: string) =>
      a.chamar('GET', url, { cookie }).then((r) => r.statusCode);
    for (const url of [
      '/api/projetos',
      '/api/projetos/etapas',
      '/api/projetos/consolidado',
      `/api/projetos/${p.id}`,
      '/api/legislativo/categorias',
    ]) {
      expect(await ler(e.cookie.interno, url), url).toBe(200);
      expect(await ler(e.cookie.semLegislativo, url), url).toBe(404);
      expect(await ler(e.cookie.financeiro, url), url).toBe(404);
      expect(await ler(e.cookie.externo, url), url).toBe(404);
    }
    const tipo = await categoriaPor(e.cookie.interno, 'Projeto de lei');
    const criar = await post(e.cookie.semLegislativo, '/api/projetos', {
      titulo: 'X',
      ementa: 'Y',
      autoria: 'Z',
      tipoProposicaoId: tipo,
    });
    expect(criar.statusCode).toBe(404);
  });

  it('os vocabulários são do Supervisor em diante, e não repetem nome', async () => {
    const e = await preparar();
    const novo = { natureza: 'assunto_projeto', nome: 'Turismo' };
    expect((await post(e.cookie.interno, '/api/legislativo/categorias', novo)).statusCode).toBe(
      404,
    );
    const criada = await post(e.cookie.supervisor, '/api/legislativo/categorias', novo);
    expect(criada.statusCode, criada.body).toBe(201);
    expect(
      (await post(e.cookie.supervisor, '/api/legislativo/categorias', { ...novo, nome: 'turismo' }))
        .statusCode,
    ).toBe(409);
  });
});
