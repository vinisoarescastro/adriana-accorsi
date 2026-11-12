/**
 * Conta falhas de entrada por origem, em memória, para o atraso crescente (RN-ACE-04).
 * A chave é o hash da origem: o endereço nunca é guardado. A contagem se esquece após a janela.
 * Em memória por decisão: zera ao reiniciar e vale para uma só instância (como no Mandatus).
 */
export class ContadorDeFalhas {
  private readonly registros = new Map<string, { falhas: number; expiraEm: number }>();

  constructor(
    private readonly agora: () => Date,
    private readonly janelaEmMs = 15 * 60_000,
    private readonly maximoDeChaves = 10_000,
  ) {}

  /** Registra uma falha e devolve quantas a origem acumulou na janela. */
  registrarFalha(chave: string): number {
    const instante = this.agora().getTime();
    const atual = this.registros.get(chave);
    const falhas = atual && atual.expiraEm > instante ? atual.falhas + 1 : 1;
    this.registros.set(chave, { falhas, expiraEm: instante + this.janelaEmMs });
    if (this.registros.size > this.maximoDeChaves) this.podar(instante);
    return falhas;
  }

  limpar(chave: string): void {
    this.registros.delete(chave);
  }

  get tamanho(): number {
    return this.registros.size;
  }

  private podar(instante: number): void {
    for (const [chave, registro] of this.registros) {
      if (registro.expiraEm <= instante) this.registros.delete(chave);
    }
    // Ainda acima do limite: descarta as mais antigas (a ordem de inserção do Map).
    for (const chave of this.registros.keys()) {
      if (this.registros.size <= this.maximoDeChaves) break;
      this.registros.delete(chave);
    }
  }
}

/** Atraso por tentativa errada: 250 ms vezes a tentativa, saturando em 4 (RN-ACE-04). */
export function atrasoDaFalha(falhas: number): number {
  return 250 * Math.min(Math.max(falhas, 1), 4);
}
