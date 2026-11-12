import { describe, expect, it } from 'vitest';
import { ErroDePapeis, senhaDaUrl } from './papeis.js';

describe('senhaDaUrl', () => {
  it('extrai a senha quando o usuário é o papel esperado', () => {
    expect(
      senhaDaUrl('postgresql://app_api:senha-boa-123@127.0.0.1:5432/gabinete', 'app_api'),
    ).toBe('senha-boa-123');
  });

  it('decodifica caracteres especiais da senha', () => {
    expect(
      senhaDaUrl('postgresql://app_api:s%40nha%2Fboa%23123@127.0.0.1/gabinete', 'app_api'),
    ).toBe('s@nha/boa#123');
  });

  it('recusa usuário diferente do papel esperado', () => {
    expect(() =>
      senhaDaUrl('postgresql://postgres:senha-boa-123@127.0.0.1/gabinete', 'app_api'),
    ).toThrow(ErroDePapeis);
  });

  it('recusa senha curta', () => {
    expect(() => senhaDaUrl('postgresql://app_api:curta@127.0.0.1/gabinete', 'app_api')).toThrow(
      /ao menos 8 caracteres/,
    );
  });
});
