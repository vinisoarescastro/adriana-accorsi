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
  const supervisor = await a.criarUsuario({ perfil: 'supervisor', habilitacoes: ['AT'] });
  const interno = await a.criarUsuario({ perfil: 'assessor_interno', habilitacoes: ['AT'] });
  const externo = await a.criarUsuario({ perfil: 'assessor_externo', habilitacoes: ['AT'] });
  const cookie = {
    admin: await a.sessaoDe(admin.email),
    supervisor: await a.sessaoDe(supervisor.email),
    interno: await a.sessaoDe(interno.email),
    externo: await a.sessaoDe(externo.email),
  };
  // Etapas: 1ª (entrada) e 3ª visíveis ao cidadão; a 2ª é interna; a última é a conclusão.
  const dono = a.banco.conectar('migracao').cliente;
  await dono`UPDATE etapa SET visivel_publico = false, rotulo_publico = NULL`;
  const etapas = await dono<{ id: number; papel: string }[]>`
    SELECT e.id, e.papel FROM etapa e JOIN tipo_processo t ON t.id = e.tipo_processo_id
    WHERE t.tipo = 'demanda' ORDER BY e.ordem`;
  const ids = etapas.map((e) => Number(e.id));
  await dono`UPDATE etapa SET visivel_publico = true, rotulo_publico = 'Recebida' WHERE id = ${ids[0]!}`;
  await dono`UPDATE etapa SET visivel_publico = true, rotulo_publico = 'Em análise' WHERE id = ${ids[2]!}`;
  const conclusao = etapas.find((e) => e.papel === 'conclusao')!;
  await dono`UPDATE etapa SET visivel_publico = true, rotulo_publico = 'Concluída' WHERE id = ${conclusao.id}`;
  return { cookie, etapa: { interna: ids[1]!, visivel: ids[2]!, conclusao: Number(conclusao.id) } };
}

const registrar = async (cookie: string, solicitante: object, titulo = 'Poda de árvore') => {
  const r = await a.chamar('POST', '/api/demandas', { cookie, corpo: { solicitante, titulo } });
  expect(r.statusCode, r.body).toBe(201);
  return r.json().demanda as Record<string, any>;
};

const comConsentimento = (extra: object = {}) => ({
  nome: 'Maria da Silva',
  telefone: '(67) 99999-0000',
  email: 'maria@exemplo.test',
  consentimento: { consentido: true, origem: 'atendimento_telefonico', versaoTexto: 1 },
  ...extra,
});

const envios = async () =>
  await a.banco.conectar('api').cliente<any[]>`
    SELECT evento, estado, payload, erro FROM envio_notificacao ORDER BY id`;

