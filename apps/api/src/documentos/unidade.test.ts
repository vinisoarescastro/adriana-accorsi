import { createServer, type Server } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import {
  cifrarSegredoDeLink,
  decifrarSegredoDeLink,
  gerarSegredoDeLink,
  hashDoSegredoDeLink,
  montarLinkDeAcompanhamento,
} from '../demandas/link.js';
import { AntivirusClamd, ErroDeAntivirus } from './antivirus.js';
import { limparNomeDoArquivo, reconhecerDocumento } from './tipos.js';

describe('reconhecerDocumento (pelos primeiros bytes)', () => {
  it('reconhece os quatro tipos e recusa o resto', () => {
    expect(reconhecerDocumento(Buffer.from('%PDF-1.4 ...'))?.tipo).toBe('application/pdf');
    expect(
      reconhecerDocumento(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))?.tipo,
    ).toBe('image/png');
    expect(reconhecerDocumento(Buffer.from([0xff, 0xd8, 0xff, 0xdb]))?.tipo).toBe('image/jpeg');
    expect(reconhecerDocumento(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0]))?.tipo).toBe(
      'application/zip',
    );
    expect(reconhecerDocumento(Buffer.from([0x50, 0x4b, 0x05, 0x06]))?.tipo).toBe(
      'application/zip',
    );
    for (const ruim of [
      Buffer.from('MZ\x90\x00'),
      Buffer.from('<html>'),
      Buffer.from('#!/bin/sh'),
      Buffer.from('%PD'),
      Buffer.alloc(0),
    ]) {
      expect(reconhecerDocumento(ruim)).toBeNull();
    }
  });
});

describe('limparNomeDoArquivo', () => {
  it.each([
    ['fatura.pdf', 'fatura.pdf'],
    ['../../etc/passwd', 'passwd'],
    ['C:\\Users\\x\\nota.pdf', 'nota.pdf'],
    ['  espaços.pdf  ', 'espaços.pdf'],
    ['.oculto', 'oculto'],
    ['a\u0000b\u001fc.pdf', 'abc.pdf'],
    ['', 'documento'],
    ['///', 'documento'],
  ])('"%s" vira "%s"', (entrada, esperado) => {
    expect(limparNomeDoArquivo(entrada)).toBe(esperado);
  });

  it('limita o tamanho', () => {
    expect(limparNomeDoArquivo('a'.repeat(500)).length).toBe(200);
  });
});

describe('link de acompanhamento', () => {
  it('o segredo tem 256 bits, o hash não o revela e a cópia cifrada volta ao original', () => {
    const segredo = gerarSegredoDeLink();
    expect(segredo).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(gerarSegredoDeLink()).not.toBe(segredo);
    expect(hashDoSegredoDeLink(segredo)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashDoSegredoDeLink(segredo)).not.toContain(segredo);

    const chave = 'segredo-da-aplicacao-com-mais-de-32-caracteres';
    const cifrado = cifrarSegredoDeLink(segredo, chave);
    expect(cifrado).not.toContain(segredo);
    expect(cifrarSegredoDeLink(segredo, chave)).not.toBe(cifrado); // IV aleatório
    expect(decifrarSegredoDeLink(cifrado, chave)).toBe(segredo);
  });

  it('com outra chave, ou adulterado, não decifra', () => {
    const cifrado = cifrarSegredoDeLink('segredo', 'chave-um-com-mais-de-32-caracteres-aaaa');
    expect(() =>
      decifrarSegredoDeLink(cifrado, 'chave-dois-com-mais-de-32-caracteres-bbb'),
    ).toThrow();
    const adulterado = Buffer.from(cifrado, 'base64url');
    adulterado[adulterado.length - 1] = (adulterado[adulterado.length - 1] ?? 0) ^ 1;
    expect(() =>
      decifrarSegredoDeLink(
        adulterado.toString('base64url'),
        'chave-um-com-mais-de-32-caracteres-aaaa',
      ),
    ).toThrow();
  });

  it('monta o endereço público', () => {
    expect(montarLinkDeAcompanhamento('acompanhe.exemplo.com', 'abc')).toBe(
      'https://acompanhe.exemplo.com/a/abc',
    );
  });
});

