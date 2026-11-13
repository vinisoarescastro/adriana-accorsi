import { randomInt } from 'node:crypto';
import { protocoloEmitido } from '../esquema/index.js';
import type { Transacao } from '../conexao.js';

// As funções puras (alfabeto, formato, normalização) são do pacote compartilhado: o app público
// também as usa. Aqui ficam a geração e a emissão, que dependem do banco.
import { alfabetoDoProtocolo, tamanhoDoProtocolo } from '@gabinete/compartilhado';
export {
  alfabetoDoProtocolo,
  formatarProtocolo,
  normalizarProtocolo,
  tamanhoDoProtocolo,
} from '@gabinete/compartilhado';

export function gerarProtocolo(): string {
  let protocolo = '';
  for (let i = 0; i < tamanhoDoProtocolo; i += 1) {
    protocolo += alfabetoDoProtocolo[randomInt(alfabetoDoProtocolo.length)];
  }
  return protocolo;
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
