/* eslint-disable @typescript-eslint/no-explicit-any -- corpos JSON das respostas, sem tipo */
import { inject } from 'vitest';
import { iniciarAmbiente, type Ambiente } from '../teste/auxiliares.js';

export let a: Ambiente;

export async function encerrar() {
  if (a) await a.encerrar();
  a = undefined as never;
}

export async function preparar() {
  a = await iniciarAmbiente(inject('urlAdminDeTeste'));
  const admin = await a.criarUsuario({ perfil: 'administrador' });
  const parlamentar = await a.criarUsuario({ perfil: 'parlamentar' });
  const chefe = await a.criarUsuario({ perfil: 'chefe', habilitacoes: ['AG'] });
  const supervisor = await a.criarUsuario({ perfil: 'supervisor', habilitacoes: ['AG'] });
  const interno = await a.criarUsuario({ perfil: 'assessor_interno', habilitacoes: ['AG'] });
  const interno2 = await a.criarUsuario({ perfil: 'assessor_interno', habilitacoes: ['AG'] });
  const externo = await a.criarUsuario({ perfil: 'assessor_externo', habilitacoes: ['AG'] });
  const semAgenda = await a.criarUsuario({ perfil: 'assessor_interno', habilitacoes: ['AT'] });
  const uid = async (email: string) =>
    Number(
      (
        await a.banco.conectar('api').cliente<
          { id: string }[]
        >`SELECT u.id FROM usuario u JOIN conta_acesso c ON c.id = u.conta_id WHERE c.email = ${email}`
      )[0]?.id,
    );
  const contas = { admin, parlamentar, chefe, supervisor, interno, interno2, externo, semAgenda };
  const cookie: Record<keyof typeof contas, string> = {} as never;
  const id: Record<keyof typeof contas, number> = {} as never;
  for (const [nome, conta] of Object.entries(contas)) {
    cookie[nome as keyof typeof contas] = await a.sessaoDe(conta.email);
    id[nome as keyof typeof contas] = await uid(conta.email);
  }
  return { cookie, id };
}

export const hora = (h: number, dia = 20) =>
  `2026-11-${String(dia).padStart(2, '0')}T${String(h).padStart(2, '0')}:00:00-03:00`;

export const marcar = (cookie: string, corpo: object = {}) =>
  a.chamar('POST', '/api/agenda/compromissos', {
    cookie,
    corpo: { titulo: 'Reunião com o prefeito', inicio: hora(10), fim: hora(11), ...corpo },
  });

export const agenda = async (cookie: string, extra = '') =>
  (
    await a.chamar(
      'GET',
      `/api/agenda?de=${encodeURIComponent(hora(0))}&ate=${encodeURIComponent(hora(23))}${extra}`,
      { cookie },
    )
  ).json() as { itens: any[] };
