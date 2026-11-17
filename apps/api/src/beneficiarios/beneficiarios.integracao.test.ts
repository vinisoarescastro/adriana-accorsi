import { afterEach, describe, expect, it } from 'vitest';
import { a, novoBeneficiario, preparar } from '../projetos/auxiliares-de-projetos.js';

afterEach(async () => {
  await a.encerrar();
});

const criar = (cookie: string, extra: object = {}) =>
  a.chamar('POST', '/api/beneficiarios', { cookie, corpo: novoBeneficiario(extra) });

describe('cadastro de beneficiário', () => {
  it('cria com CNPJ e CEP normalizados, grava a trilha e devolve o dado', async () => {
    const e = await preparar();
    const r = await criar(e.cookie.interno);
    expect(r.statusCode, r.body).toBe(201);
    expect(r.json()).toMatchObject({
      nomeFantasia: 'Prefeitura de Exemplo',
      cnpj: '11222333000181',
      cep: '79002000',
      estado: 'MS',
      complemento: null,
      situacao: 'ativo',
    });
    expect((await a.trilha('beneficiario.criar')).length).toBe(1);
  });

  it('aceita o CNPJ alfanumérico', async () => {
    const e = await preparar();
    const r = await criar(e.cookie.interno, { cnpj: '12.ABC.345/01DE-35' });
    expect(r.statusCode, r.body).toBe(201);
    expect(r.json().cnpj).toBe('12ABC34501DE35');
  });

  it('recusa CNPJ inválido, endereço incompleto e estado inexistente; só o complemento é opcional', async () => {
    const e = await preparar();
    expect((await criar(e.cookie.interno, { cnpj: '11.222.333/0001-82' })).statusCode).toBe(400);
    for (const campo of ['logradouro', 'numero', 'bairro', 'cidade', 'cep', 'razaoSocial']) {
      expect((await criar(e.cookie.interno, { [campo]: '' })).statusCode, campo).toBe(400);
    }
    expect((await criar(e.cookie.interno, { estado: 'XX' })).statusCode).toBe(400);
    expect((await criar(e.cookie.interno, { complemento: 'Sala 2' })).statusCode).toBe(201);
  });

  it('não há dois ativos com o mesmo CNPJ (qualquer pontuação); inativar libera, reativar não fura', async () => {
    const e = await preparar();
    const primeiro = (await criar(e.cookie.interno)).json();
    const repetido = await criar(e.cookie.interno, { cnpj: '11222333000181' });
    expect(repetido.statusCode).toBe(409);

    const inativar = await a.chamar('PUT', `/api/beneficiarios/${primeiro.id}/situacao`, {
      cookie: e.cookie.supervisor,
      corpo: { situacao: 'inativo' },
    });
    expect(inativar.statusCode, inativar.body).toBe(200);
    const segundo = await criar(e.cookie.interno);
    expect(segundo.statusCode, segundo.body).toBe(201);

    const reativar = await a.chamar('PUT', `/api/beneficiarios/${primeiro.id}/situacao`, {
      cookie: e.cookie.supervisor,
      corpo: { situacao: 'ativo' },
    });
    expect(reativar.statusCode).toBe(409);
  });
});

describe('alterar, inativar e consultar', () => {
  it('altera os dados; trocar para o CNPJ de outro ativo é recusado', async () => {
    const e = await preparar();
    const um = (await criar(e.cookie.interno)).json();
    const dois = (await criar(e.cookie.interno, { cnpj: '12ABC34501DE35' })).json();
    const ok = await a.chamar('PATCH', `/api/beneficiarios/${um.id}`, {
      cookie: e.cookie.interno,
      corpo: { cidade: 'Dourados', complemento: 'Sala 3' },
    });
    expect(ok.statusCode, ok.body).toBe(200);
    expect(ok.json()).toMatchObject({ cidade: 'Dourados', complemento: 'Sala 3' });
    const duplicado = await a.chamar('PATCH', `/api/beneficiarios/${dois.id}`, {
      cookie: e.cookie.interno,
      corpo: { cnpj: '11222333000181' },
    });
    expect(duplicado.statusCode).toBe(409);
    // O complemento se apaga com null.
    const limpo = await a.chamar('PATCH', `/api/beneficiarios/${um.id}`, {
      cookie: e.cookie.interno,
      corpo: { complemento: null },
    });
    expect(limpo.json().complemento).toBeNull();
  });

  it('lista e busca por nome, razão social, cidade e CNPJ (com ou sem pontuação)', async () => {
    const e = await preparar();
    await criar(e.cookie.interno);
    await criar(e.cookie.interno, {
      nomeFantasia: 'Associação Rio Verde',
      razaoSocial: 'Associação Comunitária do Rio Verde',
      cnpj: '12ABC34501DE35',
      natureza: 'entidade',
      cidade: 'Dourados',
    });
    const busca = async (q: string) =>
      (
        await a.chamar('GET', `/api/beneficiarios?busca=${encodeURIComponent(q)}`, {
          cookie: e.cookie.interno,
        })
      ).json();
    expect((await busca('rio verde')).total).toBe(1);
    expect((await busca('dourados')).total).toBe(1);
    expect((await busca('11.222.333')).total).toBe(1);
    expect((await busca('12ABC3')).itens[0].natureza).toBe('entidade');
    const entidades = (
      await a.chamar('GET', '/api/beneficiarios?natureza=entidade', { cookie: e.cookie.interno })
    ).json();
    expect(entidades.total).toBe(1);
  });

  it('o beneficiário inexistente responde não encontrado', async () => {
    const e = await preparar();
    expect(
      (await a.chamar('GET', '/api/beneficiarios/999999', { cookie: e.cookie.interno })).statusCode,
    ).toBe(404);
  });
});

describe('quem alcança os beneficiários', () => {
  it('LG ou FI abrem o módulo; sem elas, ou sem nível, responde não encontrado', async () => {
    const e = await preparar();
    const consultar = (cookie: string) =>
      a.chamar('GET', '/api/beneficiarios', { cookie }).then((r) => r.statusCode);
    expect(await consultar(e.cookie.interno)).toBe(200);
    expect(await consultar(e.cookie.financeiro)).toBe(200);
    expect(await consultar(e.cookie.parlamentar)).toBe(200);
    expect(await consultar(e.cookie.semLegislativo)).toBe(404);
    expect(await consultar(e.cookie.externo)).toBe(404);
  });

  it('inativar é do Supervisor em diante', async () => {
    const e = await preparar();
    const b = (await criar(e.cookie.financeiro)).json();
    const inativar = (cookie: string) =>
      a
        .chamar('PUT', `/api/beneficiarios/${b.id}/situacao`, {
          cookie,
          corpo: { situacao: 'inativo' },
        })
        .then((r) => r.statusCode);
    expect(await inativar(e.cookie.interno)).toBe(404);
    expect(await inativar(e.cookie.supervisor)).toBe(200);
  });
});
