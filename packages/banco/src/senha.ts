import { randomInt } from 'node:crypto';
import { hash, verify } from '@node-rs/argon2';

/**
 * Parâmetros do Argon2 (mínimo recomendado pela OWASP: 19 MiB, 2 passes, 1 thread).
 * O algoritmo padrão da biblioteca é o Argon2id; o teste confere o prefixo `$argon2id$`.
 */
const parametros = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

export function gerarVerificador(senha: string): Promise<string> {
  return hash(senha, parametros);
}

export async function conferirSenha(verificador: string, senha: string): Promise<boolean> {
  try {
    return await verify(verificador, senha);
  } catch {
    return false;
  }
}

// Sem caracteres ambíguos (0 O 1 I l), para a senha inicial ser fácil de ler e digitar.
const alfabeto = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

/** Senha inicial aleatória. Mostrada uma única vez e de uso único (RN-ACE-09). */
export function gerarSenhaInicial(tamanho = 20): string {
  let senha = '';
  for (let i = 0; i < tamanho; i += 1) {
    senha += alfabeto[randomInt(alfabeto.length)];
  }
  return senha;
}
