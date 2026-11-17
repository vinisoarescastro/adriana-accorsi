/* eslint-disable @typescript-eslint/no-explicit-any -- corpos JSON das respostas, sem tipo */
import { afterEach, describe, expect, it } from 'vitest';
import {
  a,
  anexar,
  categoriaDaCeap,
  decidir,
  definirCota,
  despesaEmAnalise,
  enviar,
  novaDespesa,
  preparar,
  saldo,
} from './auxiliares-da-ceap.js';

afterEach(async () => {
  await a.encerrar();
});

const get = (cookie: string, url: string) => a.chamar('GET', url, { cookie });
const post = (cookie: string, url: string, corpo: object = {}) =>
  a.chamar('POST', url, { cookie, corpo });

describe('parâmetros com vigência', () => {
  it('o Chefe, o Administrador e a Parlamentar alteram; o Supervisor não; a vigência anterior fecha no dia anterior', async () => {
    const e = await preparar();
    expect((await definirCota(e.cookie.supervisor)).statusCode).toBe(404);
    expect((await definirCota(e.cookie.interno)).statusCode).toBe(404);
    expect((await definirCota(e.cookie.admin, '45000.00', '2026-01-01')).statusCode).toBe(201);
    const nova = await definirCota(e.cookie.chefe, '46500.50', '2026-07-01');
    expect(nova.statusCode, nova.body).toBe(201);
    const { vigentes, historico } = nova.json();
    expect(vigentes.cota_mensal).toMatchObject({
      valor: '46500.50',
      vigenteDe: '2026-07-01',
      vigenteAte: null,
    });
    expect(historico.map((p: any) => [p.valor, p.vigenteDe, p.vigenteAte])).toEqual([
      ['46500.50', '2026-07-01', null],
      ['45000.00', '2026-01-01', '2026-06-30'],
    ]);
    expect((await a.trilha('ceap.parametro_definir')).length).toBe(2);
  });

  it('a vigência nova começa depois da última; valores inválidos são recusados; nenhuma cota vem semeada', async () => {
    const e = await preparar();
    expect((await get(e.cookie.interno, '/api/ceap/parametros')).json().historico).toEqual([]);
    await definirCota(e.cookie.admin, '1000.00', '2026-03-01');
    expect((await definirCota(e.cookie.admin, '2000.00', '2026-03-01')).statusCode).toBe(409);
    expect((await definirCota(e.cookie.admin, '2000.00', '2026-01-01')).statusCode).toBe(409);
    expect((await definirCota(e.cookie.admin, '0', '2026-05-01')).statusCode).toBe(400);
    expect((await definirCota(e.cookie.admin, '1.234', '2026-05-01')).statusCode).toBe(400);
    const dias = await post(e.cookie.admin, '/api/ceap/parametros', {
      chave: 'prazo_apresentacao_dias',
      valor: '90',
      vigenteDe: '2026-01-01',
    });
    expect(dias.statusCode).toBe(201);
  });

  it('alterar a cota não muda o saldo de períodos anteriores (vigência)', async () => {
    const e = await preparar();
    await definirCota(e.cookie.admin, '1000.00', '2026-01-01');
    const antes = await saldo(e.cookie.interno);
    expect(antes.meses[5].cota).toBe('1000.00'); // junho
    await definirCota(e.cookie.admin, '2000.00', '2026-10-01');
    const depois = await saldo(e.cookie.interno);
    expect(depois.meses.slice(0, 9).map((m: any) => m.cota)).toEqual(Array(9).fill('1000.00'));
    expect(depois.meses[9].cota).toBe('2000.00'); // outubro em diante
    expect(depois.meses[8].saldo).toBe('9000.00'); // setembro, como antes
    expect(depois.saldoAtual).toBe('13000.00'); // 9 x 1000 + 2 x 2000 (novembro)
  });
});

