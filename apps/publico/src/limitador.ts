import { createHash, randomBytes } from 'node:crypto';

/**
 * Limite de tentativas da consulta por protocolo (RN-PUB-10): 5 falhas bloqueiam a origem por
 * 5 minutos, com atraso crescente antes de cada resposta de falha. Só o HASH da origem existe
 * (com um sal que nasce com o processo e nunca sai dele), por 15 minutos, e só na memória: nada
 * de endereço de visitante vai para o banco, o disco ou o log.
 */
export interface OpcoesDoLimitador {
  readonly agora?: () => number;
  readonly falhasMaximas?: number;
  readonly bloqueioEmMs?: number;
  readonly janelaEmMs?: number;
}

interface Registro {
  falhas: number[]; // instantes das falhas dentro da janela
  bloqueadoAte: number;
}

export class LimitadorDeConsultas {
  private readonly sal = randomBytes(16);
  private readonly registros = new Map<string, Registro>();
  private readonly agora: () => number;
  private readonly falhasMaximas: number;
  private readonly bloqueioEmMs: number;
  private readonly janelaEmMs: number;

  constructor(opcoes: OpcoesDoLimitador = {}) {
    this.agora = opcoes.agora ?? (() => Date.now());
    this.falhasMaximas = opcoes.falhasMaximas ?? 5;
    this.bloqueioEmMs = opcoes.bloqueioEmMs ?? 5 * 60_000;
    this.janelaEmMs = opcoes.janelaEmMs ?? 15 * 60_000;
  }

  private chave(origem: string): string {
    return createHash('sha256').update(this.sal).update(origem).digest('hex');
  }

  private limpar(): void {
    const limite = this.agora() - this.janelaEmMs;
    for (const [chave, r] of this.registros) {
      r.falhas = r.falhas.filter((t) => t > limite);
      if (r.falhas.length === 0 && r.bloqueadoAte <= this.agora()) this.registros.delete(chave);
    }
  }

  /** Quanto falta, em milissegundos, para a origem poder tentar de novo (0 se não está bloqueada). */
  bloqueadoPorMs(origem: string): number {
    this.limpar();
    const r = this.registros.get(this.chave(origem));
    return r ? Math.max(0, r.bloqueadoAte - this.agora()) : 0;
  }

  /** Atraso a aplicar antes de responder uma falha: cresce a cada falha recente, até 2 segundos. */
  atrasoEmMs(origem: string): number {
    const r = this.registros.get(this.chave(origem));
    return Math.min((r?.falhas.length ?? 0) * 250, 2000);
  }

  registrarFalha(origem: string): void {
    this.limpar();
    const chave = this.chave(origem);
    const r = this.registros.get(chave) ?? { falhas: [], bloqueadoAte: 0 };
    r.falhas.push(this.agora());
    if (r.falhas.length >= this.falhasMaximas) {
      r.bloqueadoAte = this.agora() + this.bloqueioEmMs;
      r.falhas = [];
    }
    this.registros.set(chave, r);
  }

  /** Para testes: quantas origens estão na memória. */
  get tamanho(): number {
    return this.registros.size;
  }
}
