/* eslint-disable @typescript-eslint/no-explicit-any -- corpos JSON das respostas, sem tipo */
import { afterEach, describe, expect, it } from 'vitest';
import { a, etapaPor, novaDemanda, preparar, registrar } from './auxiliares-de-demandas.js';
import { decifrarSegredoDeLink, hashDoSegredoDeLink } from './link.js';
import { segredoDeTeste } from '../teste/auxiliares.js';

afterEach(async () => {
  await a.encerrar();
});

describe('registrar (o roteiro "Maria liga pedindo a poda de uma árvore")', () => {
  it('numa só operação: pessoa, protocolo, link, demanda, entrada no fluxo e trilha', async () => {
    const { cookie, id } = await preparar();

    // 1. A assessora busca a pessoa pelo telefone: não existe.
    const busca = await a.chamar('GET', '/api/pessoas/por-telefone?telefone=67999990000', {
      cookie: cookie.interno,
    });
    expect(busca.json().pessoa).toBeNull();

    // 2. Registra a demanda cadastrando a pessoa na mesma tela.
    const { demanda, linkDeAcompanhamento, pessoaCriada } = await registrar(cookie.interno);

    expect(pessoaCriada).toBe(true);
    expect(demanda.protocolo).toMatch(/^[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$/);
    expect(demanda).toMatchObject({
      titulo: 'Poda de árvore na Rua das Flores',
      prioridade: 'media',
      status: 'em_andamento',
      atrasada: false,
      etapa: { nome: 'Recebida', papel: 'entrada' },
      solicitante: { nome: 'Maria da Silva' },
      responsavel: { id: id.interno },
      completa: true,
    });
    expect(demanda.movimentacoes).toHaveLength(1);
    expect(demanda.movimentacoes[0]).toMatchObject({ de: null, para: 'Recebida' });

    // 3. O link: um segredo aleatório de 256 bits, fora do protocolo.
    expect(linkDeAcompanhamento).toMatch(
      /^https:\/\/publico\.exemplo\.test\/a\/[A-Za-z0-9_-]{43}$/,
    );
    expect(linkDeAcompanhamento).not.toContain(demanda.protocolo.replaceAll('-', ''));
    const segredo = linkDeAcompanhamento.split('/a/')[1] as string;
    const [linha] = await a.banco.conectar('api').cliente<
      { segredo_link_hash: string; segredo_link_cifrado: string; protocolo: string }[]
    >`
      SELECT segredo_link_hash, segredo_link_cifrado, protocolo FROM demanda WHERE id = ${demanda.id}`;
    expect(linha?.segredo_link_hash).toBe(hashDoSegredoDeLink(segredo));
    expect(linha?.segredo_link_cifrado).not.toContain(segredo);
    expect(decifrarSegredoDeLink(linha!.segredo_link_cifrado, segredoDeTeste)).toBe(segredo);
    expect(linha?.protocolo).toBe(demanda.protocolo.replaceAll('-', ''));

    // 4. A trilha registra o ato, mas NUNCA o segredo do link.
    const trilha = JSON.stringify(await a.trilha());
    expect(trilha).not.toContain(segredo);
    expect((await a.trilha('demanda.registrar')).length).toBe(1);
    expect((await a.trilha('pessoa.criar')).length).toBe(1);

    // 5. Agora a pessoa existe e pode ser reutilizada.
    const outra = await registrar(cookie.interno, {
      solicitante: { pessoaId: demanda.solicitante.id },
      titulo: 'Buraco na rua',
    });
    expect(outra.pessoaCriada).toBe(false);
    expect(outra.demanda.protocolo).not.toBe(demanda.protocolo);
  });

  it('sem responsável indicado, quem registrou é o responsável; o Assessor Externo registra em seu nome', async () => {
    const { cookie, id } = await preparar();
    const { demanda } = await registrar(cookie.externo);
    expect(demanda.responsavel.id).toBe(id.externo);
    expect(demanda.completa).toBe(false);

    const alheio = await a.chamar('POST', '/api/demandas', {
      cookie: cookie.externo,
      corpo: novaDemanda({ responsavelId: id.interno }),
    });
    expect(alheio.statusCode).toBe(403);
    const delegado = await a.chamar('POST', '/api/demandas', {
      cookie: cookie.interno,
      corpo: novaDemanda({
        solicitante: { nome: 'Joana', telefone: '67988887777' },
        responsavelId: id.externo,
      }),
    });
    expect(delegado.statusCode).toBe(201);
  });

  it('valida título, telefone, prazo e o responsável', async () => {
    const { cookie, id } = await preparar();
    const ruim = async (extra: object) =>
      (
        await a.chamar('POST', '/api/demandas', {
          cookie: cookie.interno,
          corpo: novaDemanda(extra),
        })
      ).statusCode;
    expect(await ruim({ titulo: '   ' })).toBe(400);
    expect(await ruim({ solicitante: { nome: 'M', telefone: '123' } })).toBe(400);
    expect(await ruim({ prazo: '12/2026' })).toBe(400);
    expect(await ruim({ prioridade: 'critica' })).toBe(400);
    expect(await ruim({ responsavelId: id.semAtendimento })).toBe(409);
    expect(await ruim({ responsavelId: 999999 })).toBe(409);
  });

  it('telefone de pessoa já cadastrada é recusado com a indicação do cadastro existente', async () => {
    const { cookie } = await preparar();
    const primeira = await registrar(cookie.interno);
    const repetida = await a.chamar('POST', '/api/demandas', {
      cookie: cookie.interno,
      corpo: novaDemanda(),
    });
    expect(repetida.statusCode).toBe(409);
    expect(repetida.json().detalhes).toEqual([`pessoaId:${primeira.demanda.solicitante.id}`]);
  });

  it('pessoa inativa ou inexistente não recebe demanda', async () => {
    const { cookie } = await preparar();
    expect(
      (
        await a.chamar('POST', '/api/demandas', {
          cookie: cookie.interno,
          corpo: { solicitante: { pessoaId: 9999 }, titulo: 'X' },
        })
      ).statusCode,
    ).toBe(404);
  });
});

describe('alcance (RN-DEM-07, critério 6)', () => {
  it('o Assessor Externo só enxerga as demandas de que é responsável: lista, quadro, busca e link direto', async () => {
    const { cookie, id } = await preparar();
    const dele = (
      await registrar(
        cookie.externo,
        novaDemanda({ solicitante: { nome: 'Ana', telefone: '67911110000' }, titulo: 'Da Ana' }),
      )
    ).demanda;
    const alheia = (
      await registrar(
        cookie.interno,
        novaDemanda({ solicitante: { nome: 'Bia', telefone: '67922220000' }, titulo: 'Da Bia' }),
      )
    ).demanda;

    const lista = (await a.chamar('GET', '/api/demandas', { cookie: cookie.externo })).json();
    expect(lista.itens.map((i: any) => i.id)).toEqual([dele.id]);
    expect(lista.total).toBe(1);

    const busca = (
      await a.chamar('GET', `/api/demandas?busca=${encodeURIComponent('Bia')}`, {
        cookie: cookie.externo,
      })
    ).json();
    expect(busca.total).toBe(0);
    const porProtocolo = (
      await a.chamar('GET', `/api/demandas?busca=${alheia.protocolo}`, { cookie: cookie.externo })
    ).json();
    expect(porProtocolo.total).toBe(0);
    const filtroDoOutro = (
      await a.chamar('GET', `/api/demandas?responsavelId=${id.interno}`, { cookie: cookie.externo })
    ).json();
    expect(filtroDoOutro.total).toBe(0);

    const quadro = (
      await a.chamar('GET', '/api/demandas/quadro', { cookie: cookie.externo })
    ).json();
    expect(quadro.colunas.flatMap((c: any) => c.itens.map((i: any) => i.id))).toEqual([dele.id]);

    const direta = await a.chamar('GET', `/api/demandas/${alheia.id}`, { cookie: cookie.externo });
    const inexistente = await a.chamar('GET', '/api/demandas/999999', { cookie: cookie.externo });
    expect(direta.statusCode).toBe(404);
    expect(direta.body).toBe(inexistente.body);

    // Nem por ações: mover, comentar, anexar, cancelar.
    const etapa = await etapaPor(cookie.interno, 'Em andamento');
    expect(
      (
        await a.chamar('POST', `/api/demandas/${alheia.id}/mover`, {
          cookie: cookie.externo,
          corpo: { etapaId: etapa },
        })
      ).statusCode,
    ).toBe(404);
  });

  it('o Assessor Interno em diante enxerga todas', async () => {
    const { cookie } = await preparar();
    await registrar(
      cookie.externo,
      novaDemanda({ solicitante: { nome: 'Ana', telefone: '67911110000' } }),
    );
    await registrar(
      cookie.interno,
      novaDemanda({ solicitante: { nome: 'Bia', telefone: '67922220000' } }),
    );
    for (const quem of ['interno', 'supervisor', 'chefe', 'admin'] as const) {
      expect(
        (await a.chamar('GET', '/api/demandas', { cookie: cookie[quem] })).json().total,
        quem,
      ).toBe(2);
    }
  });

  it('ficha: o Externo vê a sua sem comentários, documentos nem histórico; o Interno vê completa', async () => {
    const { cookie } = await preparar();
    const { demanda } = await registrar(
      cookie.externo,
      novaDemanda({ descricao: 'Galho caindo sobre a calçada' }),
    );
    const reduzida = (
      await a.chamar('GET', `/api/demandas/${demanda.id}`, { cookie: cookie.externo })
    ).json();
    expect(reduzida).toMatchObject({
      completa: false,
      descricao: 'Galho caindo sobre a calçada',
      comentarios: [],
      documentos: [],
      movimentacoes: [],
    });
    const completa = (
      await a.chamar('GET', `/api/demandas/${demanda.id}`, { cookie: cookie.interno })
    ).json();
    expect(completa.completa).toBe(true);
    expect(completa.movimentacoes).toHaveLength(1);
  });

  it('sem a habilitação AT, nada de atendimento (404)', async () => {
    const { cookie } = await preparar();
    for (const caminho of [
      '/api/demandas',
      '/api/demandas/quadro',
      '/api/pessoas',
      '/api/painel/atendimento',
    ]) {
      expect(
        (await a.chamar('GET', caminho, { cookie: cookie.semAtendimento })).statusCode,
        caminho,
      ).toBe(404);
    }
  });
});

describe('mover (mecanismo único; o status deriva do papel da etapa)', () => {
  it('o responsável move; o status acompanha a etapa; a movimentação guarda quem, quando e a observação', async () => {
    const { cookie } = await preparar();
    const { demanda } = await registrar(cookie.interno);
    const emAndamento = await etapaPor(cookie.interno, 'Em andamento');
    const concluida = await etapaPor(cookie.interno, 'Concluída');

    const andando = (
      await a.chamar('POST', `/api/demandas/${demanda.id}/mover`, {
        cookie: cookie.interno,
        corpo: { etapaId: emAndamento, observacao: 'Ligado para a prefeitura' },
      })
    ).json();
    expect(andando).toMatchObject({ status: 'em_andamento', etapa: { nome: 'Em andamento' } });

    const fim = (
      await a.chamar('POST', `/api/demandas/${demanda.id}/mover`, {
        cookie: cookie.interno,
        corpo: { etapaId: concluida },
      })
    ).json();
    expect(fim).toMatchObject({ status: 'concluido', etapa: { papel: 'conclusao' } });
    expect(fim.movimentacoes.map((m: any) => `${m.de ?? '-'}>${m.para}`)).toEqual([
      '->Recebida',
      'Recebida>Em andamento',
      'Em andamento>Concluída',
    ]);
    expect(fim.movimentacoes[1].observacao).toBe('Ligado para a prefeitura');

    // Nenhuma coluna de status: a fonte é só a etapa.
    const quadro = (
      await a.chamar('GET', '/api/demandas/quadro', { cookie: cookie.interno })
    ).json();
    expect(quadro.colunas.find((c: any) => c.etapa.nome === 'Concluída').itens).toHaveLength(1);

    // A coluna etapa_atual_id sempre bate com a última movimentação.
    const [c] = await a.banco.conectar('api').cliente<{ divergentes: string }[]>`
      SELECT count(*) AS divergentes FROM demanda d
      WHERE d.etapa_atual_id <> (SELECT m.etapa_destino_id FROM movimentacao m WHERE m.registro_tipo = 'demanda' AND m.registro_id = d.id ORDER BY m.id DESC LIMIT 1)`;
    expect(Number(c?.divergentes)).toBe(0);
  });

  it('quem não é o responsável nem Supervisor não move; o Supervisor move qualquer uma', async () => {
    const { cookie } = await preparar();
    const { demanda } = await registrar(cookie.interno);
    const etapa = await etapaPor(cookie.interno, 'Em triagem');

    // O outro Assessor Externo nem enxerga (404); o Assessor Interno que não é responsável não pode.
    const outroInterno = await a.criarUsuario({ perfil: 'assessor_interno', habilitacoes: ['AT'] });
    const cookieOutro = await a.sessaoDe(outroInterno.email);
    const recusado = await a.chamar('POST', `/api/demandas/${demanda.id}/mover`, {
      cookie: cookieOutro,
      corpo: { etapaId: etapa },
    });
    expect(recusado.statusCode).toBe(403);

    expect(
      (
        await a.chamar('POST', `/api/demandas/${demanda.id}/mover`, {
          cookie: cookie.supervisor,
          corpo: { etapaId: etapa },
        })
      ).statusCode,
    ).toBe(200);
  });

  it('recusa etapa de outro fluxo, inativa, a mesma etapa e etapa inexistente', async () => {
    const { cookie } = await preparar();
    const { demanda } = await registrar(cookie.interno);
    const fluxos = (await a.chamar('GET', '/api/fluxos', { cookie: cookie.interno })).json();
    const deTarefa = fluxos.find((f: any) => f.tipo === 'tarefa').etapas[1].id;
    const mover = (etapaId: number) =>
      a.chamar('POST', `/api/demandas/${demanda.id}/mover`, {
        cookie: cookie.interno,
        corpo: { etapaId },
      });

    expect((await mover(deTarefa)).statusCode).toBe(400);
    expect((await mover(999999)).statusCode).toBe(400);
    expect((await mover(demanda.etapa.id)).statusCode).toBe(409);

    const nova = (
      await a.chamar('POST', '/api/fluxos/demanda/etapas', {
        cookie: cookie.admin,
        corpo: { nomeInterno: 'Etapa velha', papel: 'intermediaria' },
      })
    ).json();
    await a.chamar('PUT', `/api/fluxos/etapas/${nova.id}/situacao`, {
      cookie: cookie.admin,
      corpo: { situacao: 'inativa' },
    });
    expect((await mover(nova.id)).statusCode).toBe(409);
  });
});

describe('editar, reatribuir e cancelar', () => {
  it('edita título, prioridade e prazo, e a demanda vencida aparece como atrasada (derivado na leitura)', async () => {
    const { cookie } = await preparar();
    const { demanda } = await registrar(cookie.interno);
    const r = await a.chamar('PATCH', `/api/demandas/${demanda.id}`, {
      cookie: cookie.interno,
      corpo: { titulo: 'Poda urgente', prioridade: 'urgente', prazo: '2026-11-10' },
    });
    expect(r.json()).toMatchObject({
      titulo: 'Poda urgente',
      prioridade: 'urgente',
      prazo: '2026-11-10',
      atrasada: true,
    });
    expect(
      (await a.chamar('GET', '/api/demandas?atrasadas=true', { cookie: cookie.interno })).json()
        .total,
    ).toBe(1);
    expect(
      (await a.chamar('GET', '/api/demandas?prioridade=baixa', { cookie: cookie.interno })).json()
        .total,
    ).toBe(0);
    expect((await a.trilha('demanda.editar')).length).toBe(1);
  });

  it('só o Supervisor (ou superior) reatribui, e o novo responsável precisa ser válido', async () => {
    const { cookie, id } = await preparar();
    const { demanda } = await registrar(cookie.interno);
    const reatribuir = (quem: keyof typeof cookie, responsavelId: number) =>
      a.chamar('POST', `/api/demandas/${demanda.id}/reatribuir`, {
        cookie: cookie[quem],
        corpo: { responsavelId },
      });

    expect((await reatribuir('interno', id.externo)).statusCode).toBe(404);
    expect((await reatribuir('supervisor', id.semAtendimento)).statusCode).toBe(409);
    expect((await reatribuir('supervisor', id.interno)).statusCode).toBe(409); // já é o responsável
    const ok = await reatribuir('supervisor', id.externo);
    expect(ok.json().responsavel.id).toBe(id.externo);
    // O Assessor Externo agora enxerga a demanda; o Interno (ex-responsável) continua vendo, pois vê todas.
    expect(
      (await a.chamar('GET', `/api/demandas/${demanda.id}`, { cookie: cookie.externo })).statusCode,
    ).toBe(200);
  });

  it('cancelar exige justificativa (10+), registra quem e quando, e a demanda cancelada não se altera mais', async () => {
    const { cookie } = await preparar();
    const { demanda } = await registrar(cookie.interno);
    const cancelar = (justificativa: string, quem: keyof typeof cookie = 'supervisor') =>
      a.chamar('POST', `/api/demandas/${demanda.id}/cancelar`, {
        cookie: cookie[quem],
        corpo: { justificativa },
      });

    expect((await cancelar('curta')).statusCode).toBe(400);
    expect((await cancelar('Pedido duplicado do cidadão', 'interno')).statusCode).toBe(404);

    const ok = await cancelar('Pedido duplicado do cidadão');
    expect(ok.json()).toMatchObject({
      status: 'cancelada',
      justificativaCancelamento: 'Pedido duplicado do cidadão',
    });
    expect(ok.json().canceladaEm).toBeTruthy();

    const etapa = await etapaPor(cookie.supervisor, 'Em triagem');
    for (const resposta of [
      await a.chamar('POST', `/api/demandas/${demanda.id}/mover`, {
        cookie: cookie.supervisor,
        corpo: { etapaId: etapa },
      }),
      await a.chamar('PATCH', `/api/demandas/${demanda.id}`, {
        cookie: cookie.supervisor,
        corpo: { titulo: 'Novo' },
      }),
      await a.chamar('POST', `/api/demandas/${demanda.id}/reatribuir`, {
        cookie: cookie.supervisor,
        corpo: { responsavelId: 1 },
      }),
      await cancelar('Cancelando de novo outra vez'),
    ]) {
      expect(resposta.statusCode).toBe(409);
      expect(resposta.json().mensagem).toMatch(/cancelada não se altera/);
    }

    // O protocolo continua o mesmo e nunca é reutilizado.
    const [linha] = await a.banco.conectar('api').cliente<
      { protocolo: string }[]
    >`SELECT protocolo FROM demanda WHERE id = ${demanda.id}`;
    expect(demanda.protocolo.replaceAll('-', '')).toBe(linha?.protocolo);
    expect(
      (await a.chamar('GET', '/api/demandas?status=cancelada', { cookie: cookie.interno })).json()
        .total,
    ).toBe(1);
    expect(
      (
        await a.chamar('GET', '/api/demandas?status=em_andamento', { cookie: cookie.interno })
      ).json().total,
    ).toBe(0);
  });
});
