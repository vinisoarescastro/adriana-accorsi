/* eslint-disable @typescript-eslint/no-explicit-any -- corpos JSON das respostas, sem tipo */
import { lerAcompanhamento } from '@gabinete/banco/publico';
import { afterEach, describe, expect, inject, it } from 'vitest';
import { hashDoSegredoDeLink } from '../demandas/link.js';
import { iniciarAmbiente, type Ambiente } from '../teste/auxiliares.js';

let a: Ambiente;
afterEach(async () => {
  await a.encerrar();
});

async function preparar() {
  a = await iniciarAmbiente(inject('urlAdminDeTeste'));
  const admin = await a.criarUsuario({ perfil: 'administrador' });
  const chefe = await a.criarUsuario({ perfil: 'chefe', habilitacoes: ['AT'] });
  const supervisor = await a.criarUsuario({ perfil: 'supervisor', habilitacoes: ['AT'] });
  const interno = await a.criarUsuario({ perfil: 'assessor_interno', habilitacoes: ['AT'] });
  const externo = await a.criarUsuario({ perfil: 'assessor_externo', habilitacoes: ['AT'] });
  return {
    cookie: {
      admin: await a.sessaoDe(admin.email),
      chefe: await a.sessaoDe(chefe.email),
      supervisor: await a.sessaoDe(supervisor.email),
      interno: await a.sessaoDe(interno.email),
      externo: await a.sessaoDe(externo.email),
    },
  };
}

const registrar = async (cookie: string, extra: object = {}) => {
  const r = await a.chamar('POST', '/api/demandas', {
    cookie,
    corpo: {
      solicitante: { nome: 'Maria da Silva', telefone: '(67) 99999-0000' },
      titulo: 'Poda de árvore na Rua das Flores',
      ...extra,
    },
  });
  expect(r.statusCode, r.body).toBe(201);
  return r.json() as { demanda: Record<string, any>; linkDeAcompanhamento: string };
};

const segredoDe = (link: string) => link.split('/a/')[1] as string;

describe('política de publicação (RN-PUB-02, 03)', () => {
  const nova = {
    exibirTitulo: true,
    exibicaoNome: 'completo',
    exibicaoTelefone: 'mascarado',
    expiracaoDias: 30,
  };

  it('a versão inicial é restritiva; só o Administrador altera; cada alteração abre uma versão e fecha a anterior', async () => {
    const { cookie } = await preparar();
    const inicial = (
      await a.chamar('GET', '/api/publicacao/politica', { cookie: cookie.interno })
    ).json();
    expect(inicial.vigente).toMatchObject({
      exibirTitulo: false,
      exibicaoNome: 'primeiro_nome',
      exibicaoTelefone: 'nao_exibir',
      expiracaoDias: 90,
      vigenteAte: null,
    });

    for (const quem of ['chefe', 'supervisor', 'interno', 'externo'] as const) {
      const r = await a.chamar('PUT', '/api/publicacao/politica', {
        cookie: cookie[quem],
        corpo: nova,
      });
      expect(r.statusCode, quem).toBe(404);
    }
    expect(
      (await a.chamar('GET', '/api/publicacao/politica', { cookie: cookie.externo })).statusCode,
    ).toBe(404);

    const r = await a.chamar('PUT', '/api/publicacao/politica', {
      cookie: cookie.admin,
      corpo: nova,
    });
    expect(r.statusCode, r.body).toBe(200);
    const depois = r.json();
    expect(depois.vigente).toMatchObject(nova);
    expect(depois.anteriores).toHaveLength(1);
    expect(depois.anteriores[0].vigenteAte).not.toBeNull();
    expect(depois.anteriores[0].exibirTitulo).toBe(false);

    const trilha = await a.trilha('publicacao.alterar_politica');
    expect(trilha).toHaveLength(1);
  });

  it('recusa expiração fora de 7 a 1.825 dias, valores inválidos e alteração sem mudança', async () => {
    const { cookie } = await preparar();
    const enviar = (corpo: object) =>
      a.chamar('PUT', '/api/publicacao/politica', { cookie: cookie.admin, corpo });
    expect((await enviar({ ...nova, expiracaoDias: 6 })).statusCode).toBe(400);
    expect((await enviar({ ...nova, expiracaoDias: 1826 })).statusCode).toBe(400);
    expect((await enviar({ ...nova, exibicaoNome: 'tudo' })).statusCode).toBe(400);
    expect((await enviar({ ...nova, expiracaoDias: 7 })).statusCode).toBe(200);
    expect((await enviar({ ...nova, expiracaoDias: 7 })).statusCode).toBe(409);
  });
});

