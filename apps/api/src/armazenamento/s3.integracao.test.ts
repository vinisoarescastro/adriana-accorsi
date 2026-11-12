import { GenericContainer, Wait, type StartedTestContainer } from 'testcontainers';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ArmazenamentoEmDisco, ArmazenamentoS3 } from './armazenamento.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('ArmazenamentoS3 contra um servidor S3 real (S3Mock)', () => {
  let minio: StartedTestContainer;
  let armazenamento: ArmazenamentoS3;

  beforeAll(async () => {
    minio = await new GenericContainer('adobe/s3mock:latest')
      .withExposedPorts(9090)
      .withWaitStrategy(Wait.forListeningPorts())
      .start();

    armazenamento = new ArmazenamentoS3({
      endpoint: `http://${minio.getHost()}:${minio.getMappedPort(9090)}`,
      bucket: 'gabinete-teste',
      chaveDeAcesso: 'teste',
      chaveSecreta: 'teste-segredo',
    });
    // A porta abre antes de o servidor aceitar requisições: tenta por até 30 s.
    for (let tentativa = 0; ; tentativa += 1) {
      try {
        await armazenamento.garantirBucket();
        break;
      } catch (erro) {
        if (tentativa >= 30) throw erro;
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  });

  afterAll(async () => {
    await minio?.stop();
  });

  it('guarda, lê com o tipo, e remove', async () => {
    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]);
    await armazenamento.guardar('fotos/teste/a.png', bytes, 'image/png');

    const lido = await armazenamento.ler('fotos/teste/a.png');
    expect(lido?.tipo).toBe('image/png');
    expect(lido?.bytes.equals(bytes)).toBe(true);

    await armazenamento.remover('fotos/teste/a.png');
    expect(await armazenamento.ler('fotos/teste/a.png')).toBeNull();
  });

  it('objeto inexistente devolve null', async () => {
    expect(await armazenamento.ler('nao/existe.png')).toBeNull();
  });

  it('garantirBucket é idempotente', async () => {
    await expect(armazenamento.garantirBucket()).resolves.toBeUndefined();
  });
});

describe('ArmazenamentoEmDisco', () => {
  it('não deixa uma chave sair da pasta raiz', async () => {
    const raiz = await mkdtemp(join(tmpdir(), 'armazenamento-'));
    try {
      const disco = new ArmazenamentoEmDisco(raiz);
      await disco.guardar('fotos/a.png', Buffer.from('x'), 'image/png');
      expect((await disco.ler('fotos/a.png'))?.bytes.toString()).toBe('x');
      await expect(disco.guardar('../fora.png', Buffer.from('x'), 'image/png')).rejects.toThrow(
        /inválida/,
      );
      await expect(disco.ler('../../etc/passwd')).rejects.toThrow(/inválida/);
    } finally {
      await rm(raiz, { recursive: true, force: true });
    }
  });
});
