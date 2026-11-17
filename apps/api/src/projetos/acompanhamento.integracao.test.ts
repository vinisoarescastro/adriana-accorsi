/* eslint-disable @typescript-eslint/no-explicit-any -- corpos JSON das respostas, sem tipo */
import { afterEach, describe, expect, it } from 'vitest';
import { a, categoriaPor, novoProjeto, preparar } from './auxiliares-de-projetos.js';

afterEach(async () => {
  await a.encerrar();
});

const enviar = (
  metodo: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  cookie: string,
  url: string,
  corpo?: object,
) => a.chamar(metodo, url, { cookie, ...(corpo ? { corpo } : {}) });

describe('comissões', () => {
  it('registra a tramitação por comissão, que aparece na ficha em ordem de data', async () => {
    const e = await preparar();
    const p = await novoProjeto(e.cookie.interno);
    await enviar('POST', e.cookie.interno, `/api/projetos/${p.id}/tramitacoes`, {
      comissao: 'Comissão de Saúde',
      data: '2026-11-20',
      parecer: 'Favorável, com emendas.',
    });
    const r = await enviar('POST', e.cookie.interno, `/api/projetos/${p.id}/tramitacoes`, {
      comissao: 'CCJC',
      data: '2026-11-10',
    });
    expect(r.statusCode, r.body).toBe(201);
    expect(r.json().tramitacoes).toMatchObject([
      { comissao: 'CCJC', data: '2026-11-10', parecer: null },
      { comissao: 'Comissão de Saúde', data: '2026-11-20', parecer: 'Favorável, com emendas.' },
    ]);
    const ficha = (
      await a.chamar('GET', `/api/projetos/${p.id}`, { cookie: e.cookie.interno })
    ).json();
    expect(ficha.tramitacoes).toHaveLength(2);
    expect((await a.trilha('projeto.tramitacao_registrar')).length).toBe(2);
  });

  it('exige comissão e data válida; edita o parecer e remove', async () => {
    const e = await preparar();
    const p = await novoProjeto(e.cookie.interno);
    const url = `/api/projetos/${p.id}/tramitacoes`;
    expect(
      (await enviar('POST', e.cookie.interno, url, { comissao: ' ', data: '2026-11-10' }))
        .statusCode,
    ).toBe(400);
    expect(
      (await enviar('POST', e.cookie.interno, url, { comissao: 'CCJC', data: '10/11/2026' }))
        .statusCode,
    ).toBe(400);
    const criada = (
      await enviar('POST', e.cookie.interno, url, { comissao: 'CCJC', data: '2026-11-10' })
    ).json();
    const tid = criada.tramitacoes[0].id;
    const editada = await enviar('PATCH', e.cookie.interno, `${url}/${tid}`, {
      parecer: 'Aprovado por unanimidade.',
    });
    expect(editada.statusCode, editada.body).toBe(200);
    expect(editada.json().tramitacoes[0].parecer).toBe('Aprovado por unanimidade.');
    const limpa = await enviar('PATCH', e.cookie.interno, `${url}/${tid}`, { parecer: null });
    expect(limpa.json().tramitacoes[0].parecer).toBeNull();
    const removida = await enviar('DELETE', e.cookie.interno, `${url}/${tid}`);
    expect(removida.json().tramitacoes).toHaveLength(0);
    expect((await enviar('DELETE', e.cookie.interno, `${url}/${tid}`)).statusCode).toBe(404);
  });

  it('uma tramitação de outro projeto não se altera por este', async () => {
    const e = await preparar();
    const um = await novoProjeto(e.cookie.interno);
    const dois = await novoProjeto(e.cookie.interno);
    const t = (
      await enviar('POST', e.cookie.interno, `/api/projetos/${um.id}/tramitacoes`, {
        comissao: 'CCJC',
        data: '2026-11-10',
      })
    ).json().tramitacoes[0];
    const r = await enviar(
      'DELETE',
      e.cookie.interno,
      `/api/projetos/${dois.id}/tramitacoes/${t.id}`,
    );
    expect(r.statusCode).toBe(404);
  });
});

describe('votações', () => {
  it('registra data e resultado, sem placar individual, e aparece na ficha', async () => {
    const e = await preparar();
    const p = await novoProjeto(e.cookie.interno);
    const url = `/api/projetos/${p.id}/votacoes`;
    const r = await enviar('POST', e.cookie.interno, url, {
      data: '2026-11-18',
      resultado: 'aprovado_com_emendas',
      local: 'Plenário',
    });
    expect(r.statusCode, r.body).toBe(201);
    expect(r.json().votacoes).toMatchObject([
      { data: '2026-11-18', resultado: 'aprovado_com_emendas', local: 'Plenário' },
    ]);
    // Placar e votos individuais não existem: o campo extra é ignorado, nunca guardado.
    const extra = await enviar('POST', e.cookie.interno, url, {
      data: '2026-11-19',
      resultado: 'rejeitado',
      votosFavoraveis: 300,
    });
    expect(extra.statusCode).toBe(201);
    expect(JSON.stringify(extra.json())).not.toContain('300');
    expect(
      (await enviar('POST', e.cookie.interno, url, { data: '2026-11-19', resultado: 'empate' }))
        .statusCode,
    ).toBe(400);
  });

  it('edita o resultado e remove', async () => {
    const e = await preparar();
    const p = await novoProjeto(e.cookie.interno);
    const url = `/api/projetos/${p.id}/votacoes`;
    const v = (
      await enviar('POST', e.cookie.interno, url, { data: '2026-11-18', resultado: 'adiado' })
    ).json().votacoes[0];
    const editada = await enviar('PATCH', e.cookie.interno, `${url}/${v.id}`, {
      resultado: 'aprovado',
    });
    expect(editada.json().votacoes[0].resultado).toBe('aprovado');
    expect(
      (await enviar('DELETE', e.cookie.interno, `${url}/${v.id}`)).json().votacoes,
    ).toHaveLength(0);
  });
});

