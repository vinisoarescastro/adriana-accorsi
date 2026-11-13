import { describe, expect, it } from 'vitest';
import { LimitadorDeConsultas } from './limitador.js';

describe('limitador de consultas', () => {
  it('5 falhas bloqueiam por 5 minutos, por origem', () => {
    let agora = 0;
    const l = new LimitadorDeConsultas({ agora: () => agora });
    for (let i = 0; i < 4; i += 1) l.registrarFalha('a');
    expect(l.bloqueadoPorMs('a')).toBe(0);
    l.registrarFalha('a');
    expect(l.bloqueadoPorMs('a')).toBe(5 * 60_000);
    expect(l.bloqueadoPorMs('b')).toBe(0);
    agora += 5 * 60_000;
    expect(l.bloqueadoPorMs('a')).toBe(0);
  });

  it('falhas antigas (mais de 15 minutos) deixam de contar', () => {
    let agora = 0;
    const l = new LimitadorDeConsultas({ agora: () => agora });
    for (let i = 0; i < 4; i += 1) l.registrarFalha('a');
    agora += 16 * 60_000;
    l.registrarFalha('a');
    expect(l.bloqueadoPorMs('a')).toBe(0);
  });

  it('o atraso cresce a cada falha, até 2 segundos', () => {
    const l = new LimitadorDeConsultas();
    const atrasos: number[] = [];
    for (let i = 0; i < 4; i += 1) {
      atrasos.push(l.atrasoEmMs('a'));
      l.registrarFalha('a');
    }
    expect(atrasos).toEqual([0, 250, 500, 750]);
  });

  it('não guarda a origem em claro e esquece quem já passou da janela', () => {
    let agora = 0;
    const l = new LimitadorDeConsultas({ agora: () => agora });
    l.registrarFalha('203.0.113.9');
    expect(
      JSON.stringify([...(l as unknown as { registros: Map<string, unknown> }).registros.keys()]),
    ).not.toContain('203.0.113.9');
    expect(l.tamanho).toBe(1);
    agora += 16 * 60_000;
    l.bloqueadoPorMs('x');
    expect(l.tamanho).toBe(0);
  });
});
