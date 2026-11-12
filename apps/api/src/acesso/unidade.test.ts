import { describe, expect, it } from 'vitest';
import { atrasoDaFalha, ContadorDeFalhas } from './limitador.js';
import { problemasDaSenha } from './politica-de-senha.js';
import { gerarTicket, hashDaOrigem, hashDoTicket } from './tickets.js';

describe('política de senha', () => {
  const contexto = { email: 'fulano@exemplo.test' };

  it('aceita senha longa, sem exigir composição', () => {
    expect(problemasDaSenha('uma frase bem longa', contexto)).toEqual([]);
    expect(problemasDaSenha('abcdefghijkl', contexto)).toEqual([]);
  });

  it('recusa senha com menos de 10 caracteres', () => {
    expect(problemasDaSenha('curta123', contexto)[0]).toMatch(/ao menos 10/);
  });

  it('recusa senhas óbvias em qualquer caixa e repetições', () => {
    expect(problemasDaSenha('SENHA12345', contexto)).toHaveLength(1);
    expect(problemasDaSenha('aaaaaaaaaaaa', contexto)).toHaveLength(1);
    expect(problemasDaSenha('1234567890', contexto)).toHaveLength(1);
  });

  it('recusa senha igual ao e-mail ou à parte local, e igual à atual', () => {
    expect(problemasDaSenha('fulano@exemplo.test', contexto).join()).toMatch(/igual ao e-mail/);
    expect(problemasDaSenha('FULANO@exemplo.test', contexto).join()).toMatch(/igual ao e-mail/);
    expect(
      problemasDaSenha('uma-senha-boa-123', { ...contexto, senhaAtual: 'uma-senha-boa-123' }),
    ).toEqual(['A nova senha deve ser diferente da atual.']);
  });

  it('limita o tamanho máximo', () => {
    expect(problemasDaSenha('a1'.repeat(70), contexto).join()).toMatch(/no máximo 128/);
  });
});

describe('tickets', () => {
  it('são aleatórios, longos e o hash depende do segredo', () => {
    const a = gerarTicket();
    expect(a.length).toBeGreaterThanOrEqual(43);
    expect(a).not.toBe(gerarTicket());
    expect(hashDoTicket(a, 'segredo-1')).toMatch(/^[0-9a-f]{64}$/);
    expect(hashDoTicket(a, 'segredo-1')).toBe(hashDoTicket(a, 'segredo-1'));
    expect(hashDoTicket(a, 'segredo-1')).not.toBe(hashDoTicket(a, 'segredo-2'));
    expect(hashDoTicket(a, 'segredo-1')).not.toBe(a);
  });

  it('o hash da origem não contém o endereço', () => {
    expect(hashDaOrigem('203.0.113.9', 's')).not.toContain('203');
  });
});

describe('atraso e contador de falhas', () => {
  it('250 ms vezes a tentativa, saturando em 4', () => {
    expect([1, 2, 3, 4, 5, 9].map(atrasoDaFalha)).toEqual([250, 500, 750, 1000, 1000, 1000]);
  });

  it('conta por origem, esquece após a janela e limpa no sucesso', () => {
    let agora = 0;
    const contador = new ContadorDeFalhas(() => new Date(agora), 1000);
    expect(contador.registrarFalha('a')).toBe(1);
    expect(contador.registrarFalha('a')).toBe(2);
    expect(contador.registrarFalha('b')).toBe(1);
    agora = 1001;
    expect(contador.registrarFalha('a')).toBe(1);
    contador.limpar('a');
    expect(contador.registrarFalha('a')).toBe(1);
  });

  it('não cresce sem limite', () => {
    const contador = new ContadorDeFalhas(() => new Date(0), 60_000, 100);
    for (let i = 0; i < 500; i += 1) contador.registrarFalha(`origem-${i}`);
    expect(contador.tamanho).toBeLessThanOrEqual(100);
  });
});
