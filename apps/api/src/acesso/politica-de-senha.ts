/** Regras da senha (RN-ACE-05): tamanho mínimo, sem exigência de composição. */

export const tamanhoMinimoDaSenha = 10;
export const tamanhoMaximoDaSenha = 128;

/** Lista curta de senhas óbvias, em minúsculas. */
const senhasObvias = new Set([
  '1234567890',
  '12345678910',
  '0123456789',
  '1234512345',
  '1q2w3e4r5t',
  'qwertyuiop',
  'asdfghjkl',
  'abcdefghij',
  'senha12345',
  'senha123456',
  'minhasenha',
  'minhasenha1',
  'password12',
  'password123',
  'admin12345',
  'administrador',
  'trocar123',
  'mudar12345',
  'gabinete123',
  'deputada12',
  'brasil1234',
  'brasil2026',
]);

function todosIguais(texto: string): boolean {
  return texto.length > 0 && [...texto].every((c) => c === texto[0]);
}

export interface ContextoDaSenha {
  readonly email: string;
  readonly senhaAtual?: string;
}

/** Devolve os problemas encontrados. Lista vazia significa que a senha serve. */
export function problemasDaSenha(nova: string, contexto: ContextoDaSenha): string[] {
  const problemas: string[] = [];
  const minuscula = nova.toLowerCase();
  const email = contexto.email.toLowerCase();
  const parteLocal = email.split('@')[0] ?? email;

  if (nova.length < tamanhoMinimoDaSenha) {
    problemas.push(`A senha deve ter ao menos ${tamanhoMinimoDaSenha} caracteres.`);
  }
  if (nova.length > tamanhoMaximoDaSenha) {
    problemas.push(`A senha deve ter no máximo ${tamanhoMaximoDaSenha} caracteres.`);
  }
  if (senhasObvias.has(minuscula) || todosIguais(nova)) {
    problemas.push('Essa senha é muito comum. Escolha outra.');
  }
  if (minuscula === email || minuscula === parteLocal) {
    problemas.push('A senha não pode ser igual ao e-mail.');
  }
  if (contexto.senhaAtual !== undefined && nova === contexto.senhaAtual) {
    problemas.push('A nova senha deve ser diferente da atual.');
  }
  return problemas;
}
