import { describe, expect, it } from 'vitest';
import {
  esquemaCancelarDemanda,
  esquemaNovaDemanda,
  esquemaNovaPessoa,
  formatarTelefone,
  normalizarTelefone,
} from './atendimento.js';

describe('normalizarTelefone', () => {
  it.each([
    ['(67) 99999-0000', '67999990000'],
    ['67 99999 0000', '67999990000'],
    ['+55 67 99999-0000', '67999990000'],
    ['0055 67 99999-0000', '67999990000'],
    ['067 99999-0000', '67999990000'],
    ['(67) 3321-1234', '6733211234'],
    ['5567999990000', '67999990000'],
  ])('"%s" vira %s (a mesma pessoa, de qualquer forma de escrever)', (entrada, esperado) => {
    expect(normalizarTelefone(entrada)).toBe(esperado);
  });

  it.each([
    '',
    'abc',
    '12345',
    '99999-0000',
    '(67) 8999-00000',
    '(07) 99999-0000',
    '(67) 29999-0000',
  ])('"%s" não é um telefone possível', (entrada) => {
    expect(normalizarTelefone(entrada)).toBeNull();
  });

  it('formata para exibir', () => {
    expect(formatarTelefone('67999990000')).toBe('(67) 99999-0000');
    expect(formatarTelefone('6733211234')).toBe('(67) 3321-1234');
  });
});

describe('esquemas', () => {
  it('a pessoa nova guarda o telefone já normalizado e recusa o inválido', () => {
    const ok = esquemaNovaPessoa.safeParse({ nome: ' Maria ', telefone: '(67) 99999-0000' });
    expect(ok.success && ok.data).toMatchObject({ nome: 'Maria', telefone: '67999990000' });
    expect(esquemaNovaPessoa.safeParse({ nome: 'Maria', telefone: '123' }).success).toBe(false);
    expect(esquemaNovaPessoa.safeParse({ nome: '', telefone: '67999990000' }).success).toBe(false);
  });

  it('a demanda aceita pessoa existente ou nova, e a prioridade padrão é Média', () => {
    const existente = esquemaNovaDemanda.safeParse({
      solicitante: { pessoaId: 3 },
      titulo: 'Poda',
    });
    expect(existente.success && existente.data.prioridade).toBe('media');

    const nova = esquemaNovaDemanda.safeParse({
      solicitante: { nome: 'Maria', telefone: '67999990000' },
      titulo: 'Poda de árvore',
      prazo: '2026-12-01',
    });
    expect(nova.success).toBe(true);

    expect(
      esquemaNovaDemanda.safeParse({ solicitante: { pessoaId: 3 }, titulo: '  ' }).success,
    ).toBe(false);
    expect(
      esquemaNovaDemanda.safeParse({
        solicitante: { pessoaId: 3 },
        titulo: 'x',
        prazo: '01/12/2026',
      }).success,
    ).toBe(false);
  });

  it('cancelar exige justificativa de ao menos 10 caracteres', () => {
    expect(esquemaCancelarDemanda.safeParse({ justificativa: 'curta' }).success).toBe(false);
    expect(esquemaCancelarDemanda.safeParse({ justificativa: '   curta   ' }).success).toBe(false);
    expect(esquemaCancelarDemanda.safeParse({ justificativa: 'Pedido duplicado' }).success).toBe(
      true,
    );
  });
});
