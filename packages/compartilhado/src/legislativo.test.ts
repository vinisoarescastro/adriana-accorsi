import { describe, expect, it } from 'vitest';
import {
  cnpjValido,
  esquemaNovoBeneficiario,
  esquemaNovoProjeto,
  formatarCep,
  formatarCnpj,
  normalizarCnpj,
} from './legislativo.js';

describe('CNPJ', () => {
  it('valida o numérico, com ou sem pontuação', () => {
    expect(cnpjValido('11.222.333/0001-81')).toBe(true);
    expect(cnpjValido('11222333000181')).toBe(true);
    expect(cnpjValido('11222333000182')).toBe(false);
  });

  it('valida o alfanumérico (a partir de julho de 2026)', () => {
    expect(cnpjValido('12.ABC.345/01DE-35')).toBe(true);
    expect(cnpjValido('12abc34501de35')).toBe(true);
    expect(cnpjValido('12ABC34501DE36')).toBe(false);
  });

  it('recusa repetido, curto e longo', () => {
    expect(cnpjValido('00000000000000')).toBe(false);
    expect(cnpjValido('1122233300018')).toBe(false);
    expect(cnpjValido('112223330001811')).toBe(false);
  });

  it('normaliza e formata', () => {
    expect(normalizarCnpj(' 11.222.333/0001-81 ')).toBe('11222333000181');
    expect(formatarCnpj('11222333000181')).toBe('11.222.333/0001-81');
    expect(formatarCep('79002000')).toBe('79002-000');
  });
});

const beneficiario = {
  nomeFantasia: 'Prefeitura de Exemplo',
  razaoSocial: 'Município de Exemplo',
  cnpj: '11.222.333/0001-81',
  natureza: 'municipio',
  cep: '79002-000',
  logradouro: 'Rua A',
  numero: '10',
  bairro: 'Centro',
  cidade: 'Campo Grande',
  estado: 'MS',
};

describe('contratos do legislativo', () => {
  it('o beneficiário normaliza CNPJ e CEP; só o complemento é opcional', () => {
    const lido = esquemaNovoBeneficiario.parse(beneficiario);
    expect(lido.cnpj).toBe('11222333000181');
    expect(lido.cep).toBe('79002000');
    expect(esquemaNovoBeneficiario.safeParse({ ...beneficiario, bairro: '' }).success).toBe(false);
    expect(esquemaNovoBeneficiario.safeParse({ ...beneficiario, cnpj: '1' }).success).toBe(false);
    expect(esquemaNovoBeneficiario.safeParse({ ...beneficiario, estado: 'XX' }).success).toBe(
      false,
    );
  });

  it('o projeto exige título, ementa e autoria; o número é opcional', () => {
    const base = {
      titulo: 'Poda segura',
      ementa: 'Institui o programa.',
      autoria: 'Dep. A',
      tipoProposicaoId: 1,
    };
    expect(esquemaNovoProjeto.safeParse(base).success).toBe(true);
    for (const campo of ['titulo', 'ementa', 'autoria'] as const) {
      expect(esquemaNovoProjeto.safeParse({ ...base, [campo]: '  ' }).success).toBe(false);
    }
  });
});
