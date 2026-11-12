import { z } from 'zod';

/**
 * Configuração por variáveis de ambiente, validada na subida (tarefa 1.3).
 * O processo deve recusar-se a subir com configuração inválida.
 *
 * Cada aplicação valida só o que precisa. Em especial, o app público nunca
 * recebe credenciais do armazenamento de arquivos (ver CLAUDE.md).
 */

const hostname = z
  .string()
  .regex(
    /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/i,
    'deve ser um nome de host válido, sem protocolo nem porta',
  );

const urlPostgres = z
  .string()
  .regex(/^postgres(ql)?:\/\//, 'deve começar com postgres:// ou postgresql://');

const armazenamento = {
  S3_ENDPOINT: z.url(),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
};

export const esquemaBase = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOSTNAME_APP: hostname,
  HOSTNAME_PUBLICO: hostname,
});

export const esquemaApi = esquemaBase.extend({
  DATABASE_URL_API: urlPostgres,
  SESSAO_SEGREDO: z.string().min(32, 'deve ter ao menos 32 caracteres'),
  HOST_API: z.string().min(1).default('127.0.0.1'),
  PORTA_API: z.coerce.number().int().min(1).max(65535).default(3000),
  /** Antivírus (ClamAV). Obrigatório em produção; opcional em desenvolvimento. */
  CLAMAV_HOST: z.string().min(1).optional(),
  CLAMAV_PORTA: z.coerce.number().int().min(1).max(65535).default(3310),
  ...armazenamento,
});

export const esquemaPublico = esquemaBase.extend({
  DATABASE_URL_PUBLICO: urlPostgres,
});

export const esquemaWorker = esquemaBase.extend({
  DATABASE_URL_WORKER: urlPostgres,
  EMAIL_PROVEDOR: z.enum(['resend', 'ses', 'brevo', 'smtp']),
  EMAIL_API_KEY: z.string().min(1),
  EMAIL_REMETENTE: z.email(),
  ...armazenamento,
});

/** Comando de migração: roda com o papel dono do esquema. */
export const esquemaMigracao = z.object({
  DATABASE_URL_MIGRACAO: urlPostgres,
});

/** Comandos que usam o papel da aplicação (criar administrador, semear, verificar). */
export const esquemaComandoApi = z.object({
  DATABASE_URL_API: urlPostgres,
});

/**
 * Provisionamento dos papéis de banco. A conexão administrativa só existe para
 * este comando e nunca deve estar definida nos processos da aplicação.
 */
export const esquemaProvisionamento = z.object({
  DATABASE_URL_ADMIN: urlPostgres,
  DATABASE_URL_MIGRACAO: urlPostgres,
  DATABASE_URL_API: urlPostgres,
  DATABASE_URL_WORKER: urlPostgres,
  DATABASE_URL_PUBLICO: urlPostgres,
});

/** Variáveis que o processo público nunca deve receber. */
export const variaveisProibidasNoPublico = [
  'S3_ENDPOINT',
  'S3_BUCKET',
  'S3_ACCESS_KEY',
  'S3_SECRET_KEY',
  'DATABASE_URL_API',
  'DATABASE_URL_MIGRACAO',
  'DATABASE_URL_WORKER',
  'SESSAO_SEGREDO',
] as const;

export class ErroDeAmbiente extends Error {
  constructor(readonly problemas: readonly string[]) {
    super(`Configuração inválida:\n${problemas.map((p) => `- ${p}`).join('\n')}`);
    this.name = 'ErroDeAmbiente';
  }
}

type Origem = Readonly<Record<string, string | undefined>>;

interface Opcoes {
  /** Variáveis que não devem estar definidas neste processo. */
  readonly proibidas?: readonly string[];
}

/**
 * Valida a configuração e devolve o resultado tipado. Variáveis vazias contam
 * como não definidas. As mensagens de erro nunca incluem os valores recebidos,
 * para não vazar segredos em log.
 */
export function validarAmbiente<T extends z.ZodType>(
  esquema: T,
  origem: Origem = process.env,
  opcoes: Opcoes = {},
): z.output<T> {
  const definidas = Object.fromEntries(
    Object.entries(origem).filter(([, valor]) => valor !== undefined && valor !== ''),
  );

  const problemas: string[] = [];

  for (const nome of opcoes.proibidas ?? []) {
    if (nome in definidas) {
      problemas.push(`${nome}: não deve estar definida neste processo`);
    }
  }

  const resultado = esquema.safeParse(definidas);
  if (!resultado.success) {
    for (const problema of resultado.error.issues) {
      const nome = problema.path.map(String).join('.') || '(raiz)';
      problemas.push(`${nome}: ${problema.message}`);
    }
  }

  if (problemas.length > 0 || !resultado.success) {
    throw new ErroDeAmbiente(problemas);
  }

  return resultado.data;
}
