/* eslint-disable @typescript-eslint/no-explicit-any -- corpos JSON das respostas, sem tipo */
import { expect } from 'vitest';
import {
  a,
  categoriaPor,
  novoBeneficiario,
  preparar as prepararLegislativo,
} from '../projetos/auxiliares-de-projetos.js';

export { a };

/** A mesma equipe do legislativo (LG; `financeiro` só com FI), mais um beneficiário já cadastrado. */
export async function preparar() {
  const e = await prepararLegislativo();
  const r = await a.chamar('POST', '/api/beneficiarios', {
    cookie: e.cookie.interno,
    corpo: novoBeneficiario(),
  });
  expect(r.statusCode, r.body).toBe(201);
  const outro = await a.chamar('POST', '/api/beneficiarios', {
    cookie: e.cookie.interno,
    corpo: novoBeneficiario({ nomeFantasia: 'Outra Prefeitura', cnpj: '12ABC34501DE35' }),
  });
  return {
    ...e,
    beneficiario: r.json().id as number,
    outroBeneficiario: outro.json().id as number,
  };
}

export const tipoDeEmenda = async (cookie: string, nome = 'Individual'): Promise<number> => {
  const r = (await a.chamar('GET', '/api/emendas/tipos', { cookie })).json();
  return r.find((t: any) => t.nome === nome).id;
};

export const etapaDeEmenda = async (cookie: string, nome: string): Promise<number> => {
  const r = (await a.chamar('GET', '/api/emendas/etapas', { cookie })).json();
  return r.find((x: any) => x.nome === nome).id;
};

export const novaEmenda = async (cookie: string, extra: object = {}) => {
  const corpo = {
    identificacao: 'EMD 2026/0001',
    exercicio: 2026,
    tipoId: await tipoDeEmenda(cookie),
    finalidade: 'Aquisição de ambulância para o município',
    valor: '100000.00',
    ...extra,
  };
  const r = await a.chamar('POST', '/api/emendas', { cookie, corpo });
  expect(r.statusCode, r.body).toBe(201);
  return r.json() as Record<string, any>;
};

export const destinar = (cookie: string, emendaId: number, beneficiarioId: number, valor: string) =>
  a.chamar('POST', `/api/emendas/${emendaId}/destinacoes`, {
    cookie,
    corpo: { beneficiarioId, valor, finalidade: 'Ambulância' },
  });

export { categoriaPor };
