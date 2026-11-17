import { describe, expect, it } from 'vitest';
import {
  cpfValido,
  documentoDoFornecedor,
  esquemaDecidirDespesa,
  esquemaNovaDespesa,
  esquemaNovoParametro,
  formatarDocumentoDoFornecedor,
} from './ceap.js';

describe('CPF e documento do fornecedor', () => {
  it('valida o CPF pelos dígitos', () => {
    expect(cpfValido('529.982.247-25')).toBe(true);
    expect(cpfValido('52998224725')).toBe(true);
    expect(cpfValido('52998224726')).toBe(false);
    expect(cpfValido('11111111111')).toBe(false);
    expect(cpfValido('123')).toBe(false);
  });

  it('aceita CPF, CNPJ numérico e CNPJ alfanumérico, e devolve só os caracteres', () => {
    expect(documentoDoFornecedor('529.982.247-25')).toBe('52998224725');
    expect(documentoDoFornecedor('11.222.333/0001-81')).toBe('11222333000181');
    expect(documentoDoFornecedor('12.ABC.345/01DE-35')).toBe('12ABC34501DE35');
    expect(documentoDoFornecedor('11.222.333/0001-82')).toBeNull();
    expect(formatarDocumentoDoFornecedor('52998224725')).toBe('529.982.247-25');
    expect(formatarDocumentoDoFornecedor('11222333000181')).toBe('11.222.333/0001-81');
  });
});

describe('contratos da CEAP', () => {
  it('o parâmetro de dinheiro tem até 2 casas; o de dias e anos é inteiro positivo; o alerta aceita zero', () => {
    const lido = (chave: string, valor: string) =>
      esquemaNovoParametro.safeParse({ chave, valor, vigenteDe: '2026-01-01' }).success;
    expect(lido('cota_mensal', '45000,50')).toBe(true);
    expect(lido('cota_mensal', '0')).toBe(false);
    expect(lido('cota_mensal', '1.234')).toBe(false);
    expect(lido('limite_alerta_saldo', '0')).toBe(true);
    expect(lido('prazo_apresentacao_dias', '90')).toBe(true);
    expect(lido('prazo_apresentacao_dias', '90.5')).toBe(false);
    expect(lido('guarda_originais_anos', '0')).toBe(false);
    expect(lido('inventado', '1')).toBe(false);
  });

  it('a despesa exige valor positivo e fornecedor válido; reprovar exige motivo', () => {
    const base = {
      categoriaId: 1,
      descricao: 'Passagem',
      valor: '350,90',
      dataDocumento: '2026-03-10',
      fornecedorNome: 'Companhia',
      fornecedorDocumento: '11.222.333/0001-81',
      numeroDocumento: 'NF-1',
    };
    const lida = esquemaNovaDespesa.parse(base);
    expect(lida.valor).toBe('350.90');
    expect(lida.fornecedorDocumento).toBe('11222333000181');
    expect(esquemaNovaDespesa.safeParse({ ...base, valor: '0' }).success).toBe(false);
    expect(esquemaNovaDespesa.safeParse({ ...base, fornecedorDocumento: '123' }).success).toBe(
      false,
    );
    expect(esquemaDecidirDespesa.safeParse({ decisao: 'aprovar' }).success).toBe(true);
    expect(esquemaDecidirDespesa.safeParse({ decisao: 'reprovar', motivo: 'curto' }).success).toBe(
      false,
    );
    expect(
      esquemaDecidirDespesa.safeParse({ decisao: 'reprovar', motivo: 'Comprovante ilegível' })
        .success,
    ).toBe(true);
  });
});
