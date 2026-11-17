import { z } from 'zod';

/**
 * Dinheiro: `numeric` no banco e TEXTO na API (nunca ponto flutuante). Aqui ficam as contas em
 * centavos inteiros (seguros até 9 quatrilhões de centavos) e a formatação em reais.
 */

/** "1234.5" vira 123450; "0.07", 7. Valor fora do padrão dá `null`. */
export function paraCentavos(valor: string): number | null {
  const m = /^(\d{1,12})(?:\.(\d{1,2}))?$/.exec(valor.trim());
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0') || '0');
}

/** 123450 vira "1234.50". */
export function deCentavos(centavos: number): string {
  const sinal = centavos < 0 ? '-' : '';
  const abs = Math.abs(Math.round(centavos));
  return `${sinal}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

/** Soma valores em texto, em centavos. */
export const somarDinheiro = (valores: readonly string[]): string =>
  deCentavos(valores.reduce((s, v) => s + (paraCentavos(v) ?? 0), 0));

const formatadorDeReais = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** "1234.5" vira "R$ 1.234,50". */
export function formatarReais(valor: string): string {
  const centavos = paraCentavos(valor.replace(/^-/, ''));
  if (centavos === null) return valor;
  return formatadorDeReais.format((valor.startsWith('-') ? -centavos : centavos) / 100);
}

/**
 * Valor monetário recebido pela API: texto com até 2 casas, maior que zero, sem negativo. Aceita vírgula
 * como separador decimal, e devolve no formato canônico ("1234.50").
 */
export const dinheiroPositivo = z
  .string()
  .trim()
  .transform((v) => v.replace(',', '.'))
  .refine((v) => {
    const c = paraCentavos(v);
    return c !== null && c > 0;
  }, 'Informe um valor maior que zero, com até duas casas decimais.')
  .transform((v) => deCentavos(paraCentavos(v) ?? 0));
