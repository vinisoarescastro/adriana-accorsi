import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes } from 'node:crypto';

/**
 * Link de acompanhamento do cidadão: um segredo aleatório de 256 bits, NÃO derivável do protocolo.
 * - O banco guarda o HASH (SHA-256): a área pública, que não tem o segredo da aplicação, acha a
 *   demanda calculando o hash do que o cidadão trouxe.
 * - E uma cópia CIFRADA (AES-256-GCM) para a equipe obter o link de novo. A chave vem do segredo da
 *   aplicação, que o processo público nunca recebe.
 * - O segredo nunca vai para a trilha, nem para log.
 */
export function gerarSegredoDeLink(): string {
  return randomBytes(32).toString('base64url');
}

export function hashDoSegredoDeLink(segredo: string): string {
  return createHash('sha256').update(segredo).digest('hex');
}

function chaveDeCifra(segredoDaAplicacao: string): Buffer {
  return Buffer.from(hkdfSync('sha256', segredoDaAplicacao, '', 'link-de-acompanhamento', 32));
}

export function cifrarSegredoDeLink(segredo: string, segredoDaAplicacao: string): string {
  const iv = randomBytes(12);
  const cifra = createCipheriv('aes-256-gcm', chaveDeCifra(segredoDaAplicacao), iv);
  const conteudo = Buffer.concat([cifra.update(segredo, 'utf8'), cifra.final()]);
  return Buffer.concat([iv, cifra.getAuthTag(), conteudo]).toString('base64url');
}

export function decifrarSegredoDeLink(cifrado: string, segredoDaAplicacao: string): string {
  const bytes = Buffer.from(cifrado, 'base64url');
  const decifra = createDecipheriv(
    'aes-256-gcm',
    chaveDeCifra(segredoDaAplicacao),
    bytes.subarray(0, 12),
  );
  decifra.setAuthTag(bytes.subarray(12, 28));
  return Buffer.concat([decifra.update(bytes.subarray(28)), decifra.final()]).toString('utf8');
}

export function montarLinkDeAcompanhamento(hostnamePublico: string, segredo: string): string {
  return `https://${hostnamePublico}/a/${segredo}`;
}
