import { afterEach, describe, expect, it } from 'vitest';
import { a, encerrar, marcar, preparar } from './auxiliares-de-agenda.js';

afterEach(encerrar);

const nomeDe = async (id: number): Promise<string> => {
  const [u] = await a.banco.conectar('api').cliente<
    { nome: string }[]
  >`SELECT nome FROM usuario WHERE id = ${id}`;
  return u!.nome;
};

const mencoes = async () =>
  a.banco.conectar('api').cliente<{ destinatario_id: string }[]>`
    SELECT destinatario_id FROM aviso WHERE natureza = 'mencao' ORDER BY id`;

describe('menções na descrição do compromisso', () => {
  it('avisa quem tem Agenda e é citado; ignora quem não tem a habilitação', async () => {
    const e = await preparar();
    const colega = await nomeDe(e.id.interno2);
    const semAgenda = await nomeDe(e.id.semAgenda);
    const r = await marcar(e.cookie.interno, {
      descricao: `Levar a pauta, avisar @${colega} e @${semAgenda}`,
      mencoes: [e.id.interno2, e.id.semAgenda],
    });
    expect(r.statusCode, r.body).toBe(201);
    expect((await mencoes()).map((m) => Number(m.destinatario_id))).toEqual([e.id.interno2]);
  });

  it('remarcar sem mudar a citação não avisa de novo', async () => {
    const e = await preparar();
    const colega = await nomeDe(e.id.interno2);
    const criado = (
      await marcar(e.cookie.interno, {
        descricao: `Avisar @${colega}`,
        mencoes: [e.id.interno2],
      })
    ).json();
    const r = await a.chamar('PATCH', `/api/agenda/compromissos/${criado.compromisso.id}`, {
      cookie: e.cookie.interno,
      corpo: { descricao: `Avisar @${colega} também`, mencoes: [e.id.interno2] },
    });
    expect(r.statusCode, r.body).toBe(200);
    expect(await mencoes()).toHaveLength(1);
  });
});
