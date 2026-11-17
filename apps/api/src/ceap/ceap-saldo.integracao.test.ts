/* eslint-disable @typescript-eslint/no-explicit-any -- corpos JSON das respostas, sem tipo */
import { afterEach, describe, expect, it } from 'vitest';
import {
  a,
  anexar,
  arquivos,
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

describe('saldo derivado e reconstituição', () => {
  it('acumula a cota dentro do exercício e não passa ao seguinte; a soma por mês fecha', async () => {
    const e = await preparar();
    await definirCota(e.cookie.admin);
    await despesaEmAnalise(e.cookie.interno, { valor: '300.00', dataDocumento: '2026-02-10' });
    await despesaEmAnalise(e.cookie.interno, { valor: '200.00', dataDocumento: '2026-04-10' });
    const s = await saldo(e.cookie.interno);
    expect(s.meses[0]).toMatchObject({ cota: '1000.00', consumido: '0.00', saldo: '1000.00' });
    expect(s.meses[1]).toMatchObject({
      consumido: '300.00',
      cotaAcumulada: '2000.00',
      consumidoAcumulado: '300.00',
      saldo: '1700.00',
    });
    expect(s.meses[3]).toMatchObject({ consumido: '200.00', saldo: '3500.00' });
    expect(s.meses[10].saldo).toBe('10500.00'); // novembro
    expect(s.saldoAtual).toBe('10500.00');
    expect(s.mesDeReferencia).toBe(11);
    const seguinte = await saldo(e.cookie.interno, 2027);
    expect(seguinte.meses[0]).toMatchObject({
      cota: '1000.00',
      consumido: '0.00',
      saldo: '1000.00',
    }); // sem herdar
    const colunas = await a.banco.conectar('api').cliente<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns WHERE table_name IN ('despesa', 'ceap_parametro', 'ceap_categoria')`;
    expect(colunas.map((c) => c.column_name).filter((n) => /saldo/.test(n))).toEqual([]);
  });

  it('reconstitui o saldo de uma data passada, só para o Administrador e a Parlamentar', async () => {
    const e = await preparar();
    await definirCota(e.cookie.admin);
    const d = await despesaEmAnalise(e.cookie.interno, { valor: '400.00' });
    a.relogio.avancar(3 * 24 * 3600 * 1000); // 15/11
    const supervisor = await a.sessaoDe(e.contas.supervisor.email);
    await post(supervisor, `/api/ceap/despesas/${d.id}/cancelar`, {
      justificativa: 'Cancelada depois do envio',
    });
    const admin = await a.sessaoDe(e.contas.admin.email);
    const em = (dia: string) =>
      get(admin, `/api/ceap/reconstituicao?em=${dia}`).then((r) => r.json());
    expect((await em('2026-11-12')).saldoAtual).toBe('10600.00'); // quando estava em análise
    expect((await em('2026-11-15')).saldoAtual).toBe('11000.00'); // depois do cancelamento
    expect((await em('2026-11-12')).em).toBe('2026-11-12');
    const parlamentar = await a.sessaoDe(e.contas.parlamentar.email);
    expect((await get(parlamentar, '/api/ceap/reconstituicao?em=2026-11-12')).statusCode).toBe(200);
    for (const quem of ['chefe', 'supervisor', 'interno'] as const) {
      const cookie = await a.sessaoDe(e.contas[quem].email);
      expect((await get(cookie, '/api/ceap/reconstituicao?em=2026-11-12')).statusCode, quem).toBe(
        404,
      );
    }
  });

  it('propriedade: depois de uma sequência de operações, o saldo é a cota acumulada menos o que consome', async () => {
    const e = await preparar();
    await definirCota(e.cookie.admin, '500.00');
    let semente = 20261117;
    const sorteio = (n: number) => {
      semente = (semente * 1664525 + 1013904223) % 4294967296;
      return semente % n;
    };
    const vivas: any[] = [];
    for (let i = 0; i < 25; i += 1) {
      const passo = sorteio(4);
      if (passo <= 1 || vivas.length === 0) {
        const d = await novaDespesa(e.cookie.interno, {
          valor: `${(sorteio(200) + 1) / 2}`,
          dataDocumento: `2026-${String(sorteio(11) + 1).padStart(2, '0')}-10`,
        });
        await anexar(e.cookie.interno, d.id);
        const r = await enviar(e.cookie.interno, d.id);
        if (r.statusCode === 200) vivas.push(r.json());
      } else if (passo === 2) {
        const d = vivas.splice(sorteio(vivas.length), 1)[0];
        await post(e.cookie.supervisor, `/api/ceap/despesas/${d.id}/cancelar`, {
          justificativa: 'Cancelamento do teste de propriedade',
        });
      } else {
        const d = vivas.splice(sorteio(vivas.length), 1)[0];
        await decidir(e.cookie.supervisor, d.id, {
          decisao: 'reprovar',
          motivo: 'Reprovada no teste de propriedade',
        });
      }
      const s = await saldo(e.cookie.interno);
      const consumo = (await get(e.cookie.interno, '/api/ceap/despesas?ano=2026&porPagina=100'))
        .json()
        .itens.filter((d: any) => d.consomeSaldo)
        .reduce((t: number, d: any) => t + Math.round(Number(d.valor) * 100), 0);
      expect(Math.round(Number(s.meses[11].consumidoAcumulado) * 100), `passo ${i}`).toBe(consumo);
      expect(Math.round(Number(s.meses[11].saldo) * 100)).toBe(12 * 50_000 - consumo);
      for (const m of s.meses) expect(Number(m.saldo), `mês ${m.mes}`).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('competência, avisos e relatório', () => {
  it('encerrar exige que não haja despesa em análise; encerrada, não recebe despesa; reabrir é possível', async () => {
    const e = await preparar();
    await definirCota(e.cookie.admin);
    const d = await despesaEmAnalise(e.cookie.interno);
    const encerrar = (cookie: string) => post(cookie, '/api/ceap/competencias/2026/11/encerrar');
    expect((await encerrar(e.cookie.interno)).statusCode).toBe(404);
    const recusada = await encerrar(e.cookie.supervisor);
    expect(recusada.statusCode).toBe(409);
    expect(recusada.json().mensagem).toMatch(/aguardando análise/);
    await decidir(e.cookie.supervisor, d.id);
    const ok = await encerrar(e.cookie.supervisor);
    expect(ok.statusCode, ok.body).toBe(200);
    expect(ok.json().meses[10].encerrada).toBe(true);
    await novaDespesa(e.cookie.interno, {}, 409);
    expect(
      (await post(e.cookie.supervisor, '/api/ceap/competencias/2026/11/reabrir')).statusCode,
    ).toBe(200);
    await novaDespesa(e.cookie.interno);
  });

  it('enviar avisa quem pode decidir (e não o autor); o saldo que cruza o limite de alerta avisa uma vez', async () => {
    const e = await preparar();
    await definirCota(e.cookie.admin, '1000.00');
    await post(e.cookie.admin, '/api/ceap/parametros', {
      chave: 'limite_alerta_saldo',
      valor: '2000.00',
      vigenteDe: '2026-01-01',
    });
    await despesaEmAnalise(e.cookie.supervisor, { valor: '8500.00' }); // saldo 11.000 -> 2.500: acima do limite
    const avisos = async (quem: keyof typeof e.cookie) =>
      (await get(e.cookie[quem], '/api/avisos')).json().itens.map((x: any) => x.natureza);
    expect(await avisos('supervisor')).toEqual([]); // não avisa o autor
    expect(await avisos('supervisor2')).toEqual(['despesa_aguardando_analise']);
    expect(await avisos('interno')).toEqual([]); // não decide: não é avisado

    await despesaEmAnalise(e.cookie.supervisor, { valor: '600.00' }); // 2.500 -> 1.900: cruza o limite
    const cruzou = async () =>
      (await avisos('supervisor2')).filter((n: string) => n === 'saldo_abaixo_limite');
    expect(await cruzou()).toHaveLength(1);
    expect((await get(e.cookie.supervisor, '/api/ceap/saldo')).json()).toMatchObject({
      abaixoDoLimite: true,
    });
    await despesaEmAnalise(e.cookie.supervisor, { valor: '100.00' }); // continua abaixo: não avisa de novo
    expect(await cruzou()).toHaveLength(1);
  });

  it('o relatório traz os totais, as decididas pelo lançador, as fora do prazo e as sem comprovante', async () => {
    const e = await preparar();
    await definirCota(e.cookie.admin);
    await post(e.cookie.admin, '/api/ceap/parametros', {
      chave: 'prazo_apresentacao_dias',
      valor: '90',
      vigenteDe: '2026-01-01',
    });
    await despesaEmAnalise(e.cookie.interno, { valor: '120.00', dataDocumento: '2026-10-01' });
    const categoria = await categoriaDaCeap(e.cookie.admin, 'Outros');
    await a.chamar('PATCH', `/api/ceap/categorias/${categoria}`, {
      cookie: e.cookie.admin,
      corpo: { comprovanteObrigatorio: false },
    });
    const semComprovante = await novaDespesa(e.cookie.interno, {
      categoriaId: categoria,
      valor: '30.00',
      dataDocumento: '2026-10-02',
    });
    await enviar(e.cookie.interno, semComprovante.id);
    await novaDespesa(e.cookie.interno, { valor: '10.00', dataDocumento: '2026-07-01' }); // rascunho antigo

    expect(
      (await get(e.cookie.supervisor, '/api/ceap/relatorio?de=2026-07&ate=2026-10')).statusCode,
    ).toBe(404);
    const r = (await get(e.cookie.chefe, '/api/ceap/relatorio?de=2026-07&ate=2026-10')).json();
    expect(r.total).toBe('150.00');
    expect(r.despesas).toHaveLength(3);
    expect(r.semComprovante.map((d: any) => d.id)).toEqual([semComprovante.id]);
    expect(r.foraDoPrazo).toHaveLength(1);
    expect(r.porCategoria.map((c: any) => [c.nome, c.valor]).sort()).toEqual([
      ['Outros', '30.00'],
      ['Passagens aéreas', '120.00'],
    ]);
    expect(
      (await get(e.cookie.chefe, '/api/ceap/relatorio?de=2026-10&ate=2026-07')).statusCode,
    ).toBe(400);
  });

  it('o pacote é um ZIP com a relação e os comprovantes, só para o Chefe em diante', async () => {
    const e = await preparar();
    await definirCota(e.cookie.admin);
    const d = await despesaEmAnalise(e.cookie.interno, { dataDocumento: '2026-10-01' });
    expect(
      (await get(e.cookie.supervisor, '/api/ceap/pacote?de=2026-10&ate=2026-10')).statusCode,
    ).toBe(404);
    const r = await get(e.cookie.chefe, '/api/ceap/pacote?de=2026-10&ate=2026-10');
    expect(r.statusCode).toBe(200);
    expect(r.headers['content-type']).toBe('application/zip');
    expect(r.headers['content-disposition']).toContain('ceap-2026-10-a-2026-10.zip');
    const zip = r.rawPayload;
    expect(zip.subarray(0, 2).toString()).toBe('PK');
    const texto = zip.toString('latin1');
    expect(texto).toContain('relacao.csv');
    expect(texto).toContain(`comprovantes/despesa-${d.id}/`);
    expect(texto).toContain('nota.pdf');
  });
});

describe('comprovantes', () => {
  it('anexa PDF, PNG ou JPEG verificados; recusa vírus e tipo falso; baixa como anexo', async () => {
    const e = await preparar();
    await definirCota(e.cookie.admin);
    const d = await novaDespesa(e.cookie.interno);
    expect((await anexar(e.cookie.interno, d.id, arquivos.png(), 'foto.png')).statusCode).toBe(201);
    expect(
      (await anexar(e.cookie.interno, d.id, Buffer.from('%PDF- EICAR teste'), 'virus.pdf'))
        .statusCode,
    ).toBe(400);
    expect(
      (await anexar(e.cookie.interno, d.id, Buffer.from('texto qualquer'), 'falso.pdf')).statusCode,
    ).toBe(400);
    const lista = (await get(e.cookie.interno, `/api/ceap/despesas/${d.id}`)).json().comprovantes;
    expect(lista).toHaveLength(1);
    const baixar = await get(
      e.cookie.supervisor,
      `/api/ceap/despesas/${d.id}/comprovantes/${lista[0].id}`,
    );
    expect(baixar.statusCode).toBe(200);
    expect(baixar.headers['content-disposition']).toContain('attachment');
    expect(baixar.headers['content-type']).toBe('image/png');
  });

  it('só quem mexe na despesa anexa; remover só no rascunho; o comprovante da enviada não sai', async () => {
    const e = await preparar();
    await definirCota(e.cookie.admin);
    const d = await novaDespesa(e.cookie.interno);
    expect((await anexar(e.cookie.interno2, d.id)).statusCode).toBe(403);
    await anexar(e.cookie.interno, d.id);
    const doc = (await get(e.cookie.interno, `/api/ceap/despesas/${d.id}`)).json().comprovantes[0]
      .id;
    await enviar(e.cookie.interno, d.id);
    const remover = await a.chamar('DELETE', `/api/ceap/despesas/${d.id}/comprovantes/${doc}`, {
      cookie: e.cookie.interno,
    });
    expect(remover.statusCode).toBe(409);
    const outro = await novaDespesa(e.cookie.interno);
    await anexar(e.cookie.interno, outro.id);
    const docOutro = (await get(e.cookie.interno, `/api/ceap/despesas/${outro.id}`)).json()
      .comprovantes[0].id;
    const ok = await a.chamar('DELETE', `/api/ceap/despesas/${outro.id}/comprovantes/${docOutro}`, {
      cookie: e.cookie.interno,
    });
    expect(ok.statusCode, ok.body).toBe(200);
    expect(ok.json()).toEqual([]);
  });
});

describe('quem alcança a CEAP', () => {
  it('sem Financeiro ou sem nível, tudo responde não encontrado; a área pública não alcança nada', async () => {
    const e = await preparar();
    await definirCota(e.cookie.admin);
    const d = await novaDespesa(e.cookie.interno);
    const urls = [
      '/api/ceap/saldo',
      '/api/ceap/parametros',
      '/api/ceap/categorias',
      '/api/ceap/despesas',
      `/api/ceap/despesas/${d.id}`,
      '/api/painel/financeiro',
    ];
    for (const url of urls) {
      expect((await get(e.cookie.interno, url)).statusCode, url).toBe(200);
      expect((await get(e.cookie.semFinanceiro, url)).statusCode, url).toBe(404);
      expect((await get(e.cookie.externo, url)).statusCode, url).toBe(404);
    }
    expect((await post(e.cookie.semFinanceiro, '/api/ceap/despesas', {})).statusCode).toBe(404);
    const publico = a.banco.conectar('publico').cliente;
    await expect(publico`SELECT 1 FROM despesa`).rejects.toThrow(/permission denied/);
  });

  it('a listagem filtra por competência, categoria, situação e busca; o painel financeiro traz o saldo', async () => {
    const e = await preparar();
    await definirCota(e.cookie.admin);
    await despesaEmAnalise(e.cookie.interno, { descricao: 'Passagem para Goiânia' });
    await novaDespesa(e.cookie.interno, {
      descricao: 'Rascunho de telefonia',
      dataDocumento: '2026-10-05',
    });
    const lista = async (q: string) =>
      (await get(e.cookie.interno, `/api/ceap/despesas?${q}`)).json();
    expect((await lista('ano=2026')).total).toBe(2);
    expect((await lista('ano=2026&mes=10')).total).toBe(1);
    expect((await lista('status=em_analise')).total).toBe(1);
    expect((await lista('aguardando=true')).total).toBe(1);
    expect((await lista('busca=telefonia')).total).toBe(1);
    expect((await lista('minhas=true')).total).toBe(2);
    expect((await lista(`categoriaId=${await categoriaDaCeap(e.cookie.interno)}`)).total).toBe(2);
    const painel = (await get(e.cookie.interno, '/api/painel/financeiro')).json();
    expect(painel.saldo.saldoAtual).toBe('10900.00');
    expect(painel.emendas).toMatchObject({ disponibilizado: '0.00' });
  });
});
