// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** Contraste medido por teste (RNF-USA-04): WCAG AA pede 4,5:1 para texto comum. Nos dois temas. */
const tokens = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');

function lerCores(bloco: string): Record<string, string> {
  return Object.fromEntries(
    [...bloco.matchAll(/--([a-z-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map((m) => [m[1], m[2] as string]),
  );
}

const inicioDoEscuro = tokens.indexOf(":root[data-theme='dark']");
const claro = lerCores(tokens.slice(0, inicioDoEscuro));
// O tema escuro herda do claro o que não redefine.
const escuro = { ...claro, ...lerCores(tokens.slice(inicioDoEscuro)) };

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
  ['text', 'bg'],
  ['text', 'surface'],
  ['text-muted', 'surface'],
  ['text-muted', 'bg'],
  ['text-muted', 'surface-muted'],
  ['text-subtle', 'surface'],
  ['primary', 'surface'],
  ['primary', 'bg'],
  ['on-primary', 'btn-primary'],
  ['on-primary', 'btn-primary-hover'],
  ['on-primary', 'btn-primary-active'],
  ['primary-soft-text', 'primary-soft'],
  ['danger-text', 'danger-soft'],
  ['danger-text', 'surface'],
  ['success', 'success-soft'],
  ['success', 'surface'],
  ['warning', 'warning-soft'],
  ['info', 'info-soft'],
];

describe.each([
  ['claro', claro],
  ['escuro', escuro],
] as const)('contraste da paleta (tema %s)', (_nome, cores) => {
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
