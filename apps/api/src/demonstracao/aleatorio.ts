/** Gerador pseudoaleatório com semente fixa: a demonstração sai igual toda vez. */
export class Aleatorio {
  private estado: number;

  constructor(semente = 20261116) {
    this.estado = semente >>> 0;
  }

  /** Número em [0, 1). */
  proximo(): number {
    this.estado = (this.estado + 0x6d2b79f5) >>> 0;
    let t = this.estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Inteiro em [minimo, maximo], inclusive. */
  inteiro(minimo: number, maximo: number): number {
    return minimo + Math.floor(this.proximo() * (maximo - minimo + 1));
  }

  chance(probabilidade: number): boolean {
    return this.proximo() < probabilidade;
  }

  escolher<T>(itens: readonly T[]): T {
    return itens[Math.floor(this.proximo() * itens.length)] as T;
  }

  /** Escolhe segundo pesos: `[[valor, peso], ...]`. */
  ponderado<T>(opcoes: ReadonlyArray<readonly [T, number]>): T {
    const total = opcoes.reduce((s, [, p]) => s + p, 0);
    let sorteio = this.proximo() * total;
    for (const [valor, peso] of opcoes) {
      sorteio -= peso;
      if (sorteio < 0) return valor;
    }
    return opcoes[opcoes.length - 1]![0];
  }

  embaralhar<T>(itens: readonly T[]): T[] {
    const copia = [...itens];
    for (let i = copia.length - 1; i > 0; i -= 1) {
      const j = Math.floor(this.proximo() * (i + 1));
      [copia[i], copia[j]] = [copia[j] as T, copia[i] as T];
    }
    return copia;
  }

  amostra<T>(itens: readonly T[], quantidade: number): T[] {
    return this.embaralhar(itens).slice(0, quantidade);
  }
}

const UM_DIA = 24 * 60 * 60 * 1000;

/** Datas relativas ao "agora" da execução. */
export class Relogio {
  constructor(
    readonly agora: Date,
    private readonly sorteio: Aleatorio,
  ) {}

  /** `dias` atrás, em horário comercial (8h às 18h de Brasília, UTC-3). */
  diasAtras(dias: number): Date {
    const base = new Date(this.agora.getTime() - dias * UM_DIA);
    base.setUTCHours(11 + this.sorteio.inteiro(0, 9), this.sorteio.inteiro(0, 59), 0, 0);
    return base;
  }

  /** Soma dias e algumas horas a uma data (pode passar de `agora`: quem grava confere com `limitar`). */
  depois(data: Date, dias: number): Date {
    return new Date(data.getTime() + dias * UM_DIA + this.sorteio.inteiro(1, 6) * 3_600_000);
  }

  /** Não deixa uma data cair no futuro: no máximo um minuto antes de `agora`. */
  limitar(data: Date): Date {
    return data > this.agora ? new Date(this.agora.getTime() - 60_000) : data;
  }

  /** AAAA-MM-DD no fuso de Brasília. */
  dia(data: Date): string {
    return new Date(data.getTime() - 3 * 3_600_000).toISOString().slice(0, 10);
  }

  /** Soma dias e 1 a 5 horas: duas etapas no "mesmo dia" nunca ficam no mesmo instante. */
  somarDias(data: Date, dias: number): Date {
    return new Date(data.getTime() + dias * UM_DIA + this.sorteio.inteiro(1, 5) * 3_600_000);
  }
}
