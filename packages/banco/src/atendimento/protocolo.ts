import { randomInt } from 'node:crypto';
import { protocoloEmitido } from '../esquema/index.js';
import type { Transacao } from '../conexao.js';

/**
 * Protocolo: 12 caracteres aleatórios de um alfabeto de 31 símbolos, sem `0 O 1 I L` (confundíveis).
 * Mostrado em três grupos de quatro (`K7M2-9PQ4-XA3N`); guardado sem hífens e em maiúsculas.
 * Não é sequencial: não dá para adivinhar o seguinte nem contar quantos existem.
 */
export const alfabetoDoProtocolo = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export const tamanhoDoProtocolo = 12;

export function gerarProtocolo(): string {
  let protocolo = '';
  for (let i = 0; i < tamanhoDoProtocolo; i += 1) {
    protocolo += alfabetoDoProtocolo[randomInt(alfabetoDoProtocolo.length)];
  }
  return protocolo;
}

export function formatarProtocolo(protocolo: string): string {
  return `${protocolo.slice(0, 4)}-${protocolo.slice(4, 8)}-${protocolo.slice(8, 12)}`;
}

/**
 * Aceita com ou sem hífens, com espaços e em qualquer caixa. Devolve o protocolo canônico
 * (12 caracteres) ou `null` se não tiver o formato.
 */
export function normalizarProtocolo(entrada: string): string | null {
  const limpo = entrada.replace(/[\s-]/g, '').toUpperCase();
  if (limpo.length !== tamanhoDoProtocolo) return null;
  return [...limpo].every((c) => alfabetoDoProtocolo.includes(c)) ? limpo : null;
}

export class ErroDeProtocolo extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'ErroDeProtocolo';
  }
}

/**
 * Emite um protocolo novo DENTRO da transação da demanda. A tabela de emitidos garante que nenhum
 * protocolo se repete nem é reutilizado; em colisão (raríssima) tenta outro.
 */
export async function emitirProtocolo(
  tx: Pick<Transacao, 'insert'>,
  gerar: () => string = gerarProtocolo,
  tentativas = 5,
): Promise<string> {
  for (let i = 0; i < tentativas; i += 1) {
    const candidato = gerar();
    const inserido = await tx
      .insert(protocoloEmitido)
      .values({ protocolo: candidato })
      .onConflictDoNothing()
      .returning({ protocolo: protocoloEmitido.protocolo });
    if (inserido.length > 0) return candidato;
  }
  throw new ErroDeProtocolo('Não foi possível emitir um protocolo único.');
}
