/* eslint-disable @typescript-eslint/no-explicit-any -- corpos JSON das respostas, sem tipo */
import { afterEach, describe, expect, it } from 'vitest';
import { a, agenda, encerrar, hora, marcar, preparar } from './auxiliares-de-agenda.js';
import { nivelDeVisao } from './visibilidade.js';

afterEach(encerrar);

describe('regra de visibilidade (função pura)', () => {
  const c = (visibilidade: 'aberto' | 'participantes' | 'restrito') => ({
    visibilidade,
    criadorId: 1,
  });
  const ator = (perfil: any, usuarioId = 9) => ({ usuarioId, perfil });

  it('aberto: todos veem; participantes: só o conteúdo de quem participa ou vê tudo', () => {
    expect(nivelDeVisao(c('aberto'), ator('assessor_externo'), false)).toBe('completo');
    expect(nivelDeVisao(c('participantes'), ator('assessor_interno'), false)).toBe('ocupado');
    expect(nivelDeVisao(c('participantes'), ator('assessor_interno'), true)).toBe('completo');
    expect(nivelDeVisao(c('participantes'), ator('assessor_interno', 1), false)).toBe('completo');
    expect(nivelDeVisao(c('participantes'), ator('chefe'), false)).toBe('completo');
  });

  it('restrito: some para todos, exceto participantes, criador, Chefe, Administrador e Parlamentar', () => {
    expect(nivelDeVisao(c('restrito'), ator('supervisor'), false)).toBe('oculto');
    expect(nivelDeVisao(c('restrito'), ator('assessor_interno'), false)).toBe('oculto');
    expect(nivelDeVisao(c('restrito'), ator('assessor_interno'), true)).toBe('completo');
    expect(nivelDeVisao(c('restrito'), ator('supervisor', 1), false)).toBe('completo');
    for (const perfil of ['chefe', 'administrador', 'parlamentar']) {
      expect(nivelDeVisao(c('restrito'), ator(perfil), false)).toBe('completo');
    }
  });
});

describe('marcar compromisso', () => {
  it('nasce "participantes" e envolvendo a Parlamentar; exige título', async () => {
    const e = await preparar();
    const r = await marcar(e.cookie.interno);
    expect(r.statusCode, r.body).toBe(201);
    expect(r.json().compromisso).toMatchObject({
      visibilidade: 'participantes',
      envolveParlamentar: true,
      cancelado: false,
    });
    expect((await marcar(e.cookie.interno, { titulo: '  ' })).statusCode).toBe(400);
    expect((await marcar(e.cookie.interno, { inicio: hora(12), fim: hora(11) })).statusCode).toBe(
      400,
    );
    expect((await a.trilha('compromisso.criar')).length).toBe(1);
  });

  it('o Assessor Externo consulta, mas não marca; sem a habilitação de Agenda a rota some', async () => {
    const e = await preparar();
    expect((await marcar(e.cookie.externo)).statusCode).toBe(404);
    expect(
      (
        await a.chamar(
          'GET',
          `/api/agenda?de=${encodeURIComponent(hora(0))}&ate=${encodeURIComponent(hora(23))}`,
          { cookie: e.cookie.externo },
        )
      ).statusCode,
    ).toBe(200);
    expect((await marcar(e.cookie.semAgenda)).statusCode).toBe(404);
  });

  it('criar ou tornar Restrito exige Supervisor', async () => {
    const e = await preparar();
    expect((await marcar(e.cookie.interno, { visibilidade: 'restrito' })).statusCode).toBe(403);
    expect((await marcar(e.cookie.supervisor, { visibilidade: 'restrito' })).statusCode).toBe(201);
    const aberto = (await marcar(e.cookie.interno)).json().compromisso;
    const r = await a.chamar('PATCH', `/api/agenda/compromissos/${aberto.id}`, {
      cookie: e.cookie.interno,
      corpo: { visibilidade: 'restrito' },
    });
    expect(r.statusCode).toBe(403);
  });

  it('exige período na consulta e o limita', async () => {
    const e = await preparar();
    expect((await a.chamar('GET', '/api/agenda', { cookie: e.cookie.interno })).statusCode).toBe(
      400,
    );
    const longo = await a.chamar(
      'GET',
      `/api/agenda?de=${encodeURIComponent(hora(0, 1))}&ate=${encodeURIComponent('2027-03-01T00:00:00-03:00')}`,
      { cookie: e.cookie.interno },
    );
    expect(longo.statusCode).toBe(400);
  });
});