describe('consentimento (RN-NOT-01, 02, 03)', () => {
  it('começa desmarcado: sem consentimento, nada é enfileirado, mesmo com e-mail', async () => {
    const { cookie, etapa } = await preparar();
    const demanda = await registrar(cookie.interno, {
      nome: 'Maria',
      telefone: '(67) 99999-0000',
      email: 'maria@exemplo.test',
    });
    await a.chamar('POST', `/api/demandas/${demanda.id}/andamentos`, {
      cookie: cookie.interno,
      corpo: { texto: 'Vistoria feita.' },
    });
    await a.chamar('POST', `/api/demandas/${demanda.id}/mover`, {
      cookie: cookie.interno,
      corpo: { etapaId: etapa.conclusao },
    });
    expect(await envios()).toEqual([]);
  });

  it('registra com data, origem e versão do texto; exige e-mail e a versão vigente do texto', async () => {
    const { cookie } = await preparar();
    const pessoa = (
      await a.chamar('POST', '/api/pessoas', {
        cookie: cookie.interno,
        corpo: { nome: 'Maria', telefone: '(67) 99999-0000' },
      })
    ).json();
    const url = `/api/pessoas/${pessoa.id}/consentimento`;
    const dar = (cookieDe: string, corpo: object) =>
      a.chamar('PUT', url, { cookie: cookieDe, corpo });
    const sim = { consentido: true, origem: 'atendimento_telefonico', versaoTexto: 1 };

    expect((await dar(cookie.externo, sim)).statusCode).toBe(404);
    expect((await dar(cookie.interno, sim)).statusCode).toBe(409); // sem e-mail
    await a.chamar('PATCH', `/api/pessoas/${pessoa.id}`, {
      cookie: cookie.interno,
      corpo: { email: 'maria@exemplo.test' },
    });
    expect((await dar(cookie.interno, { ...sim, versaoTexto: 2 })).statusCode).toBe(400);
    expect(
      (await dar(cookie.interno, { consentido: true, origem: 'atendimento_telefonico' }))
        .statusCode,
    ).toBe(400);
    expect((await dar(cookie.interno, { ...sim, origem: 'descadastro_cidadao' })).statusCode).toBe(
      400,
    );

    const ok = await dar(cookie.interno, sim);
    expect(ok.statusCode, ok.body).toBe(200);
    expect(ok.json()).toMatchObject({ consentimento: true, origem: 'atendimento_telefonico' });
    expect(ok.json().registradoEm).not.toBeNull();

    // Repetir o mesmo valor não polui o histórico; cancelar acrescenta.
    await dar(cookie.interno, sim);
    await dar(cookie.interno, { consentido: false, origem: 'pedido_ao_gabinete' });
    const h = (await a.chamar('GET', url, { cookie: cookie.interno })).json();
    expect(h.historico.map((x: any) => [x.consentido, x.origem, x.versaoTexto])).toEqual([
      [false, 'pedido_ao_gabinete', null],
      [true, 'atendimento_telefonico', 1],
    ]);
    expect(h.situacao.consentimento).toBe(false);

    // A trilha registra a mudança SEM dado pessoal.
    const trilha = JSON.stringify(await a.trilha('consentimento.registrar'));
    expect(trilha).not.toContain('maria@exemplo.test');
    expect(trilha).not.toContain('Maria');
  });

  it('pode ser dado já no registro da demanda, mas exige e-mail', async () => {
    const { cookie } = await preparar();
    const r = await a.chamar('POST', '/api/demandas', {
      cookie: cookie.interno,
      corpo: {
        solicitante: comConsentimento({ email: undefined }),
        titulo: 'Poda',
      },
    });
    expect(r.statusCode).toBe(409);
    const ok = await registrar(cookie.interno, comConsentimento());
    const pessoa = (
      await a.chamar('GET', `/api/pessoas/${ok.solicitante.id}`, { cookie: cookie.interno })
    ).json();
    expect(pessoa).toMatchObject({ consentimento: true, email: 'maria@exemplo.test' });
  });

  it('eliminar os dados encerra o consentimento e cancela o que não saiu', async () => {
    const { cookie } = await preparar();
    const demanda = await registrar(cookie.interno, comConsentimento());
    await a.chamar('POST', `/api/demandas/${demanda.id}/andamentos`, {
      cookie: cookie.interno,
      corpo: { texto: 'Vistoria agendada.' },
    });
    expect((await envios()).map((e) => e.estado)).toEqual(['pendente']);

    await a.chamar('POST', `/api/pessoas/${demanda.solicitante.id}/eliminar-dados`, {
      cookie: cookie.admin,
      corpo: { confirmo: true },
    });
    const depois = await envios();
    expect(depois[0]).toMatchObject({ estado: 'cancelado', erro: 'Dados pessoais eliminados' });
    const [vigente] = await a.banco.conectar('api').cliente<any[]>`
      SELECT consentido, origem FROM consentimento_notificacao ORDER BY id DESC LIMIT 1`;
    expect(vigente).toEqual({ consentido: false, origem: 'dados_eliminados' });
  });
});