describe('link de acompanhamento e pré-visualização (RN-PUB-04, 05, 06)', () => {
  it('o Assessor Interno obtém o link e a prévia; o Externo não alcança', async () => {
    const { cookie } = await preparar();
    const { demanda, linkDeAcompanhamento } = await registrar(cookie.interno);
    const r = await a.chamar('GET', `/api/demandas/${demanda.id}/acompanhamento`, {
      cookie: cookie.interno,
    });
    expect(r.statusCode).toBe(200);
    const corpo = r.json();
    expect(corpo.estado).toBe('ativa');
    expect(corpo.link).toBe(linkDeAcompanhamento);
    expect(corpo.previa).toMatchObject({
      protocolo: demanda.protocolo,
      situacao: 'em_andamento',
      nome: 'Maria',
    });
    expect(corpo.previa.titulo).toBeNull();
    expect(corpo.previa.telefone).toBeNull();

    expect(
      (
        await a.chamar('GET', `/api/demandas/${demanda.id}/acompanhamento`, {
          cookie: cookie.externo,
        })
      ).statusCode,
    ).toBe(404);
  });

  it('a prévia é EXATAMENTE a projeção que o cidadão recebe (mesma função, mesmas visões)', async () => {
    const { cookie } = await preparar();
    const { demanda, linkDeAcompanhamento } = await registrar(cookie.interno);
    await a.chamar('POST', `/api/demandas/${demanda.id}/andamentos`, {
      cookie: cookie.interno,
      corpo: { texto: 'Equipe vistoriou o local.' },
    });
    const previa = (
      await a.chamar('GET', `/api/demandas/${demanda.id}/acompanhamento`, {
        cookie: cookie.interno,
      })
    ).json().previa;
    const doCidadao = await lerAcompanhamento(a.banco.conectar('publico').cliente, {
      segredoHash: hashDoSegredoDeLink(segredoDe(linkDeAcompanhamento)),
    });
    expect(doCidadao).toEqual(previa);
    expect(doCidadao!.andamentos.map((x) => x.texto)).toEqual(['Equipe vistoriou o local.']);
  });

  it('só o Supervisor gere o link; revogar apaga o segredo; regenerar dá outro; o segredo nunca vai à trilha', async () => {
    const { cookie } = await preparar();
    const { demanda, linkDeAcompanhamento } = await registrar(cookie.interno);
    const base = `/api/demandas/${demanda.id}/link`;
    for (const acao of ['revogar', 'regenerar', 'suspender', 'retomar']) {
      expect(
        (await a.chamar('POST', `${base}/${acao}`, { cookie: cookie.interno })).statusCode,
        acao,
      ).toBe(404);
    }

    const publico = a.banco.conectar('publico').cliente;
    const pelaChave = (link: string) =>
      lerAcompanhamento(publico, { segredoHash: hashDoSegredoDeLink(segredoDe(link)) });
    expect(await pelaChave(linkDeAcompanhamento)).not.toBeNull();

    // Suspender fecha; retomar reabre com o MESMO link.
    const suspenso = (
      await a.chamar('POST', `${base}/suspender`, { cookie: cookie.supervisor })
    ).json();
    expect(suspenso.estado).toBe('suspensa');
    expect(suspenso.previa).toBeNull();
    expect(await pelaChave(linkDeAcompanhamento)).toBeNull();
    expect(
      (await a.chamar('POST', `${base}/suspender`, { cookie: cookie.supervisor })).statusCode,
    ).toBe(409);
    const retomado = (
      await a.chamar('POST', `${base}/retomar`, { cookie: cookie.supervisor })
    ).json();
    expect(retomado.link).toBe(linkDeAcompanhamento);
    expect(await pelaChave(linkDeAcompanhamento)).not.toBeNull();

    // Revogar: o segredo some; a equipe não obtém mais o link; a prévia (via protocolo) segue.
    const revogado = (
      await a.chamar('POST', `${base}/revogar`, { cookie: cookie.supervisor })
    ).json();
    expect(revogado).toMatchObject({ estado: 'revogada', link: null });
    expect(revogado.previa).not.toBeNull();
    expect(await pelaChave(linkDeAcompanhamento)).toBeNull();
    expect(
      (await a.chamar('POST', `${base}/revogar`, { cookie: cookie.supervisor })).statusCode,
    ).toBe(409);

    // Regenerar reabre com outro segredo; o antigo continua morto.
    const novo = (
      await a.chamar('POST', `${base}/regenerar`, { cookie: cookie.supervisor })
    ).json();
    expect(novo.estado).toBe('ativa');
    expect(novo.link).not.toBe(linkDeAcompanhamento);
    expect(await pelaChave(novo.link)).not.toBeNull();
    expect(await pelaChave(linkDeAcompanhamento)).toBeNull();

    const trilhaToda = JSON.stringify(await a.trilha());
    expect(trilhaToda).not.toContain(segredoDe(linkDeAcompanhamento));
    expect(trilhaToda).not.toContain(segredoDe(novo.link));
    expect((await a.trilha('link.revogar')).length).toBe(1);
  });

  it('a gestão do link segue possível depois do cancelamento (revogar é segurança)', async () => {
    const { cookie } = await preparar();
    const { demanda } = await registrar(cookie.interno);
    await a.chamar('POST', `/api/demandas/${demanda.id}/cancelar`, {
      cookie: cookie.supervisor,
      corpo: { justificativa: 'Pedido duplicado do cidadão' },
    });
    const r = await a.chamar('POST', `/api/demandas/${demanda.id}/link/revogar`, {
      cookie: cookie.supervisor,
    });
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().previa.situacao).toBe('cancelada');
  });
});