describe('AntivirusClamd (protocolo INSTREAM contra um clamd de mentira)', () => {
  let servidor: Server | undefined;
  afterEach(() => {
    servidor?.close();
    servidor = undefined;
  });

  /** Um clamd falso que CONFERE o enquadramento do protocolo e responde conforme o conteúdo. */
  function clamdFalso(responder?: (conteudo: Buffer) => string): Promise<number> {
    return new Promise((resolver) => {
      servidor = createServer((socket) => {
        let buffer = Buffer.alloc(0);
        socket.on('data', (dado) => {
          buffer = Buffer.concat([buffer, dado]);
          const comando = 'zINSTREAM\0';
          if (buffer.length < comando.length) return;
          if (buffer.subarray(0, comando.length).toString() !== comando)
            return void socket.end('stream: comando inválido ERROR\0');
          let posicao = comando.length;
          const conteudo: Buffer[] = [];
          while (buffer.length - posicao >= 4) {
            const tamanho = buffer.readUInt32BE(posicao);
            if (tamanho === 0) {
              const todo = Buffer.concat(conteudo);
              return void socket.end(
                responder
                  ? responder(todo)
                  : todo.includes('EICAR')
                    ? 'stream: Eicar-Test-Signature FOUND\0'
                    : 'stream: OK\0',
              );
            }
            if (buffer.length - posicao - 4 < tamanho) return; // espera o resto do pedaço
            conteudo.push(buffer.subarray(posicao + 4, posicao + 4 + tamanho));
            posicao += 4 + tamanho;
          }
        });
      }).listen(0, '127.0.0.1', () => resolver((servidor!.address() as { port: number }).port));
    });
  }

  it('arquivo limpo, e arquivo infectado com o nome da ameaça', async () => {
    const porta = await clamdFalso();
    const av = new AntivirusClamd('127.0.0.1', porta);
    expect(await av.verificar(Buffer.from('conteúdo inofensivo'))).toEqual({ limpo: true });
    expect(await av.verificar(Buffer.from('X5O!P%@AP EICAR-STANDARD-ANTIVIRUS-TEST-FILE'))).toEqual(
      { limpo: false, ameaca: 'Eicar-Test-Signature' },
    );
  });

  it('envia o arquivo inteiro em pedaços (arquivo maior que um pedaço de 64 KB)', async () => {
    let recebido = 0;
    const porta = await clamdFalso((conteudo) => {
      recebido = conteudo.length;
      return 'stream: OK\0';
    });
    await new AntivirusClamd('127.0.0.1', porta).verificar(Buffer.alloc(200_000, 7));
    expect(recebido).toBe(200_000);
  });

  it('falha fechada: resposta estranha, erro do clamd, servidor fora do ar e tempo esgotado viram erro', async () => {
    const porta = await clamdFalso(() => 'stream: Limite excedido ERROR\0');
    await expect(
      new AntivirusClamd('127.0.0.1', porta).verificar(Buffer.from('x')),
    ).rejects.toThrow(ErroDeAntivirus);
    servidor?.close();
    await expect(
      new AntivirusClamd('127.0.0.1', porta).verificar(Buffer.from('x')),
    ).rejects.toThrow(/Falha ao falar/);

    // Servidor que aceita e nunca responde.
    const mudo = await new Promise<number>((resolver) => {
      servidor = createServer(() => undefined).listen(0, '127.0.0.1', () =>
        resolver((servidor!.address() as { port: number }).port),
      );
    });
    await expect(
      new AntivirusClamd('127.0.0.1', mudo, 300).verificar(Buffer.from('x')),
    ).rejects.toThrow(/Tempo esgotado/);
  });
});
