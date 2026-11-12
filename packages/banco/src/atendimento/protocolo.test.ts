import { describe, expect, it } from 'vitest';
import {
  alfabetoDoProtocolo,
  formatarProtocolo,
  gerarProtocolo,
  normalizarProtocolo,
} from './protocolo.js';

describe('protocolo', () => {
  it('o alfabeto tem 31 símbolos e nenhum dos confundíveis 0 O 1 I L', () => {
    expect(alfabetoDoProtocolo).toHaveLength(31);
    expect(new Set(alfabetoDoProtocolo).size).toBe(31);
    for (const proibido of '01OIL') expect(alfabetoDoProtocolo).not.toContain(proibido);
  });

  it('gera 12 caracteres do alfabeto, sem repetir em amostra grande', () => {
    const gerados = new Set<string>();
    for (let i = 0; i < 5000; i += 1) {
      const p = gerarProtocolo();
      expect(p).toMatch(/^[2-9A-HJKMNP-Z]{12}$/);
      gerados.add(p);
    }
    expect(gerados.size).toBe(5000);
  });

  it('usa todos os símbolos do alfabeto (distribuição não degenerada)', () => {
    const vistos = new Set<string>();
    for (let i = 0; i < 2000; i += 1) for (const c of gerarProtocolo()) vistos.add(c);
    expect(vistos.size).toBe(31);
  });

  it('mostra em três grupos de quatro', () => {
    expect(formatarProtocolo('K7M29PQ4XA3N')).toBe('K7M2-9PQ4-XA3N');
  });

  it('aceita com ou sem hífens, espaços e em qualquer caixa', () => {
    for (const entrada of [
      'K7M2-9PQ4-XA3N',
      'k7m29pq4xa3n',
      ' k7m2 9pq4  xa3n ',
      'K7M2-9pq4-xA3n',
    ]) {
      expect(normalizarProtocolo(entrada), entrada).toBe('K7M29PQ4XA3N');
    }
  });

  it('recusa tamanho errado e símbolos fora do alfabeto', () => {
    expect(normalizarProtocolo('K7M2-9PQ4')).toBeNull();
    expect(normalizarProtocolo('K7M2-9PQ4-XA3N-1')).toBeNull();
    expect(normalizarProtocolo('K7M2-9PQ4-XA30')).toBeNull(); // contém 0
    expect(normalizarProtocolo('K7M2-9PQ4-XA3O')).toBeNull(); // contém O
    expect(normalizarProtocolo('')).toBeNull();
  });
});
