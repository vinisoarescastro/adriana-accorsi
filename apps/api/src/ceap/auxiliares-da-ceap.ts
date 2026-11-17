/* eslint-disable @typescript-eslint/no-explicit-any -- corpos JSON das respostas, sem tipo */
import { expect, inject } from 'vitest';
import { antivirusDeTeste, arquivos, iniciarAmbiente, type Ambiente } from '../teste/auxiliares.js';

export let a: Ambiente;
export { arquivos };

/** Equipe financeira: todos com FI, exceto `semFinanceiro`. O Administrador e a Parlamentar têm todas as habilitações. */
export async function preparar() {
  a = await iniciarAmbiente(inject('urlAdminDeTeste'), { antivirus: antivirusDeTeste });
  const contas = {
    admin: await a.criarUsuario({ perfil: 'administrador' }),
    parlamentar: await a.criarUsuario({ perfil: 'parlamentar' }),
    chefe: await a.criarUsuario({ perfil: 'chefe', habilitacoes: ['FI'] }),
    supervisor: await a.criarUsuario({ perfil: 'supervisor', habilitacoes: ['FI'] }),
    supervisor2: await a.criarUsuario({ perfil: 'supervisor', habilitacoes: ['FI'] }),
    interno: await a.criarUsuario({ perfil: 'assessor_interno', habilitacoes: ['FI'] }),
    interno2: await a.criarUsuario({ perfil: 'assessor_interno', habilitacoes: ['FI'] }),
    externo: await a.criarUsuario({ perfil: 'assessor_externo', habilitacoes: ['FI'] }),
    semFinanceiro: await a.criarUsuario({ perfil: 'assessor_interno', habilitacoes: ['AT'] }),
  };
  const ids = async (email: string) =>
    Number(
      (
        await a.banco.conectar('api').cliente<
          { id: string }[]
        >`SELECT u.id FROM usuario u JOIN conta_acesso c ON c.id = u.conta_id WHERE c.email = ${email}`
      )[0]?.id,
    );
  const id: Record<keyof typeof contas, number> = {} as never;
  const cookie: Record<keyof typeof contas, string> = {} as never;
  for (const [nome, conta] of Object.entries(contas)) {
    id[nome as keyof typeof contas] = await ids(conta.email);
    cookie[nome as keyof typeof contas] = await a.sessaoDe(conta.email);
  }
  return { contas, id, cookie };
}

/** Abre a cota mensal vigente desde o começo do exercício. */
export const definirCota = (cookie: string, valor = '1000.00', vigenteDe = '2026-01-01') =>
  a.chamar('POST', '/api/ceap/parametros', {
    cookie,
    corpo: { chave: 'cota_mensal', valor, vigenteDe },
  });

export const categoriaDaCeap = async (
  cookie: string,
  nome = 'Passagens aéreas',
): Promise<number> => {
  const r = (await a.chamar('GET', '/api/ceap/categorias', { cookie })).json();
  return r.find((c: any) => c.nome === nome).id;
};

export const novaDespesa = async (cookie: string, extra: object = {}, esperado = 201) => {
  const corpo = {
    categoriaId: await categoriaDaCeap(cookie),
    descricao: 'Passagem para Brasília',
    valor: '100.00',
    dataDocumento: '2026-11-05',
    fornecedorNome: 'Companhia Aérea',
    fornecedorDocumento: '11.222.333/0001-81',
    numeroDocumento: 'NF-123',
    ...extra,
  };
  const r = await a.chamar('POST', '/api/ceap/despesas', { cookie, corpo });
  expect(r.statusCode, r.body).toBe(esperado);
  return r.json() as Record<string, any>;
};

export const anexar = (
  cookie: string,
  despesaId: number,
  bytes: Buffer = arquivos.pdf(),
  nome = 'nota.pdf',
) =>
  a.app.inject({
    method: 'POST',
    url: `/api/ceap/despesas/${despesaId}/comprovantes?nome=${encodeURIComponent(nome)}`,
    headers: { cookie, 'content-type': 'application/pdf' },
    payload: bytes,
  });

export const enviar = (cookie: string, id: number) =>
  a.chamar('POST', `/api/ceap/despesas/${id}/enviar`, { cookie });
export const decidir = (cookie: string, id: number, corpo: object = { decisao: 'aprovar' }) =>
  a.chamar('POST', `/api/ceap/despesas/${id}/decidir`, { cookie, corpo });

/** Lança, anexa o comprovante e envia para análise. */
export async function despesaEmAnalise(cookie: string, extra: object = {}) {
  const d = await novaDespesa(cookie, extra);
  expect((await anexar(cookie, d.id)).statusCode).toBe(201);
  const r = await enviar(cookie, d.id);
  expect(r.statusCode, r.body).toBe(200);
  return r.json() as Record<string, any>;
}

export const saldo = async (cookie: string, ano = 2026) =>
  (await a.chamar('GET', `/api/ceap/saldo?ano=${ano}`, { cookie })).json();
