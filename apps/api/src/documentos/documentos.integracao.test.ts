/* eslint-disable @typescript-eslint/no-explicit-any -- corpos JSON das respostas, sem tipo */
import { createHash } from 'node:crypto';
import { afterEach, describe, expect, inject, it } from 'vitest';
import { antivirusDeTeste, arquivos, iniciarAmbiente, type Ambiente } from '../teste/auxiliares.js';
import type { Antivirus } from './antivirus.js';

let a: Ambiente;
afterEach(async () => {
  await a.encerrar();
});

async function preparar(opcoes: Parameters<typeof iniciarAmbiente>[1] = {}) {
  a = await iniciarAmbiente(inject('urlAdminDeTeste'), opcoes);
  const admin = await a.criarUsuario({ perfil: 'administrador' });
  const supervisor = await a.criarUsuario({ perfil: 'supervisor', habilitacoes: ['AT'] });
  const interno = await a.criarUsuario({ perfil: 'assessor_interno', habilitacoes: ['AT'] });
  const externo = await a.criarUsuario({ perfil: 'assessor_externo', habilitacoes: ['AT'] });
  const cookie = {
    admin: await a.sessaoDe(admin.email),
    supervisor: await a.sessaoDe(supervisor.email),
    interno: await a.sessaoDe(interno.email),
    externo: await a.sessaoDe(externo.email),
  };
  const demanda = (
    await a.chamar('POST', '/api/demandas', {
      cookie: cookie.interno,
      corpo: { solicitante: { nome: 'Maria', telefone: '67999990000' }, titulo: 'Poda' },
    })
  ).json().demanda;
  return { cookie, demanda };
}

const enviar = (
  cookie: string,
  demandaId: number,
  bytes: Buffer | string,
  nome = 'comprovante.pdf',
  tipo = 'application/pdf',
  natureza = 'comprovante',
) =>
  a.app.inject({
    method: 'POST',
    url: `/api/demandas/${demandaId}/documentos?nome=${encodeURIComponent(nome)}&natureza=${natureza}`,
    payload: bytes,
    headers: { cookie, 'content-type': tipo },
  });