describe('andamentos publicáveis (RN-PUB-07, 08)', () => {
  it('o Interno publica; o Supervisor remove; some da prévia, mas a linha e o texto ficam na trilha', async () => {
    const { cookie } = await preparar();
    const { demanda } = await registrar(cookie.interno);
    const publicar = (texto: string, quem: 'interno' | 'externo' = 'interno') =>
      a.chamar('POST', `/api/demandas/${demanda.id}/andamentos`, {
        cookie: cookie[quem],
        corpo: { texto },
      });
    expect((await publicar('Equipe vistoriou o local.', 'externo')).statusCode).toBe(404);
    expect((await publicar('   ')).statusCode).toBe(400);
    expect((await publicar('x'.repeat(601))).statusCode).toBe(400);

    const criado = await publicar('Equipe vistoriou o local.');
    expect(criado.statusCode).toBe(201);
    const [andamento] = criado.json();
    expect(andamento).toMatchObject({ texto: 'Equipe vistoriou o local.', removido: false });

    expect(
      (await a.chamar('DELETE', `/api/andamentos/${andamento.id}`, { cookie: cookie.interno }))
        .statusCode,
    ).toBe(404);
    const removido = await a.chamar('DELETE', `/api/andamentos/${andamento.id}`, {
      cookie: cookie.supervisor,
    });
    expect(removido.statusCode).toBe(200);
    expect(removido.json()[0]).toMatchObject({
      removido: true,
      texto: 'Equipe vistoriou o local.',
    });
    expect(
      (await a.chamar('DELETE', `/api/andamentos/${andamento.id}`, { cookie: cookie.supervisor }))
        .statusCode,
    ).toBe(409);

    const previa = (
      await a.chamar('GET', `/api/demandas/${demanda.id}/acompanhamento`, {
        cookie: cookie.interno,
      })
    ).json().previa;
    expect(previa.andamentos).toEqual([]);
    const textosNaTrilha = (await a.trilha()).filter((t: any) =>
      t.operacao.startsWith('andamento.'),
    );
    expect(textosNaTrilha.map((t: any) => t.operacao).sort()).toEqual([
      'andamento.publicar',
      'andamento.remover',
    ]);
    expect(JSON.stringify(textosNaTrilha)).toContain('Equipe vistoriou o local.');
  });

  it('demanda cancelada não recebe andamento', async () => {
    const { cookie } = await preparar();
    const { demanda } = await registrar(cookie.interno);
    await a.chamar('POST', `/api/demandas/${demanda.id}/cancelar`, {
      cookie: cookie.supervisor,
      corpo: { justificativa: 'Pedido duplicado do cidadão' },
    });
    const r = await a.chamar('POST', `/api/demandas/${demanda.id}/andamentos`, {
      cookie: cookie.interno,
      corpo: { texto: 'Tarde demais.' },
    });
    expect(r.statusCode).toBe(409);
  });

  it('não existe rota que publique comentário, documento ou prioridade (critério 5)', async () => {
    await preparar();
    const rotas = [...((a.app as any).routes?.keys?.() ?? [])];
    void rotas;
    const impressas: string = a.app.printRoutes({ commonPrefix: false });
    for (const proibida of [
      'publicar-comentario',
      'comentarios/publicar',
      'documentos/publicar',
      'prioridade/publicar',
    ]) {
      expect(impressas).not.toContain(proibida);
    }
    // O único jeito de uma frase chegar ao cidadão é "andamentos", escrito de propósito.
    expect(impressas).toContain('andamentos');
  });
});