describe('categorias', () => {
  it('vêm da proposta inicial, sem teto; o Chefe e o Administrador criam, ajustam e desativam; a última ativa não desativa', async () => {
    const e = await preparar();
    const lista = (await get(e.cookie.interno, '/api/ceap/categorias')).json();
    expect(lista.length).toBeGreaterThanOrEqual(10);
    expect(lista.every((c: any) => c.tetoMensal === null && c.comprovanteObrigatorio)).toBe(true);
    expect(
      (await post(e.cookie.supervisor, '/api/ceap/categorias', { nome: 'Novo item' })).statusCode,
    ).toBe(404);
    const criada = await post(e.cookie.admin, '/api/ceap/categorias', {
      nome: 'Novo item',
      tetoMensal: '500,00',
    });
    expect(criada.statusCode, criada.body).toBe(201);
    const id = criada.json().find((c: any) => c.nome === 'Novo item').id;
    expect(
      (await post(e.cookie.admin, '/api/ceap/categorias', { nome: 'NOVO ITEM' })).statusCode,
    ).toBe(409);
    const edit = await a.chamar('PATCH', `/api/ceap/categorias/${id}`, {
      cookie: e.cookie.admin,
      corpo: { tetoMensal: '750.00' },
    });
    expect(edit.json().find((c: any) => c.id === id).tetoMensal).toBe('750.00');

    const todas = (await get(e.cookie.admin, '/api/ceap/categorias')).json();
    for (const c of todas.slice(1)) {
      await a.chamar('PUT', `/api/ceap/categorias/${c.id}/situacao`, {
        cookie: e.cookie.admin,
        corpo: { situacao: 'inativa' },
      });
    }
    const ultima = await a.chamar('PUT', `/api/ceap/categorias/${todas[0].id}/situacao`, {
      cookie: e.cookie.admin,
      corpo: { situacao: 'inativa' },
    });
    expect(ultima.statusCode).toBe(409);
  });
});