describe('anexar', () => {
  it('aceita PDF, PNG, JPEG e ZIP, guarda no armazenamento privado e registra os metadados e a trilha', async () => {
    const { cookie, demanda } = await preparar();
    const casos = [
      ['nota.pdf', arquivos.pdf(), 'application/pdf'],
      ['foto.png', arquivos.png(), 'image/png'],
      ['foto.jpg', arquivos.jpeg(), 'image/jpeg'],
      ['pacote.zip', arquivos.zip(), 'application/zip'],
    ] as const;
    for (const [nome, bytes, tipo] of casos) {
      const r = await enviar(cookie.interno, demanda.id, bytes, nome, tipo);
      expect(r.statusCode, nome).toBe(201);
    }
    const documentos = (
      await a.chamar('GET', `/api/demandas/${demanda.id}`, { cookie: cookie.interno })
    ).json().documentos;
    expect(documentos.map((d: any) => d.tipo)).toEqual([
      'application/pdf',
      'image/png',
      'image/jpeg',
      'application/zip',
    ]);
    expect(documentos[0]).toMatchObject({
      nome: 'nota.pdf',
      natureza: 'comprovante',
      removido: false,
    });
    expect(a.armazenamento.objetos.size).toBe(4);

    const [linha] = await a.banco.conectar('api').cliente<
      { hash_sha256: string; tamanho: string; varredura: string; chave_armazenamento: string }[]
    >`
      SELECT hash_sha256, tamanho, varredura, chave_armazenamento FROM documento ORDER BY id LIMIT 1`;
    expect(linha?.hash_sha256).toBe(createHash('sha256').update(arquivos.pdf()).digest('hex'));
    expect(Number(linha?.tamanho)).toBe(arquivos.pdf().length);
    expect(linha?.chave_armazenamento).toMatch(/^documentos\/demandas\/\d+\/[0-9a-f-]{36}\.pdf$/);
    expect(linha?.varredura).toBe('nao_verificado'); // sem antivírus configurado (desenvolvimento)
    expect((await a.trilha('demanda.anexar_documento')).length).toBe(4);
  });

  it('o tipo é decidido pelo CONTEÚDO: executável renomeado para .pdf é recusado (critério 8)', async () => {
    const { cookie, demanda } = await preparar();
    const executavel = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(200, 0x90)]);
    const invalidos: [Buffer, string][] = [
      [executavel, 'application/pdf'],
      [Buffer.from('<script>alert(1)</script>'), 'application/pdf'],
      [Buffer.from('texto qualquer'), 'application/zip'],
      [Buffer.from('#!/bin/sh rm -rf /'), 'application/octet-stream'],
    ];
    for (const [bytes, tipo] of invalidos) {
      const r = await enviar(cookie.interno, demanda.id, bytes, 'boleto.pdf', tipo);
      expect(r.statusCode).toBe(400);
      expect(r.json().codigo).toBe('arquivo_invalido');
    }
    expect(a.armazenamento.objetos.size).toBe(0);

    // O cabeçalho mente: um PDF de verdade enviado como outro tipo entra como PDF.
    const honesto = await enviar(
      cookie.interno,
      demanda.id,
      arquivos.pdf(),
      'x.png',
      'application/octet-stream',
    );
    expect(honesto.statusCode).toBe(201);
    expect(honesto.json()[0].tipo).toBe('application/pdf');
    expect(a.armazenamento.objetos.size).toBe(1);
  });

  it('recusa arquivo vazio, JSON no lugar do arquivo, natureza inventada e o maior que 25 MB', async () => {
    const { cookie, demanda } = await preparar();
    expect((await enviar(cookie.interno, demanda.id, Buffer.alloc(0))).statusCode).toBe(400);
    expect(
      (
        await a.chamar('POST', `/api/demandas/${demanda.id}/documentos?nome=a.pdf`, {
          cookie: cookie.interno,
          corpo: { oi: 1 },
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await enviar(
          cookie.interno,
          demanda.id,
          arquivos.pdf(),
          'a.pdf',
          'application/pdf',
          'inventada',
        )
      ).statusCode,
    ).toBe(400);

    const grande = await enviar(
      cookie.interno,
      demanda.id,
      arquivos.pdf(25 * 1024 * 1024),
      'grande.pdf',
    );
    expect([400, 413]).toContain(grande.statusCode);
    const limite = await enviar(
      cookie.interno,
      demanda.id,
      arquivos.pdf(25 * 1024 * 1024 - 20),
      'no-limite.pdf',
    );
    expect(limite.statusCode).toBe(201);
    expect(a.armazenamento.objetos.size).toBe(1);
  });

  it('limpa o nome do arquivo (sem caminho nem caracteres de controle)', async () => {
    const { cookie, demanda } = await preparar();
    await enviar(cookie.interno, demanda.id, arquivos.pdf(), '../../etc/passwd.pdf');
    await enviar(cookie.interno, demanda.id, arquivos.pdf(), 'C:\\Users\\x\\fatura.pdf');
    const nomes = (await a.chamar('GET', `/api/demandas/${demanda.id}`, { cookie: cookie.interno }))
      .json()
      .documentos.map((d: any) => d.nome);
    expect(nomes).toEqual(['passwd.pdf', 'fatura.pdf']);
  });

  it('o Assessor Externo não anexa nem baixa, e quem não alcança a demanda recebe 404', async () => {
    const { cookie, demanda } = await preparar();
    expect((await enviar(cookie.externo, demanda.id, arquivos.pdf())).statusCode).toBe(404);
    expect((await enviar(cookie.interno, 999999, arquivos.pdf())).statusCode).toBe(404);
  });

  it('se o registro falhar, os bytes já gravados são apagados (nada de arquivo órfão)', async () => {
    const { cookie, demanda } = await preparar();
    // Faz o INSERT em documento falhar de verdade: a API perde a permissão.
    await a.banco.conectar('migracao').cliente.unsafe('REVOKE INSERT ON documento FROM app_api');

    const r = await enviar(cookie.interno, demanda.id, arquivos.pdf());
    expect(r.statusCode).toBe(500);
    expect(a.armazenamento.objetos.size).toBe(0);
    const [c] = await a.banco.conectar('migracao').cliente<
      { total: string }[]
    >`SELECT count(*) AS total FROM documento`;
    expect(Number(c?.total)).toBe(0);
  });
});

