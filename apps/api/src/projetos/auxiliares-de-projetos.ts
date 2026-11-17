/* eslint-disable @typescript-eslint/no-explicit-any -- corpos JSON das respostas, sem tipo */
import { expect, inject } from 'vitest';
import { iniciarAmbiente, type Ambiente } from '../teste/auxiliares.js';

export let a: Ambiente;

/**
 * Equipe de cada perfil para os testes do legislativo. `semLegislativo` tem nível mas não a habilitação
 * LG; `financeiro` tem só FI (alcança beneficiários, não projetos).
 */
export async function preparar(opcoes: Parameters<typeof iniciarAmbiente>[1] = {}) {
  a = await iniciarAmbiente(inject('urlAdminDeTeste'), opcoes);
  const admin = await a.criarUsuario({ perfil: 'administrador' });
  const chefe = await a.criarUsuario({ perfil: 'chefe', habilitacoes: ['LG'] });
  const supervisor = await a.criarUsuario({ perfil: 'supervisor', habilitacoes: ['LG'] });
  const interno = await a.criarUsuario({ perfil: 'assessor_interno', habilitacoes: ['LG'] });
  const interno2 = await a.criarUsuario({ perfil: 'assessor_interno', habilitacoes: ['LG'] });
  const externo = await a.criarUsuario({ perfil: 'assessor_externo', habilitacoes: ['LG'] });
  const semLegislativo = await a.criarUsuario({ perfil: 'assessor_interno', habilitacoes: ['AT'] });
  const financeiro = await a.criarUsuario({ perfil: 'assessor_interno', habilitacoes: ['FI'] });
  const parlamentar = await a.criarUsuario({ perfil: 'parlamentar' });

  const ids = async (email: string) =>
    Number(
      (
        await a.banco.conectar('api').cliente<
          { id: string }[]
        >`SELECT u.id FROM usuario u JOIN conta_acesso c ON c.id = u.conta_id WHERE c.email = ${email}`
      )[0]?.id,
    );
  const contas = {
    admin,
    chefe,
    supervisor,
    interno,
    interno2,
    externo,
    semLegislativo,
    financeiro,
    parlamentar,
  };
  const id: Record<keyof typeof contas, number> = {} as never;
  const cookie: Record<keyof typeof contas, string> = {} as never;
  for (const [nome, conta] of Object.entries(contas)) {
    id[nome as keyof typeof contas] = await ids(conta.email);
    cookie[nome as keyof typeof contas] = await a.sessaoDe(conta.email);
  }
  return { contas, id, cookie };
}

export const novoBeneficiario = (extra: object = {}) => ({
  nomeFantasia: 'Prefeitura de Exemplo',
  razaoSocial: 'Município de Exemplo',
  cnpj: '11.222.333/0001-81',
  natureza: 'municipio',
  cep: '79002-000',
  logradouro: 'Rua das Flores',
  numero: '100',
  bairro: 'Centro',
  cidade: 'Campo Grande',
  estado: 'MS',
  ...extra,
});

export const categoriaPor = async (cookie: string, nome: string): Promise<number> => {
  const r = (await a.chamar('GET', '/api/legislativo/categorias', { cookie })).json();
  return r.find((c: any) => c.nome === nome).id;
};

export const etapaDeProjeto = async (cookie: string, nome: string): Promise<number> => {
  const r = (await a.chamar('GET', '/api/projetos/etapas', { cookie })).json();
  return r.find((e: any) => e.nome === nome).id;
};

export const novoProjeto = async (cookie: string, extra: object = {}) => {
  const corpo = {
    titulo: 'Programa de poda segura',
    ementa: 'Institui o programa municipal de poda segura de árvores urbanas.',
    autoria: 'Dep. Adriana Accorsi',
    tipoProposicaoId: await categoriaPor(cookie, 'Projeto de lei'),
    ...extra,
  };
  const r = await a.chamar('POST', '/api/projetos', { cookie, corpo });
  expect(r.statusCode, r.body).toBe(201);
  return r.json() as Record<string, any>;
};