describe('outbox: o ato grava o envio na mesma transação (RN-NOT-05, 06)', () => {
  it('andamento, etapa visível, conclusão e cancelamento geram e-mail; etapa interna nunca', async () => {
    const { cookie, etapa } = await preparar();
    const demanda = await registrar(
      cookie.interno,
      comConsentimento(),
      'Título que NUNCA pode ir no e-mail',
    );
    const mover = (etapaId: number) =>
      a.chamar('POST', `/api/demandas/${demanda.id}/mover`, {
        cookie: cookie.interno,
        corpo: { etapaId },
      });

    await a.chamar('POST', `/api/demandas/${demanda.id}/andamentos`, {
      cookie: cookie.interno,
      corpo: { texto: 'Equipe vistoriou o local.' },
    });
    await mover(etapa.interna); // interna: nada
    await mover(etapa.visivel); // visível: etapa_visivel
    await mover(etapa.conclusao); // conclusão

    const lista = await envios();
    expect(lista.map((e) => e.evento)).toEqual([
      'andamento_publicado',
      'etapa_visivel',
      'conclusao',
    ]);
    expect(lista[0].payload).toMatchObject({
      texto: 'Equipe vistoriou o local.',
      rotulo: 'Recebida',
    });
    expect(lista[1].payload).toMatchObject({ rotulo: 'Em análise' });
    expect(lista[2].payload).toMatchObject({ rotulo: 'Concluída' });
    expect(lista.every((e) => e.estado === 'pendente')).toBe(true);
    // O e-mail não leva título, prioridade, responsável nem o segredo do link.
    const tudo = JSON.stringify(lista);
    expect(tudo).not.toContain('NUNCA');
    expect(tudo).not.toContain('prioridade');
  });

  it('o cancelamento da demanda gera o aviso de encerramento', async () => {
    const { cookie } = await preparar();
    const demanda = await registrar(cookie.interno, comConsentimento());
    await a.chamar('POST', `/api/demandas/${demanda.id}/cancelar`, {
      cookie: cookie.supervisor,
      corpo: { justificativa: 'Pedido duplicado do cidadão' },
    });
    expect((await envios()).map((e) => e.evento)).toEqual(['cancelamento']);
  });

  it('link suspenso ou revogado não gera e-mail (o cidadão não teria como acompanhar)', async () => {
    const { cookie, etapa } = await preparar();
    const demanda = await registrar(cookie.interno, comConsentimento());
    await a.chamar('POST', `/api/demandas/${demanda.id}/link/suspender`, {
      cookie: cookie.supervisor,
    });
    await a.chamar('POST', `/api/demandas/${demanda.id}/andamentos`, {
      cookie: cookie.interno,
      corpo: { texto: 'Vistoria feita.' },
    });
    await a.chamar('POST', `/api/demandas/${demanda.id}/mover`, {
      cookie: cookie.interno,
      corpo: { etapaId: etapa.visivel },
    });
    expect(await envios()).toEqual([]);
  });

  it('cancelar o consentimento cancela na hora o que está pendente', async () => {
    const { cookie } = await preparar();
    const demanda = await registrar(cookie.interno, comConsentimento());
    await a.chamar('POST', `/api/demandas/${demanda.id}/andamentos`, {
      cookie: cookie.interno,
      corpo: { texto: 'Vistoria feita.' },
    });
    await a.chamar('PUT', `/api/pessoas/${demanda.solicitante.id}/consentimento`, {
      cookie: cookie.interno,
      corpo: { consentido: false, origem: 'pedido_ao_gabinete' },
    });
    expect((await envios())[0]).toMatchObject({
      estado: 'cancelado',
      erro: 'Consentimento cancelado',
    });
  });

  it('e-mail marcado como inválido não recebe até ser corrigido', async () => {
    const { cookie } = await preparar();
    const demanda = await registrar(cookie.interno, comConsentimento());
    await a.banco.conectar('api').cliente`UPDATE pessoa SET email_invalido = true`;
    await a.chamar('POST', `/api/demandas/${demanda.id}/andamentos`, {
      cookie: cookie.interno,
      corpo: { texto: 'Vistoria feita.' },
    });
    expect(await envios()).toEqual([]);
    // Corrigir o e-mail devolve a chance.
    await a.chamar('PATCH', `/api/pessoas/${demanda.solicitante.id}`, {
      cookie: cookie.interno,
      corpo: { email: 'novo@exemplo.test' },
    });
    await a.chamar('POST', `/api/demandas/${demanda.id}/andamentos`, {
      cookie: cookie.interno,
      corpo: { texto: 'Outra novidade.' },
    });
    expect((await envios()).map((e) => e.evento)).toEqual(['andamento_publicado']);
  });
});

describe('fila de e-mails (RN-NOT-08)', () => {
  it('o Supervisor vê enviado, falhou e cancelado, com contagens; o Interno não alcança', async () => {
    const { cookie } = await preparar();
    const demanda = await registrar(cookie.interno, comConsentimento());
    for (const texto of ['um', 'dois', 'três']) {
      await a.chamar('POST', `/api/demandas/${demanda.id}/andamentos`, {
        cookie: cookie.interno,
        corpo: { texto },
      });
    }
    const worker = a.banco.conectar('worker').cliente;
    const linhas = await worker<{ id: number }[]>`SELECT id FROM envio_notificacao ORDER BY id`;
    await worker`UPDATE envio_notificacao SET estado = 'enviado', enviado_em = now(), tentativas = 1 WHERE id = ${linhas[0]!.id}`;
    await worker`UPDATE envio_notificacao SET estado = 'falhou', erro = 'Caixa cheia', tentativas = 5 WHERE id = ${linhas[1]!.id}`;

    expect(
      (await a.chamar('GET', '/api/notificacoes', { cookie: cookie.interno })).statusCode,
    ).toBe(404);
    const todos = (
      await a.chamar('GET', '/api/notificacoes', { cookie: cookie.supervisor })
    ).json();
    expect(todos.total).toBe(3);
    expect(todos.porEstado).toEqual({
      pendente: 1,
      enviando: 0,
      enviado: 1,
      falhou: 1,
      cancelado: 0,
    });
    expect(todos.itens[0]).toMatchObject({ protocolo: demanda.protocolo, estado: 'pendente' });

    const falhas = (
      await a.chamar('GET', '/api/notificacoes?estado=falhou', { cookie: cookie.supervisor })
    ).json();
    expect(falhas.itens).toHaveLength(1);
    expect(falhas.itens[0]).toMatchObject({ estado: 'falhou', erro: 'Caixa cheia', tentativas: 5 });
    expect(
      (await a.chamar('GET', '/api/notificacoes?estado=xyz', { cookie: cookie.supervisor }))
        .statusCode,
    ).toBe(400);
  });
});