describe('lançar e enviar a despesa', () => {
  it('nasce na etapa Lançada, sem consumir saldo; valida valor, data e fornecedor', async () => {
    const e = await preparar();
    await definirCota(e.cookie.admin);
    const d = await novaDespesa(e.cookie.interno);
    expect(d).toMatchObject({
      status: 'lancada',
      consomeSaldo: false,
      valor: '100.00',
      competencia: { ano: 2026, mes: 11 },
    });
    expect(d.fornecedor.documento).toBe('11.222.333/0001-81');
    expect((await saldo(e.cookie.interno)).saldoAtual).toBe('11000.00');
    await novaDespesa(e.cookie.interno, { valor: '0' }, 400);
    await novaDespesa(e.cookie.interno, { dataDocumento: '2026-11-13' }, 409); // depois de hoje (12/11)
    await novaDespesa(e.cookie.interno, { fornecedorDocumento: '123' }, 400);
    await novaDespesa(e.cookie.interno, { categoriaId: 999999 }, 409);
    await novaDespesa(e.cookie.interno, { responsavelId: e.id.semFinanceiro }, 409);
  });

  it('sem comprovante, não segue para análise; com ele, a despesa em análise já reduz o saldo', async () => {
    const e = await preparar();
    await definirCota(e.cookie.admin);
    const d = await novaDespesa(e.cookie.interno);
    const sem = await enviar(e.cookie.interno, d.id);
    expect(sem.statusCode).toBe(409);
    expect(sem.json().mensagem).toMatch(/comprovante/i);

    expect((await anexar(e.cookie.interno, d.id)).statusCode).toBe(201);
    const ok = await enviar(e.cookie.interno, d.id);
    expect(ok.statusCode, ok.body).toBe(200);
    expect(ok.json()).toMatchObject({
      status: 'em_analise',
      consomeSaldo: true,
      quantidadeDeComprovantes: 1,
    });
    expect((await saldo(e.cookie.interno)).saldoAtual).toBe('10900.00');
    expect((await enviar(e.cookie.interno, d.id)).statusCode).toBe(409); // já enviada
  });

  it('a categoria sem comprovante obrigatório segue sem ele', async () => {
    const e = await preparar();
    await definirCota(e.cookie.admin);
    const categoria = await categoriaDaCeap(e.cookie.admin, 'Outros');
    await a.chamar('PATCH', `/api/ceap/categorias/${categoria}`, {
      cookie: e.cookie.admin,
      corpo: { comprovanteObrigatorio: false },
    });
    const d = await novaDespesa(e.cookie.interno, { categoriaId: categoria });
    expect((await enviar(e.cookie.interno, d.id)).statusCode).toBe(200);
  });

  it('não passa do saldo; sem cota cadastrada, o saldo é zero e a mensagem avisa', async () => {
    const e = await preparar();
    const d = await novaDespesa(e.cookie.interno);
    await anexar(e.cookie.interno, d.id);
    const recusada = await enviar(e.cookie.interno, d.id);
    expect(recusada.statusCode).toBe(409);
    expect(recusada.json().mensagem).toMatch(/Saldo insuficiente.*cota mensal/);

    await definirCota(e.cookie.admin, '1000.00', '2026-01-01');
    // O saldo até novembro é 11.000: mais que isso é recusado.
    const grande = await novaDespesa(e.cookie.interno, { valor: '11000.01' });
    await anexar(e.cookie.interno, grande.id);
    expect((await enviar(e.cookie.interno, grande.id)).statusCode).toBe(409);
    const justa = await novaDespesa(e.cookie.interno, { valor: '11000.00' });
    await anexar(e.cookie.interno, justa.id);
    expect((await enviar(e.cookie.interno, justa.id)).statusCode).toBe(200);
    expect((await saldo(e.cookie.interno)).saldoAtual).toBe('0.00');
  });

  it('uma despesa de mês antigo não pode estourar o saldo dos meses seguintes', async () => {
    const e = await preparar();
    await definirCota(e.cookie.admin);
    await despesaEmAnalise(e.cookie.interno, { valor: '10500.00' }); // quase tudo em novembro
    const velha = await novaDespesa(e.cookie.interno, {
      valor: '600.00',
      dataDocumento: '2026-01-15',
    });
    await anexar(e.cookie.interno, velha.id);
    expect((await enviar(e.cookie.interno, velha.id)).statusCode).toBe(409);
    const cabe = await novaDespesa(e.cookie.interno, {
      valor: '500.00',
      dataDocumento: '2026-01-15',
    });
    await anexar(e.cookie.interno, cabe.id);
    expect((await enviar(e.cookie.interno, cabe.id)).statusCode).toBe(200);
  });

  it('o teto mensal da categoria, quando existe, vale por competência', async () => {
    const e = await preparar();
    await definirCota(e.cookie.admin);
    const categoria = await categoriaDaCeap(e.cookie.admin, 'Combustíveis');
    await a.chamar('PATCH', `/api/ceap/categorias/${categoria}`, {
      cookie: e.cookie.admin,
      corpo: { tetoMensal: '300.00' },
    });
    await despesaEmAnalise(e.cookie.interno, { categoriaId: categoria, valor: '200.00' });
    const outra = await novaDespesa(e.cookie.interno, { categoriaId: categoria, valor: '150.00' });
    await anexar(e.cookie.interno, outra.id);
    const r = await enviar(e.cookie.interno, outra.id);
    expect(r.statusCode).toBe(409);
    expect(r.json().mensagem).toMatch(/teto mensal/);
    const outroMes = await novaDespesa(e.cookie.interno, {
      categoriaId: categoria,
      valor: '150.00',
      dataDocumento: '2026-10-05',
    });
    await anexar(e.cookie.interno, outroMes.id);
    expect((await enviar(e.cookie.interno, outroMes.id)).statusCode).toBe(200);
  });

  it('cancelar devolve o valor ao saldo e exige justificativa; a cancelada não se altera', async () => {
    const e = await preparar();
    await definirCota(e.cookie.admin);
    const d = await despesaEmAnalise(e.cookie.interno, { valor: '400.00' });
    expect((await saldo(e.cookie.interno)).saldoAtual).toBe('10600.00');
    expect(
      (
        await post(e.cookie.interno, `/api/ceap/despesas/${d.id}/cancelar`, {
          justificativa: 'curta',
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await post(e.cookie.interno2, `/api/ceap/despesas/${d.id}/cancelar`, {
          justificativa: 'Lançada em duplicidade',
        })
      ).statusCode,
    ).toBe(403);
    const r = await post(e.cookie.interno, `/api/ceap/despesas/${d.id}/cancelar`, {
      justificativa: 'Lançada em duplicidade',
    });
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json()).toMatchObject({ status: 'cancelada', consomeSaldo: false });
    expect((await saldo(e.cookie.interno)).saldoAtual).toBe('11000.00');
    expect(
      (
        await a.chamar('PATCH', `/api/ceap/despesas/${d.id}`, {
          cookie: e.cookie.supervisor,
          corpo: { descricao: 'x' },
        })
      ).statusCode,
    ).toBe(409);
  });

  it('só se edita a despesa em rascunho, por quem lançou ou por Supervisor em diante', async () => {
    const e = await preparar();
    await definirCota(e.cookie.admin);
    const d = await novaDespesa(e.cookie.interno);
    const editar = (cookie: string) =>
      a.chamar('PATCH', `/api/ceap/despesas/${d.id}`, {
        cookie,
        corpo: { descricao: 'Outra descrição' },
      });
    expect((await editar(e.cookie.interno2)).statusCode).toBe(403);
    expect((await editar(e.cookie.interno)).statusCode).toBe(200);
    expect((await editar(e.cookie.supervisor)).statusCode).toBe(200);
    await anexar(e.cookie.interno, d.id);
    await enviar(e.cookie.interno, d.id);
    expect((await editar(e.cookie.supervisor)).statusCode).toBe(409);
  });
});

describe('segregação de função', () => {
  it('quem lança não decide: o Interno nem alcança a decisão; o Supervisor que lançou é recusado', async () => {
    const e = await preparar();
    await definirCota(e.cookie.admin);
    const doInterno = await despesaEmAnalise(e.cookie.interno);
    expect((await decidir(e.cookie.interno, doInterno.id)).statusCode).toBe(404); // nível insuficiente
    const doSupervisor = await despesaEmAnalise(e.cookie.supervisor);
    expect((await decidir(e.cookie.supervisor, doSupervisor.id)).statusCode).toBe(403);
    expect(
      (await get(e.cookie.supervisor, `/api/ceap/despesas/${doSupervisor.id}`)).json(),
    ).toMatchObject({
      status: 'em_analise',
    });
    const ok = await decidir(e.cookie.supervisor2, doSupervisor.id); // outro Supervisor decide
    expect(ok.statusCode, ok.body).toBe(200);
    expect(ok.json()).toMatchObject({ status: 'aprovada', decisaoPeloProprioLancador: false });
  });

  it('Chefe, Administrador e Parlamentar decidem a própria, com a coincidência marcada na despesa, na trilha e no relatório', async () => {
    const e = await preparar();
    await definirCota(e.cookie.admin);
    for (const quem of ['chefe', 'admin', 'parlamentar'] as const) {
      const d = await despesaEmAnalise(e.cookie[quem]);
      const r = await decidir(e.cookie[quem], d.id);
      expect(r.statusCode, `${quem}: ${r.body}`).toBe(200);
      expect(r.json()).toMatchObject({ status: 'aprovada', decisaoPeloProprioLancador: true });
    }
    expect((await a.trilha('ceap.aprovar_propria')).length).toBe(3);
    const relatorio = (
      await get(e.cookie.chefe, '/api/ceap/relatorio?de=2026-11&ate=2026-11')
    ).json();
    expect(relatorio.decididasPeloLancador).toHaveLength(3);
  });

  it('o banco repete a regra: nem por SQL direto a decisão própria passa sem a marca', async () => {
    const e = await preparar();
    await definirCota(e.cookie.admin);
    const d = await despesaEmAnalise(e.cookie.interno);
    const api = a.banco.conectar('api').cliente;
    await expect(
      api`UPDATE despesa SET decidido_por = ${e.id.interno}, decidida_em = now() WHERE id = ${d.id}`,
    ).rejects.toThrow(/despesa_segregacao/);
  });

  it('reprovar exige motivo, é terminal e devolve o valor; a despesa decidida não se edita nem se cancela', async () => {
    const e = await preparar();
    await definirCota(e.cookie.admin);
    const d = await despesaEmAnalise(e.cookie.interno, { valor: '250.00' });
    expect((await decidir(e.cookie.supervisor, d.id, { decisao: 'reprovar' })).statusCode).toBe(
      400,
    );
    expect(
      (await decidir(e.cookie.supervisor, d.id, { decisao: 'reprovar', motivo: 'curto' }))
        .statusCode,
    ).toBe(400);
    const r = await decidir(e.cookie.supervisor, d.id, {
      decisao: 'reprovar',
      motivo: 'Comprovante ilegível',
    });
    expect(r.json()).toMatchObject({
      status: 'reprovada',
      consomeSaldo: false,
      motivoReprovacao: 'Comprovante ilegível',
    });
    expect((await saldo(e.cookie.interno)).saldoAtual).toBe('11000.00');
    expect((await decidir(e.cookie.supervisor, d.id)).statusCode).toBe(409);
    expect(
      (
        await post(e.cookie.supervisor, `/api/ceap/despesas/${d.id}/cancelar`, {
          justificativa: 'Já decidida antes',
        })
      ).statusCode,
    ).toBe(409);
  });

  it('o acompanhamento depois da aprovação segue o fluxo: apresentada, ressarcida ou glosada (devolve), arquivada', async () => {
    const e = await preparar();
    await definirCota(e.cookie.admin);
    const etapas = (await get(e.cookie.supervisor, '/api/ceap/etapas')).json();
    const id = (nome: string) => etapas.find((x: any) => x.nome === nome).id;
    const mover = (cookie: string, despesa: number, nome: string) =>
      post(cookie, `/api/ceap/despesas/${despesa}/mover`, { etapaId: id(nome) });

    const d = await despesaEmAnalise(e.cookie.interno, { valor: '300.00' });
    await decidir(e.cookie.supervisor, d.id);
    expect((await mover(e.cookie.supervisor, d.id, 'Ressarcida')).statusCode).toBe(409); // pula a apresentação
    expect((await mover(e.cookie.supervisor, d.id, 'Apresentada à Câmara')).json()).toMatchObject({
      status: 'apresentada',
      consomeSaldo: true,
    });
    const glosada = await mover(e.cookie.supervisor, d.id, 'Glosada pela Câmara');
    expect(glosada.json()).toMatchObject({ status: 'glosada', consomeSaldo: false });
    expect((await saldo(e.cookie.interno)).saldoAtual).toBe('11000.00');
    expect((await mover(e.cookie.supervisor, d.id, 'Arquivada')).json()).toMatchObject({
      status: 'arquivada',
    });

    const outra = await despesaEmAnalise(e.cookie.interno, { valor: '50.00' });
    await decidir(e.cookie.supervisor, outra.id);
    await mover(e.cookie.supervisor, outra.id, 'Apresentada à Câmara');
    expect((await mover(e.cookie.supervisor, outra.id, 'Ressarcida')).json()).toMatchObject({
      status: 'ressarcida',
      consomeSaldo: true,
    });
  });
});