describe('antivírus (fecha a fragilidade "ZIP aceito")', () => {
  it('arquivo infectado nunca é guardado, e a recusa fica na trilha (sem o arquivo)', async () => {
    const { cookie, demanda } = await preparar({ antivirus: antivirusDeTeste });
    const infectado = Buffer.concat([
      arquivos.zip(),
      Buffer.from('EICAR-STANDARD-ANTIVIRUS-TEST-FILE'),
    ]);

    const r = await enviar(cookie.interno, demanda.id, infectado, 'virus.zip', 'application/zip');
    expect(r.statusCode).toBe(400);
    expect(r.json().mensagem).toMatch(/verificação de segurança/);
    expect(a.armazenamento.objetos.size).toBe(0);
    const [c] = await a.banco.conectar('api').cliente<
      { total: string }[]
    >`SELECT count(*) AS total FROM documento`;
    expect(Number(c?.total)).toBe(0);
    const [recusa] = await a.trilha('demanda.documento_recusado');
    expect(recusa?.valor_novo).toEqual({ nome: 'virus.zip', motivo: 'antivirus' });
  });

  it('arquivo limpo entra marcado como verificado', async () => {
    const { cookie, demanda } = await preparar({ antivirus: antivirusDeTeste });
    expect(
      (await enviar(cookie.interno, demanda.id, arquivos.zip(), 'ok.zip', 'application/zip'))
        .statusCode,
    ).toBe(201);
    const [d] = await a.banco.conectar('api').cliente<
      { varredura: string }[]
    >`SELECT varredura FROM documento`;
    expect(d?.varredura).toBe('limpo');
  });

  it('antivírus fora do ar: falha fechada (503), nada é guardado', async () => {
    const quebrado: Antivirus = { verificar: () => Promise.reject(new Error('conexão recusada')) };
    const { cookie, demanda } = await preparar({ antivirus: quebrado });
    const r = await enviar(cookie.interno, demanda.id, arquivos.pdf());
    expect(r.statusCode).toBe(503);
    expect(r.json().codigo).toBe('verificacao_indisponivel');
    expect(a.armazenamento.objetos.size).toBe(0);
  });
});

describe('baixar e remover', () => {
  it('baixa SEMPRE como anexo, com o tipo real e sem permitir interpretação pelo navegador', async () => {
    const { cookie, demanda } = await preparar();
    const bytes = arquivos.pdf(500);
    const doc = (
      await enviar(cookie.interno, demanda.id, bytes, 'Comprovante de março ç.pdf')
    ).json()[0];

    const r = await a.chamar('GET', `/api/documentos/${doc.id}/conteudo`, {
      cookie: cookie.supervisor,
    });
    expect(r.statusCode).toBe(200);
    expect(r.rawPayload.equals(bytes)).toBe(true);
    expect(r.headers['content-type']).toBe('application/pdf');
    expect(r.headers['content-disposition']).toMatch(
      /^attachment; filename="Comprovante de mar_o _\.pdf"; filename\*=UTF-8''Comprovante%20de%20mar%C3%A7o%20%C3%A7\.pdf$/,
    );
    expect(r.headers['x-content-type-options']).toBe('nosniff');
    expect(r.headers['content-security-policy']).toContain('sandbox');

    expect(
      (await a.chamar('GET', `/api/documentos/${doc.id}/conteudo`, { cookie: cookie.externo }))
        .statusCode,
    ).toBe(404);
    expect(
      (await a.chamar('GET', '/api/documentos/999999/conteudo', { cookie: cookie.interno }))
        .statusCode,
    ).toBe(404);
  });

  it('remover só pelo Supervisor, MARCA como removido e mantém os bytes e o registro', async () => {
    const { cookie, demanda } = await preparar();
    const doc = (await enviar(cookie.interno, demanda.id, arquivos.png())).json()[0];

    expect(
      (await a.chamar('DELETE', `/api/documentos/${doc.id}`, { cookie: cookie.interno }))
        .statusCode,
    ).toBe(404);
    const r = await a.chamar('DELETE', `/api/documentos/${doc.id}`, { cookie: cookie.supervisor });
    expect(r.statusCode).toBe(200);
    expect(r.json()[0]).toMatchObject({ removido: true });
    expect(r.json()[0].removidoEm).toBeTruthy();

    expect(a.armazenamento.objetos.size).toBe(1);
    expect(
      (await a.chamar('GET', `/api/documentos/${doc.id}/conteudo`, { cookie: cookie.interno }))
        .statusCode,
    ).toBe(404);
    expect(
      (await a.chamar('DELETE', `/api/documentos/${doc.id}`, { cookie: cookie.supervisor }))
        .statusCode,
    ).toBe(409);
    expect((await a.trilha('demanda.remover_documento')).length).toBe(1);
  });
});
