import { createHmac, randomBytes } from 'node:crypto';

/** Ticket de sessão: 256 bits aleatórios, em base64url. Só o cookie o carrega. */
export function gerarTicket(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * O banco guarda apenas o HMAC-SHA256 do ticket, com o segredo da aplicação como chave.
 * Quem lê o banco não consegue usar nem forjar tickets.
 */
export function hashDoTicket(ticket: string, segredo: string): string {
  return createHmac('sha256', segredo).update(ticket).digest('hex');
}

/** Chave anônima de uma origem (IP), para contar falhas sem guardar o endereço. */
export function hashDaOrigem(origem: string, segredo: string): string {
  return createHmac('sha256', segredo).update(`origem:${origem}`).digest('hex');
}
