import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
  NoSuchKey,
} from '@aws-sdk/client-s3';

/**
 * Armazenamento de arquivos (fotos agora; documentos e comprovantes nas próximas fases).
 * Os bytes ficam fora do banco, em armazenamento PRIVADO: nunca há URL direta, e toda
 * leitura passa pela API, que confere a permissão.
 */
export interface Armazenamento {
  guardar(chave: string, bytes: Buffer, tipo: string): Promise<void>;
  /** Devolve `null` se o objeto não existe. */
  ler(chave: string): Promise<{ bytes: Buffer; tipo: string } | null>;
  remover(chave: string): Promise<void>;
}

export function novaChave(prefixo: string, extensao: string): string {
  return `${prefixo}/${randomUUID()}.${extensao}`;
}

const tiposPorExtensao: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg' };

/** Só para desenvolvimento e testes. Fora de development o processo usa o S3 (ver principal.ts). */
export class ArmazenamentoEmDisco implements Armazenamento {
  private readonly raiz: string;

  constructor(raiz: string) {
    this.raiz = resolve(raiz);
  }

  private caminho(chave: string): string {
    const alvo = resolve(join(this.raiz, chave));
    if (!alvo.startsWith(this.raiz + sep)) throw new Error('Chave de armazenamento inválida.');
    return alvo;
  }

  async guardar(chave: string, bytes: Buffer, _tipo?: string): Promise<void> {
    const alvo = this.caminho(chave);
    await mkdir(dirname(alvo), { recursive: true });
    await writeFile(alvo, bytes);
  }

  async ler(chave: string) {
    try {
      const bytes = await readFile(this.caminho(chave));
      return {
        bytes,
        tipo: tiposPorExtensao[chave.split('.').pop() ?? ''] ?? 'application/octet-stream',
      };
    } catch (erro) {
      if ((erro as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw erro;
    }
  }

  async remover(chave: string): Promise<void> {
    await rm(this.caminho(chave), { force: true });
  }
}

export interface ConfiguracaoS3 {
  readonly endpoint: string;
  readonly bucket: string;
  readonly chaveDeAcesso: string;
  readonly chaveSecreta: string;
}

/** S3 compatível: Cloudflare R2 em produção, MinIO no desenvolvimento. */
export class ArmazenamentoS3 implements Armazenamento {
  private readonly cliente: S3Client;

  constructor(private readonly configuracao: ConfiguracaoS3) {
    this.cliente = new S3Client({
      endpoint: configuracao.endpoint,
      region: 'auto',
      forcePathStyle: true,
      credentials: {
        accessKeyId: configuracao.chaveDeAcesso,
        secretAccessKey: configuracao.chaveSecreta,
      },
    });
  }

  /** Cria o bucket se ainda não existir (desenvolvimento). Em produção o bucket já existe. */
  async garantirBucket(): Promise<void> {
    try {
      await this.cliente.send(new HeadBucketCommand({ Bucket: this.configuracao.bucket }));
    } catch {
      await this.cliente.send(new CreateBucketCommand({ Bucket: this.configuracao.bucket }));
    }
  }

  async guardar(chave: string, bytes: Buffer, tipo: string): Promise<void> {
    await this.cliente.send(
      new PutObjectCommand({
        Bucket: this.configuracao.bucket,
        Key: chave,
        Body: bytes,
        ContentType: tipo,
      }),
    );
  }

  async ler(chave: string) {
    try {
      const resposta = await this.cliente.send(
        new GetObjectCommand({ Bucket: this.configuracao.bucket, Key: chave }),
      );
      const bytes = Buffer.from((await resposta.Body?.transformToByteArray()) ?? []);
      return { bytes, tipo: resposta.ContentType ?? 'application/octet-stream' };
    } catch (erro) {
      if (erro instanceof NoSuchKey) return null;
      throw erro;
    }
  }

  async remover(chave: string): Promise<void> {
    await this.cliente.send(
      new DeleteObjectCommand({ Bucket: this.configuracao.bucket, Key: chave }),
    );
  }
}
