// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** Contraste medido por teste (RNF-USA-04): WCAG AA pede 4,5:1 para texto comum. */
const tokens = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');
const cores = Object.fromEntries(
  [...tokens.matchAll(/--([a-z-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map((m) => [m[1], m[2] as string]),
);

function luminancia(hex: string): number {
  const canais = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = canais.map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  ) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contraste(a: string, b: string): number {
  const [maior, menor] = [luminancia(a), luminancia(b)].sort((x, y) => y - x) as [number, number];
  return (maior + 0.05) / (menor + 0.05);
}

const pares: ReadonlyArray<readonly [string, string]> = [
  ['cor-texto', 'cor-fundo'],
  ['cor-texto', 'cor-superficie'],
  ['cor-texto-suave', 'cor-superficie'],
  ['cor-texto-suave', 'cor-fundo'],
  ['cor-primaria', 'cor-superficie'],
  ['cor-primaria', 'cor-fundo'],
  ['cor-primaria-texto', 'cor-primaria'],
  ['cor-primaria-texto', 'cor-primaria-escura'],
  ['cor-lateral-texto', 'cor-lateral'],
  ['cor-perigo', 'cor-perigo-fundo'],
  ['cor-perigo', 'cor-superficie'],
  ['cor-sucesso', 'cor-sucesso-fundo'],
  ['cor-aviso', 'cor-aviso-fundo'],
];

describe('contraste da paleta', () => {
  it('todos os pares de cor declarados existem', () => {
    for (const [a, b] of pares) {
      expect(cores[a], a).toBeDefined();
      expect(cores[b], b).toBeDefined();
    }
  });

  it.each(pares)('%s sobre %s tem ao menos 4,5:1', (a, b) => {
    expect(contraste(cores[a] as string, cores[b] as string)).toBeGreaterThanOrEqual(4.5);
  });
});