describe('assuntos e coautores', () => {
  it('troca a lista inteira e grava a trilha', async () => {
    const e = await preparar();
    const p = await novoProjeto(e.cookie.interno);
    const saude = await categoriaPor(e.cookie.interno, 'Saúde');
    const educacao = await categoriaPor(e.cookie.interno, 'Educação');
    const r = await enviar('PUT', e.cookie.interno, `/api/projetos/${p.id}/assuntos`, {
      assuntos: [saude, educacao],
    });
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().assuntos.map((x: any) => x.nome)).toEqual(['Educação', 'Saúde']);
    const so = await enviar('PUT', e.cookie.interno, `/api/projetos/${p.id}/assuntos`, {
      assuntos: [educacao],
    });
    expect(so.json().assuntos).toHaveLength(1);
    expect(
      (
        await enviar('PUT', e.cookie.interno, `/api/projetos/${p.id}/assuntos`, {
          assuntos: [999999],
        })
      ).statusCode,
    ).toBe(409);

    const co = await enviar('PUT', e.cookie.interno, `/api/projetos/${p.id}/coautores`, {
      coautores: ['Fulano', 'Beltrano', 'FULANO'],
    });
    expect(co.json().coautores.map((c: any) => c.nome)).toEqual(['Beltrano', 'Fulano']);
    expect((await a.trilha('projeto.assuntos')).length).toBe(2);
    expect((await a.trilha('projeto.coautores')).length).toBe(1);
  });

  it('filtra a lista por assunto e por tipo de proposição', async () => {
    const e = await preparar();
    const saude = await categoriaPor(e.cookie.interno, 'Saúde');
    const requerimento = await categoriaPor(e.cookie.interno, 'Requerimento');
    await novoProjeto(e.cookie.interno, { assuntos: [saude] });
    await novoProjeto(e.cookie.interno, { tipoProposicaoId: requerimento });
    const lista = async (q: string) =>
      (await a.chamar('GET', `/api/projetos?${q}`, { cookie: e.cookie.interno })).json();
    expect((await lista(`assuntoId=${saude}`)).total).toBe(1);
    expect((await lista(`tipoProposicaoId=${requerimento}`)).total).toBe(1);
  });
});

describe('quem acompanha', () => {
  it('só o responsável, o Supervisor ou superior; outro Assessor Interno é recusado', async () => {
    const e = await preparar();
    const p = await novoProjeto(e.cookie.interno);
    const tramitacao = (cookie: string) =>
      enviar('POST', cookie, `/api/projetos/${p.id}/tramitacoes`, {
        comissao: 'CCJC',
        data: '2026-11-10',
      }).then((r) => r.statusCode);
    expect(await tramitacao(e.cookie.interno2)).toBe(403);
    expect(await tramitacao(e.cookie.interno)).toBe(201);
    expect(await tramitacao(e.cookie.supervisor)).toBe(201);
    expect(await tramitacao(e.cookie.parlamentar)).toBe(201);
    const votar = await enviar('POST', e.cookie.interno2, `/api/projetos/${p.id}/votacoes`, {
      data: '2026-11-18',
      resultado: 'aprovado',
    });
    expect(votar.statusCode).toBe(403);
  });

  it('projeto cancelado não recebe comissão, votação, assunto nem coautor', async () => {
    const e = await preparar();
    const p = await novoProjeto(e.cookie.interno);
    await enviar('POST', e.cookie.supervisor, `/api/projetos/${p.id}/cancelar`, {
      justificativa: 'Retirado pela autora do projeto',
    });
    expect(
      (
        await enviar('POST', e.cookie.supervisor, `/api/projetos/${p.id}/tramitacoes`, {
          comissao: 'CCJC',
          data: '2026-11-10',
        })
      ).statusCode,
    ).toBe(409);
    expect(
      (
        await enviar('POST', e.cookie.supervisor, `/api/projetos/${p.id}/votacoes`, {
          data: '2026-11-18',
          resultado: 'aprovado',
        })
      ).statusCode,
    ).toBe(409);
    expect(
      (
        await enviar('PUT', e.cookie.supervisor, `/api/projetos/${p.id}/coautores`, {
          coautores: ['A'],
        })
      ).statusCode,
    ).toBe(409);
  });
});
