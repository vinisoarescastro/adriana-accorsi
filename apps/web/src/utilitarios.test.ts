import { describe, expect, it } from 'vitest';
import { validarFoto } from './componentes/EnvioDeFoto';
import { formatarDataHora, iniciais } from './formatos';

describe('formatos', () => {
  it('mostra as datas no fuso do gabinete, não no do navegador', () => {
    // 2026-11-12 15:00 UTC é 12:00 em São Paulo (UTC-3, sem horário de verão).
    expect(formatarDataHora('2026-11-12T15:00:00.000Z')).toBe('12/11/2026, 12:00');
  });

  it('tira as iniciais do primeiro e do último nome', () => {
    expect(iniciais('Maria da Silva Santos')).toBe('MS');
    expect(iniciais('Maria')).toBe('M');
    expect(iniciais('   ')).toBe('?');
  });
});

describe('validarFoto (aviso cedo; a API decide pelo conteúdo)', () => {
  it('aceita PNG e JPEG de até 2 MB', () => {
    expect(validarFoto({ type: 'image/png', size: 1024 })).toBeNull();
    expect(validarFoto({ type: 'image/jpeg', size: 2 * 1024 * 1024 })).toBeNull();
  });

  it('recusa outros tipos e arquivos grandes', () => {
    expect(validarFoto({ type: 'image/gif', size: 100 })).toMatch(/PNG ou JPEG/);
    expect(validarFoto({ type: 'application/pdf', size: 100 })).toMatch(/PNG ou JPEG/);
    expect(validarFoto({ type: 'image/png', size: 2 * 1024 * 1024 + 1 })).toMatch(/2 MB/);
  });
});

describe('nomeCurto', () => {
  it('fica só com o primeiro e o segundo nome, sem contar as partículas', async () => {
    const { nomeCurto } = await import('./formatos');
    expect(nomeCurto('Fulano de Tal')).toBe('Fulano Tal');
    expect(nomeCurto('Maria da Silva Santos')).toBe('Maria Silva');
    expect(nomeCurto('Ana Beatriz Souza Lima')).toBe('Ana Beatriz');
    expect(nomeCurto('Beltrana')).toBe('Beltrana');
    expect(nomeCurto('  João   dos Santos ')).toBe('João Santos');
  });
});
