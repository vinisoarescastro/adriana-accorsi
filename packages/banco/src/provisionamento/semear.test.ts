import { describe, expect, it } from 'vitest';
import { ErroDeSemeadura, exigirBancoLocal } from './semear.js';

describe('exigirBancoLocal', () => {
  it.each([
    'postgresql://u:p@localhost:5432/gabinete',
    'postgresql://u:p@127.0.0.1:5432/gabinete',
    'postgresql://u:p@[::1]:5432/gabinete',
  ])('aceita %s', (url) => {
    expect(() => exigirBancoLocal(url)).not.toThrow();
  });

  it.each([
    'postgresql://u:p@db.exemplo.com:5432/gabinete',
    'postgresql://u:p@10.0.0.5:5432/gabinete',
    'postgresql://u:p@dominio.nucleodedados.com/gabinete',
  ])('recusa %s', (url) => {
    expect(() => exigirBancoLocal(url)).toThrow(ErroDeSemeadura);
  });
});
