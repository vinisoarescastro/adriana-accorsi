import { describe, expect, it } from 'vitest';
import {
  deCentavos,
  dinheiroPositivo,
  formatarReais,
  paraCentavos,
  somarDinheiro,
} from './dinheiro.js';

describe('dinheiro', () => {
  it('converte para centavos e de volta, sem ponto flutuante', () => {
    expect(paraCentavos('1234.5')).toBe(123450);
    expect(paraCentavos('0.07')).toBe(7);
    expect(paraCentavos('10')).toBe(1000);
    expect(paraCentavos('10.123')).toBeNull();
    expect(paraCentavos('-1')).toBeNull();
    expect(paraCentavos('abc')).toBeNull();
    expect(deCentavos(123450)).toBe('1234.50');
    expect(deCentavos(5)).toBe('0.05');
    expect(somarDinheiro(['0.10', '0.20'])).toBe('0.30'); // o clássico 0.1 + 0.2
  });

  it('formata em reais', () => {
    expect(formatarReais('1234.5').replace(/\s/g, ' ')).toBe('R$ 1.234,50');
    expect(formatarReais('-10.00').replace(/\s/g, ' ')).toContain('10,00');
  });

  it('o valor recebido é positivo, com até duas casas; aceita vírgula e normaliza', () => {
    expect(dinheiroPositivo.parse('75000,5')).toBe('75000.50');
    expect(dinheiroPositivo.parse(' 12 ')).toBe('12.00');
    for (const ruim of ['0', '0.00', '-5', '1.234', 'R$ 10', '', '1e3']) {
      expect(dinheiroPositivo.safeParse(ruim).success, ruim).toBe(false);
    }
  });
});
