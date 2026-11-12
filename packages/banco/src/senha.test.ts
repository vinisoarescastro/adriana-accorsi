import { describe, expect, it } from 'vitest';
import { conferirSenha, gerarSenhaInicial, gerarVerificador } from './senha.js';

describe('senha', () => {
  it('gera verificador Argon2id e confere a senha certa e a errada', async () => {
    const verificador = await gerarVerificador('uma-senha-bem-longa');
    expect(verificador.startsWith('$argon2id$')).toBe(true);
    expect(await conferirSenha(verificador, 'uma-senha-bem-longa')).toBe(true);
    expect(await conferirSenha(verificador, 'outra-senha-qualquer')).toBe(false);
  });

  it('o mesmo texto gera verificadores diferentes (sal aleatório)', async () => {
    const [a, b] = await Promise.all([gerarVerificador('igual'), gerarVerificador('igual')]);
    expect(a).not.toBe(b);
  });

  it('verificador malformado não confere e não lança', async () => {
    expect(await conferirSenha('isto-nao-e-um-hash', 'qualquer')).toBe(false);
  });

  it('a senha inicial tem 20 caracteres sem ambíguos e não se repete', () => {
    const a = gerarSenhaInicial();
    const b = gerarSenhaInicial();
    expect(a).toHaveLength(20);
    expect(a).toMatch(/^[A-HJKMNP-Za-km-z2-9]+$/);
    expect(a).not.toBe(b);
  });
});
