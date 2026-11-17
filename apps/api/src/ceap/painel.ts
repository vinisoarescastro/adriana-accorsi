import { emenda, type BancoDeDados } from '@gabinete/banco';
import type { PainelFinanceiro, SaldoDaCeap } from '@gabinete/compartilhado';
import { isNull } from 'drizzle-orm';
import { hojeNoGabinete } from '../atendimento/comum.js';
import { somarValores, valoresDasEmendas } from '../emendas/valores.js';
import { calcularSaldo } from './saldo.js';

/** Saldo da CEAP, hoje ou numa data passada (reconstituição). */
export class ServicoDoSaldoDaCeap {
  constructor(
    private readonly bd: BancoDeDados,
    private readonly agora: () => Date,
  ) {}

  /** O exercício pedido (ou o de hoje), como está agora. */
  async saldo(ano?: number): Promise<SaldoDaCeap> {
    const hoje = hojeNoGabinete(this.agora());
    return calcularSaldo(this.bd, ano ?? Number(hoje.slice(0, 4)), this.agora());
  }

  /** O saldo como era no fim do dia `dia` (fuso do gabinete): a mesma conta, com a data de então. */
  async reconstituir(dia: string): Promise<SaldoDaCeap> {
    const em = new Date(`${dia}T23:59:59.999-03:00`);
    return calcularSaldo(this.bd, Number(dia.slice(0, 4)), em);
  }

  /** O bloco financeiro do painel: o saldo e o resumo das emendas. */
  async painel(): Promise<PainelFinanceiro> {
    const saldo = await this.saldo();
    const ativas = await this.bd
      .select({ id: emenda.id })
      .from(emenda)
      .where(isNull(emenda.canceladaEm));
    const valores = somarValores([
      ...(
        await valoresDasEmendas(
          this.bd,
          ativas.map((e) => e.id),
          this.agora(),
        )
      ).values(),
    ]);
    return {
      saldo,
      emendas: {
        disponibilizado: valores.disponibilizado,
        comprometido: valores.comprometido,
        disponivel: valores.disponivel,
        utilizado: valores.utilizado,
        aExecutar: valores.aExecutar,
      },
    };
  }
}
