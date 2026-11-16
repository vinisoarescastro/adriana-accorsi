/* eslint-disable @typescript-eslint/no-explicit-any -- corpos JSON das respostas, sem tipo */
import { afterEach, describe, expect, inject, it } from 'vitest';
import { arquivos, iniciarAmbiente, type Ambiente } from '../teste/auxiliares.js';

let a: Ambiente;
afterEach(async () => {
  await a.encerrar();
});

async function preparar() {
  a = await iniciarAmbiente(inject('urlAdminDeTeste'));
  await a.criarUsuario({ perfil: 'administrador' });
  const interno = await a.criarUsuario({ perfil: 'assessor_interno', habilitacoes: ['AT'] });
  const externo = await a.criarUsuario({ perfil: 'assessor_externo', habilitacoes: ['AT'] });
  const supervisor = await a.criarUsuario({ perfil: 'supervisor', habilitacoes: ['AT'] });
  const cookie = {
    interno: await a.sessaoDe(interno.email),
    externo: await a.sessaoDe(externo.email),
    supervisor: await a.sessaoDe(supervisor.email),
  };
  const demanda = (
    await a.chamar('POST', '/api/demandas', {
      cookie: cookie.interno,
      corpo: { solicitante: { nome: 'Maria', telefone: '67999990000' }, titulo: 'Poda' },
    })
  ).json().demanda;
  const envio = await a.app.inject({
    method: 'POST',
    url: `/api/demandas/${demanda.id}/documentos?nome=nota.pdf&natureza=outro`,
    payload: arquivos.pdf(),
    headers: { cookie: cookie.interno, 'content-type': 'application/pdf' },
  });
  return { cookie, demanda, documento: envio.json()[0] };
}

describe('corrigir o nome e a natureza de um documento', () => {
  it('muda o nome e a natureza, mantém o arquivo e registra a correção na trilha', async () => {
    const { cookie, documento } = await preparar();
    const r = await a.chamar('PATCH', `/api/documentos/${documento.id}`, {
      cookie: cookie.interno,
      corpo: { nome: 'oficio-secretaria-saude.pdf', natureza: 'oficio' },
    });
    expect(r.statusCode, r.body).toBe(200);
    const editado = r.json().find((d: any) => d.id === documento.id);
    expect(editado).toMatchObject({ nome: 'oficio-secretaria-saude.pdf', natureza: 'oficio' });
    expect(editado.tamanho).toBe(documento.tamanho);

    const baixado = await a.app.inject({
      method: 'GET',
      url: `/api/documentos/${documento.id}/conteudo`,
      headers: { cookie: cookie.interno },
    });
    expect(baixado.statusCode).toBe(200);
    expect(baixado.headers['content-disposition']).toContain('oficio-secretaria-saude.pdf');
    expect((await a.trilha('demanda.editar_documento')).length).toBe(1);
  });

  it('recusa corpo vazio, documento removido e quem não alcança a demanda', async () => {
    const { cookie, documento } = await preparar();
    expect(
      (
        await a.chamar('PATCH', `/api/documentos/${documento.id}`, {
          cookie: cookie.interno,
          corpo: {},
        })
      ).statusCode,
    ).toBe(400);
    // O Assessor Externo que não responde pela demanda não a enxerga.
    expect(
      (
        await a.chamar('PATCH', `/api/documentos/${documento.id}`, {
          cookie: cookie.externo,
          corpo: { nome: 'x.pdf' },
        })
      ).statusCode,
    ).toBeGreaterThanOrEqual(403);
    const remocao = await a.chamar('DELETE', `/api/documentos/${documento.id}`, {
      cookie: cookie.supervisor,
    });
    expect(remocao.statusCode, remocao.body).toBe(200);
    expect(
      (
        await a.chamar('PATCH', `/api/documentos/${documento.id}`, {
          cookie: cookie.interno,
          corpo: { nome: 'y.pdf' },
        })
      ).statusCode,
    ).toBe(409);
  });
});
