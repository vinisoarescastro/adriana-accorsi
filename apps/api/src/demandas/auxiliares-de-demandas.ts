/* eslint-disable @typescript-eslint/no-explicit-any -- corpos JSON das respostas, sem tipo */
import { inject } from 'vitest';
import { expect } from 'vitest';
import { iniciarAmbiente, type Ambiente } from '../teste/auxiliares.js';

export let a: Ambiente;

export async function preparar(opcoes: Parameters<typeof iniciarAmbiente>[1] = {}) {
  a = await iniciarAmbiente(inject('urlAdminDeTeste'), opcoes);
  const admin = await a.criarUsuario({ perfil: 'administrador' });
  const chefe = await a.criarUsuario({ perfil: 'chefe', habilitacoes: ['AT'] });
  const supervisor = await a.criarUsuario({ perfil: 'supervisor', habilitacoes: ['AT'] });
  const interno = await a.criarUsuario({ perfil: 'assessor_interno', habilitacoes: ['AT'] });
  const externo = await a.criarUsuario({ perfil: 'assessor_externo', habilitacoes: ['AT'] });
  const externo2 = await a.criarUsuario({ perfil: 'assessor_externo', habilitacoes: ['AT'] });
  const semAtendimento = await a.criarUsuario({ perfil: 'assessor_interno', habilitacoes: ['AG'] });
  const ids = async (email: string) =>
    Number(
      (
        await a.banco.conectar('api').cliente<
          { id: string }[]
        >`SELECT u.id FROM usuario u JOIN conta_acesso c ON c.id = u.conta_id WHERE c.email = ${email}`
      )[0]?.id,
    );
  return {
    contas: { admin, chefe, supervisor, interno, externo, externo2, semAtendimento },
    id: {
      admin: await ids(admin.email),
      supervisor: await ids(supervisor.email),
      interno: await ids(interno.email),
      externo: await ids(externo.email),
      externo2: await ids(externo2.email),
      semAtendimento: await ids(semAtendimento.email),
    },
    cookie: {
      admin: await a.sessaoDe(admin.email),
      chefe: await a.sessaoDe(chefe.email),
      supervisor: await a.sessaoDe(supervisor.email),
      interno: await a.sessaoDe(interno.email),
      externo: await a.sessaoDe(externo.email),
      externo2: await a.sessaoDe(externo2.email),
      semAtendimento: await a.sessaoDe(semAtendimento.email),
    },
  };
}

export const novaDemanda = (extra: object = {}) => ({
  solicitante: { nome: 'Maria da Silva', telefone: '(67) 99999-0000' },
  titulo: 'Poda de árvore na Rua das Flores',
  ...extra,
});

export const registrar = async (cookie: string, corpo: object = novaDemanda()) => {
  const r = await a.chamar('POST', '/api/demandas', { cookie, corpo });
  expect(r.statusCode, r.body).toBe(201);
  return r.json() as {
    demanda: Record<string, any>;
    linkDeAcompanhamento: string;
    pessoaCriada: boolean;
  };
};

export const etapaPor = async (cookie: string, nome: string): Promise<number> => {
  const q = (await a.chamar('GET', '/api/demandas/quadro', { cookie })).json();
  return q.colunas.find((c: any) => c.etapa.nome === nome).etapa.id;
};