describe('visibilidade na agenda (critério 1: o Restrito não aparece, nem como ocupado)', () => {
  it('cada perfil vê o que a regra permite', async () => {
    const e = await preparar();
    await marcar(e.cookie.supervisor, {
      titulo: 'Aberto',
      visibilidade: 'aberto',
      inicio: hora(8),
      fim: hora(9),
    });
    await marcar(e.cookie.supervisor, {
      titulo: 'Entre participantes',
      visibilidade: 'participantes',
      inicio: hora(10),
      fim: hora(11),
      participantesInternos: [e.id.interno],
    });
    await marcar(e.cookie.supervisor, {
      titulo: 'Sigiloso',
      visibilidade: 'restrito',
      inicio: hora(14),
      fim: hora(15),
      participantesInternos: [e.id.interno2],
    });

    const titulos = (itens: any[]) =>
      itens.filter((i) => i.tipo === 'compromisso').map((i) => i.titulo);
    const ocupados = (itens: any[]) => itens.filter((i) => i.tipo === 'ocupado').length;

    // O Interno participa do 2º; do Restrito não sabe nada.
    const doInterno = await agenda(e.cookie.interno);
    expect(titulos(doInterno.itens)).toEqual(['Aberto', 'Entre participantes']);
    expect(ocupados(doInterno.itens)).toBe(0);
    expect(doInterno.itens).toHaveLength(2);

    // O Externo vê o Aberto e só o horário do de Participantes; nada do Restrito.
    const doExterno = await agenda(e.cookie.externo);
    expect(titulos(doExterno.itens)).toEqual(['Aberto']);
    expect(ocupados(doExterno.itens)).toBe(1);
    expect(doExterno.itens).toHaveLength(2);
    const ocupado = doExterno.itens.find((i) => i.tipo === 'ocupado');
    expect(Object.keys(ocupado).sort()).toEqual(['diaInteiro', 'fim', 'inicio', 'tipo']);
    expect(JSON.stringify(doExterno)).not.toContain('Sigiloso');
    expect(JSON.stringify(doExterno)).not.toContain('Entre participantes');

    // O participante do Restrito o vê; o Supervisor que o criou também.
    expect(titulos((await agenda(e.cookie.interno2)).itens)).toContain('Sigiloso');
    expect(titulos((await agenda(e.cookie.supervisor)).itens)).toContain('Sigiloso');
    // Chefe, Administrador e Parlamentar veem tudo.
    for (const perfil of ['chefe', 'admin', 'parlamentar'] as const) {
      expect(titulos((await agenda(e.cookie[perfil])).itens)).toEqual([
        'Aberto',
        'Entre participantes',
        'Sigiloso',
      ]);
    }
  });

  it('abrir um compromisso que não se vê por inteiro é "não encontrado"', async () => {
    const e = await preparar();
    const restrito = (await marcar(e.cookie.supervisor, { visibilidade: 'restrito' })).json()
      .compromisso;
    const reservado = (await marcar(e.cookie.supervisor, { visibilidade: 'participantes' })).json()
      .compromisso;
    const abrir = (cookie: string, id: number) =>
      a.chamar('GET', `/api/agenda/compromissos/${id}`, { cookie });
    expect((await abrir(e.cookie.interno, restrito.id)).statusCode).toBe(404);
    expect((await abrir(e.cookie.interno, reservado.id)).statusCode).toBe(404);
    expect((await abrir(e.cookie.chefe, restrito.id)).statusCode).toBe(200);
    // Nem alterar nem cancelar: responde como se não existisse.
    expect(
      (
        await a.chamar('PATCH', `/api/agenda/compromissos/${restrito.id}`, {
          cookie: e.cookie.interno,
          corpo: { titulo: 'x' },
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (
        await a.chamar('POST', `/api/agenda/compromissos/${restrito.id}/cancelar`, {
          cookie: e.cookie.interno,
        })
      ).statusCode,
    ).toBe(404);
  });

  it('os próximos respeitam a mesma regra', async () => {
    const e = await preparar();
    await marcar(e.cookie.supervisor, {
      titulo: 'Sigiloso',
      visibilidade: 'restrito',
      inicio: hora(14, 13),
      fim: hora(15, 13),
    });
    const r = (await a.chamar('GET', '/api/agenda/proximos', { cookie: e.cookie.interno })).json();
    expect(r.itens).toEqual([]);
    const c = (await a.chamar('GET', '/api/agenda/proximos', { cookie: e.cookie.chefe })).json();
    expect(c.itens).toHaveLength(1);
  });
});

describe('agenda da Parlamentar', () => {
  it('"minha agenda" mostra o que a envolve; desmarcar a retira; a agenda toda continua acessível', async () => {
    const e = await preparar();
    await marcar(e.cookie.interno, {
      titulo: 'Com a Deputada',
      visibilidade: 'aberto',
      inicio: hora(8),
      fim: hora(9),
    });
    await marcar(e.cookie.interno, {
      titulo: 'Só da equipe',
      visibilidade: 'aberto',
      inicio: hora(10),
      fim: hora(11),
      envolveParlamentar: false,
    });
    const minha = await agenda(e.cookie.parlamentar, '&minha=true');
    expect(minha.itens.map((i) => i.titulo)).toEqual(['Com a Deputada']);
    const toda = await agenda(e.cookie.parlamentar);
    expect(toda.itens.map((i) => i.titulo)).toEqual(['Com a Deputada', 'Só da equipe']);
  });

  it('a marca não gera aviso; só a indicação explícita gera, e permite resposta', async () => {
    const e = await preparar();
    await marcar(e.cookie.interno, { visibilidade: 'aberto' });
    const { cliente } = a.banco.conectar('api');
    expect(await cliente`SELECT 1 FROM aviso`).toHaveLength(0);

    const r = await marcar(e.cookie.interno, {
      visibilidade: 'aberto',
      participantesInternos: [e.id.parlamentar],
    });
    expect(r.statusCode, r.body).toBe(201);
    const avisos = await cliente<
      { destinatario_id: string; natureza: string }[]
    >`SELECT destinatario_id, natureza FROM aviso`;
    expect(avisos.map((v) => [Number(v.destinatario_id), v.natureza])).toEqual([
      [e.id.parlamentar, 'compromisso_indicacao'],
    ]);
    const resposta = await a.chamar(
      'POST',
      `/api/agenda/compromissos/${r.json().compromisso.id}/resposta`,
      {
        cookie: e.cookie.parlamentar,
        corpo: { resposta: 'confirmado' },
      },
    );
    expect(resposta.statusCode, resposta.body).toBe(200);
    expect(resposta.json().compromisso.minhaResposta).toBe('confirmado');
  });
});
