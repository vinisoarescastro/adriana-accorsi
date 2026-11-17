import { z } from 'zod';
import type { EtapaResumo, MovimentacaoDto } from './atendimento.js';
import { dinheiroPositivo } from './dinheiro.js';
import { cnpjValido, normalizarCnpj } from './legislativo.js';

/**
 * Contratos da CEAP (fase 6). A norma não está no código: cota, tetos, prazos e categorias são dados com
 * vigência. Dinheiro é texto com duas casas; o saldo é derivado e nunca gravado.
 */

const texto = (max: number) => z.string().trim().max(max);
const id = z.number().int().positive();
const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use o formato AAAA-MM-DD.');

// ---------------------------------------------------------------------------
// CPF e documento do fornecedor
// ---------------------------------------------------------------------------

export const normalizarCpf = (valor: string): string => valor.replace(/\D/g, '');

/** Valida o CPF pelos dois dígitos verificadores. */
export function cpfValido(bruto: string): boolean {
  const cpf = normalizarCpf(bruto);
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  const digito = (base: string, peso: number) => {
    const soma = [...base].reduce((s, c, i) => s + Number(c) * (peso - i), 0);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return (
    digito(cpf.slice(0, 9), 10) === Number(cpf[9]) &&
    digito(cpf.slice(0, 10), 11) === Number(cpf[10])
  );
}

/** CPF ou CNPJ (numérico ou alfanumérico), só com os caracteres, ou `null` se inválido. */
export function documentoDoFornecedor(bruto: string): string | null {
  const limpo = bruto.replace(/[.\-/\s]/g, '').toUpperCase();
  if (/^\d{11}$/.test(limpo)) return cpfValido(limpo) ? limpo : null;
  const cnpj = normalizarCnpj(limpo);
  return cnpj.length === 14 && cnpjValido(cnpj) ? cnpj : null;
}

export function formatarDocumentoDoFornecedor(doc: string): string {
  if (/^\d{11}$/.test(doc))
    return `${doc.slice(0, 3)}.${doc.slice(3, 6)}.${doc.slice(6, 9)}-${doc.slice(9)}`;
  return /^[0-9A-Z]{12}\d{2}$/.test(doc)
    ? `${doc.slice(0, 2)}.${doc.slice(2, 5)}.${doc.slice(5, 8)}/${doc.slice(8, 12)}-${doc.slice(12)}`
    : doc;
}

// ---------------------------------------------------------------------------
// Parâmetros e categorias
// ---------------------------------------------------------------------------

export const chavesDeParametroDaCeap = [
  'cota_mensal',
  'prazo_apresentacao_dias',
  'guarda_originais_anos',
  'limite_alerta_saldo',
] as const;
export type ChaveDeParametroDaCeapDto = (typeof chavesDeParametroDaCeap)[number];

/** O que cada parâmetro é, para a tela e para a validação. */
export const descricaoDosParametros: Record<
  ChaveDeParametroDaCeapDto,
  { rotulo: string; tipo: 'dinheiro' | 'dias' | 'anos' }
> = {
  cota_mensal: { rotulo: 'Cota mensal', tipo: 'dinheiro' },
  prazo_apresentacao_dias: { rotulo: 'Prazo para apresentar a despesa', tipo: 'dias' },
  guarda_originais_anos: { rotulo: 'Guarda dos originais', tipo: 'anos' },
  limite_alerta_saldo: { rotulo: 'Limite de alerta do saldo', tipo: 'dinheiro' },
};

/** Valor de um parâmetro: dinheiro (até 2 casas, zero vale para o alerta) ou inteiro positivo (dias e anos). */
export const esquemaNovoParametro = z
  .object({
    chave: z.enum(chavesDeParametroDaCeap),
    valor: texto(20).transform((v) => v.replace(',', '.')),
    /** A vigência nova começa nesta data; a anterior, aberta, se encerra no dia anterior. */
    vigenteDe: data,
  })
  .superRefine((v, ctx) => {
    const tipo = descricaoDosParametros[v.chave].tipo;
    const ok =
      tipo === 'dinheiro'
        ? /^\d{1,12}(\.\d{1,2})?$/.test(v.valor) &&
          (v.chave === 'limite_alerta_saldo' || Number(v.valor) > 0)
        : /^\d{1,4}$/.test(v.valor) && Number(v.valor) > 0;
    if (!ok) {
      ctx.addIssue({
        code: 'custom',
        path: ['valor'],
        message:
          tipo === 'dinheiro'
            ? 'Informe um valor em reais, com até duas casas.'
            : 'Informe um número inteiro maior que zero.',
      });
    }
  });
export type CorpoNovoParametro = z.infer<typeof esquemaNovoParametro>;

export interface ParametroDto {
  readonly id: number;
  readonly chave: ChaveDeParametroDaCeapDto;
  readonly valor: string;
  readonly vigenteDe: string;
  readonly vigenteAte: string | null;
  readonly definidoPor: string;
  readonly definidoEm: string;
}

export interface ParametrosDaCeap {
  /** O que vale hoje, por chave (`null` quando nada vale). */
  readonly vigentes: Readonly<Record<ChaveDeParametroDaCeapDto, ParametroDto | null>>;
  /** A história inteira, do mais recente ao mais antigo. */
  readonly historico: readonly ParametroDto[];
}

export const esquemaNovaCategoriaDaCeap = z.object({
  nome: texto(100).min(1),
  itemNorma: texto(200).optional(),
  tetoMensal: dinheiroPositivo.optional(),
  comprovanteObrigatorio: z.boolean().default(true),
});
export const esquemaAtualizarCategoriaDaCeap = z
  .object({
    nome: texto(100).min(1).optional(),
    itemNorma: texto(200).nullable().optional(),
    tetoMensal: dinheiroPositivo.nullable().optional(),
    comprovanteObrigatorio: z.boolean().optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), 'Informe ao menos um campo.');
export const esquemaSituacaoDaCategoriaDaCeap = z.object({
  situacao: z.enum(['ativa', 'inativa']),
});

export interface CategoriaDaCeapDto {
  readonly id: number;
  readonly nome: string;
  readonly itemNorma: string | null;
  readonly tetoMensal: string | null;
  readonly comprovanteObrigatorio: boolean;
  readonly situacao: 'ativa' | 'inativa';
}

// ---------------------------------------------------------------------------
// Despesa
// ---------------------------------------------------------------------------

export const statusDeDespesa = [
  'lancada',
  'em_analise',
  'aprovada',
  'apresentada',
  'ressarcida',
  'reprovada',
  'glosada',
  'arquivada',
  'cancelada',
] as const;
export type StatusDeDespesa = (typeof statusDeDespesa)[number];

/** O nome da etapa do fluxo da despesa e o status que ele representa. */
export const statusPelaEtapaDaDespesa: Readonly<Record<string, StatusDeDespesa>> = {
  Lançada: 'lancada',
  'Em análise': 'em_analise',
  Aprovada: 'aprovada',
  'Apresentada à Câmara': 'apresentada',
  Ressarcida: 'ressarcida',
  Reprovada: 'reprovada',
  'Glosada pela Câmara': 'glosada',
  Arquivada: 'arquivada',
};

/** Os status em que a despesa já reduz o saldo (RN-CEAP-05): em análise e adiante, menos reprovada e glosada. */
export const statusQueConsomemSaldo: readonly StatusDeDespesa[] = [
  'em_analise',
  'aprovada',
  'apresentada',
  'ressarcida',
];

const documentoDoFornecedorEsquema = z
  .string()
  .trim()
  .transform((v, ctx) => {
    const doc = documentoDoFornecedor(v);
    if (!doc)
      ctx.addIssue({ code: 'custom', message: 'CPF ou CNPJ inválido: confira os números.' });
    return doc ?? '';
  });

export const esquemaNovaDespesa = z.object({
  categoriaId: id,
  descricao: texto(500).min(1),
  valor: dinheiroPositivo,
  dataDocumento: data,
  fornecedorNome: texto(200).min(1),
  fornecedorDocumento: documentoDoFornecedorEsquema,
  numeroDocumento: texto(60).min(1),
  /** Se omitido, quem lança é o responsável. */
  responsavelId: id.optional(),
});
export type CorpoNovaDespesa = z.infer<typeof esquemaNovaDespesa>;

export const esquemaAtualizarDespesa = z
  .object({
    categoriaId: id.optional(),
    descricao: texto(500).min(1).optional(),
    valor: dinheiroPositivo.optional(),
    dataDocumento: data.optional(),
    fornecedorNome: texto(200).min(1).optional(),
    fornecedorDocumento: documentoDoFornecedorEsquema.optional(),
    numeroDocumento: texto(60).min(1).optional(),
    responsavelId: id.optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), 'Informe ao menos um campo.');
export type CorpoAtualizarDespesa = z.infer<typeof esquemaAtualizarDespesa>;

export const esquemaDecidirDespesa = z
  .object({ decisao: z.enum(['aprovar', 'reprovar']), motivo: texto(1000).optional() })
  .refine((v) => v.decisao === 'aprovar' || (v.motivo ?? '').length >= 10, {
    message: 'Reprovar exige o motivo, com ao menos 10 caracteres.',
    path: ['motivo'],
  });
export type CorpoDecidirDespesa = z.infer<typeof esquemaDecidirDespesa>;

export const esquemaCancelarDespesa = z.object({
  justificativa: texto(1000).min(10, 'A justificativa deve ter ao menos 10 caracteres.'),
});
/** O acompanhamento depois da aprovação: apresentar à Câmara, ressarcir, glosar, arquivar. */
export const esquemaAcompanharDespesa = z.object({
  etapaId: id,
  observacao: texto(1000).optional(),
});

export interface ComprovanteDto {
  readonly id: number;
  readonly nome: string;
  readonly tipo: string;
  readonly tamanho: number;
  readonly enviadoPor: string;
  readonly enviadoEm: string;
}

export interface DespesaResumo {
  readonly id: number;
  readonly descricao: string;
  readonly valor: string;
  readonly dataDocumento: string;
  readonly competencia: { readonly ano: number; readonly mes: number };
  readonly categoria: { readonly id: number; readonly nome: string };
  readonly fornecedor: { readonly nome: string; readonly documento: string };
  readonly numeroDocumento: string;
  readonly etapa: EtapaResumo;
  readonly status: StatusDeDespesa;
  /** Em análise ou adiante (menos reprovada e glosada): já reduz o saldo. */
  readonly consomeSaldo: boolean;
  readonly responsavel: { readonly id: number; readonly nome: string };
  readonly lancadaPor: { readonly id: number; readonly nome: string };
  readonly decididaPor: string | null;
  readonly decididaEm: string | null;
  /** Quem decidiu é quem lançou (só Chefe, Administrador e Parlamentar podem): fica marcado e vai ao relatório. */
  readonly decisaoPeloProprioLancador: boolean;
  readonly motivoReprovacao: string | null;
  /** Derivado do prazo de apresentação vigente: a despesa passou dele sem ser apresentada. */
  readonly foraDoPrazo: boolean;
  readonly quantidadeDeComprovantes: number;
  readonly criadaEm: string;
}

export interface DespesaFicha extends DespesaResumo {
  readonly comprovantes: readonly ComprovanteDto[];
  readonly canceladaEm: string | null;
  readonly justificativaCancelamento: string | null;
  readonly competenciaEncerrada: boolean;
  readonly movimentacoes: readonly MovimentacaoDto[];
}

export interface PaginaDeDespesas {
  readonly itens: readonly DespesaResumo[];
  readonly total: number;
  readonly pagina: number;
  readonly porPagina: number;
}

// ---------------------------------------------------------------------------
// Saldo
// ---------------------------------------------------------------------------

export interface MesDoSaldo {
  readonly mes: number;
  /** A cota do mês, do parâmetro que valia no dia 1; `null` se nenhum valia. */
  readonly cota: string | null;
  /** O que despesas que consomem saldo somam neste mês. */
  readonly consumido: string;
  /** A soma das cotas do exercício até este mês (o saldo acumula dentro do exercício). */
  readonly cotaAcumulada: string;
  readonly consumidoAcumulado: string;
  /** Cota acumulada menos consumido acumulado. */
  readonly saldo: string;
  readonly encerrada: boolean;
}

export interface SaldoDaCeap {
  readonly ano: number;
  /** A data da fotografia: hoje, ou a da reconstituição. */
  readonly em: string;
  /** O mês de referência (o da data `em`, se estiver no exercício; senão, dezembro ou janeiro). */
  readonly mesDeReferencia: number;
  readonly meses: readonly MesDoSaldo[];
  readonly saldoAtual: string;
  readonly aguardandoAnalise: number;
  readonly limiteDeAlerta: string | null;
  readonly abaixoDoLimite: boolean;
  /** Há mês sem cota: o parâmetro "cota mensal" não cobre o exercício. */
  readonly mesesSemCota: readonly number[];
  readonly porCategoria: readonly {
    readonly categoriaId: number;
    readonly nome: string;
    readonly consumido: string;
    readonly tetoMensal: string | null;
  }[];
  readonly porStatus: readonly {
    readonly status: StatusDeDespesa;
    readonly total: number;
    readonly valor: string;
  }[];
}

export interface PainelFinanceiro {
  readonly saldo: SaldoDaCeap;
  readonly emendas: {
    readonly disponibilizado: string;
    readonly comprometido: string;
    readonly disponivel: string;
    /** O que já foi executado, e o que está destinado e ainda falta executar. */
    readonly utilizado: string;
    readonly aExecutar: string;
  } | null;
}

// ---------------------------------------------------------------------------
// Relatório de prestação de contas
// ---------------------------------------------------------------------------

export interface RelatorioDaCeap {
  /** O período, em competências (AAAA-MM). */
  readonly de: string;
  readonly ate: string;
  readonly geradoEm: string;
  readonly total: string;
  readonly porCategoria: readonly {
    readonly nome: string;
    readonly quantidade: number;
    readonly valor: string;
  }[];
  readonly porStatus: readonly {
    readonly status: StatusDeDespesa;
    readonly quantidade: number;
    readonly valor: string;
  }[];
  readonly despesas: readonly DespesaResumo[];
  /** As decididas por quem as lançou: o relatório as lista à parte (RN-CEAP-12). */
  readonly decididasPeloLancador: readonly DespesaResumo[];
  readonly foraDoPrazo: readonly DespesaResumo[];
  readonly semComprovante: readonly DespesaResumo[];
}
