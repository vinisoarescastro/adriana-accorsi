import { z } from 'zod';
import type { EtapaResumo, MovimentacaoDto } from './atendimento.js';

/** Contratos do legislativo: beneficiários, projetos de lei e o que cerca o projeto (fase 5). */

const texto = (max: number) => z.string().trim().max(max);
const id = z.number().int().positive();
const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use o formato AAAA-MM-DD.');

// ---------------------------------------------------------------------------
// CNPJ, CEP e UF
// ---------------------------------------------------------------------------

/** Tira a pontuação e põe em maiúsculas: `11.222.333/0001-81` vira `11222333000181`. */
export function normalizarCnpj(valor: string): string {
  return valor.replace(/[.\-/\s]/g, '').toUpperCase();
}

/**
 * Valida o CNPJ pelo dígito verificador. Aceita o numérico e o alfanumérico (a Receita Federal
 * adota letras a partir de julho de 2026): o valor de cada caractere é o código ASCII menos 48, e o
 * cálculo do CNPJ numérico é o caso particular. O banco repete esta regra (`cnpj_valido`).
 */
export function cnpjValido(bruto: string): boolean {
  const cnpj = normalizarCnpj(bruto);
  if (!/^[0-9A-Z]{12}[0-9]{2}$/.test(cnpj) || /^(.)\1{13}$/.test(cnpj)) return false;
  const digito = (base: string, pesos: readonly number[]) => {
    const soma = [...base].reduce((s, c, i) => s + (c.charCodeAt(0) - 48) * (pesos[i] ?? 0), 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  const primeiro = digito(cnpj.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const segundo = digito(cnpj.slice(0, 12) + primeiro, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return cnpj.endsWith(`${primeiro}${segundo}`);
}

/** `11222333000181` vira `11.222.333/0001-81`. Valor fora do padrão volta como veio. */
export function formatarCnpj(cnpj: string): string {
  const c = normalizarCnpj(cnpj);
  return /^[0-9A-Z]{12}[0-9]{2}$/.test(c)
    ? `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}`
    : cnpj;
}

export const normalizarCep = (valor: string): string => valor.replace(/\D/g, '');

/** `79002000` vira `79002-000`. */
export const formatarCep = (cep: string): string =>
  /^\d{8}$/.test(cep) ? `${cep.slice(0, 5)}-${cep.slice(5)}` : cep;

export const ufs = [
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
] as const;
export type Uf = (typeof ufs)[number];

// ---------------------------------------------------------------------------
// Categorias (vocabulários)
// ---------------------------------------------------------------------------

export const naturezasDeCategoriaDoLegislativo = [
  'tipo_proposicao',
  'assunto_projeto',
  'tipo_emenda',
] as const;
export type NaturezaDeCategoriaDoLegislativo = (typeof naturezasDeCategoriaDoLegislativo)[number];

export const esquemaNovaCategoria = z.object({
  natureza: z.enum(naturezasDeCategoriaDoLegislativo),
  nome: texto(80).min(1),
});
export type CorpoNovaCategoria = z.infer<typeof esquemaNovaCategoria>;

export const esquemaSituacaoDaCategoria = z.object({ situacao: z.enum(['ativa', 'inativa']) });

export interface CategoriaDto {
  readonly id: number;
  readonly natureza: NaturezaDeCategoriaDoLegislativo;
  readonly nome: string;
  readonly situacao: 'ativa' | 'inativa';
}

// ---------------------------------------------------------------------------
// Beneficiários
// ---------------------------------------------------------------------------

export const naturezasDeBeneficiario = ['municipio', 'orgao', 'entidade'] as const;
export type NaturezaDeBeneficiarioDto = (typeof naturezasDeBeneficiario)[number];

const cnpj = z
  .string()
  .trim()
  .transform(normalizarCnpj)
  .refine(cnpjValido, 'CNPJ inválido: confira os números.');
const cep = z
  .string()
  .trim()
  .transform(normalizarCep)
  .refine((v) => /^\d{8}$/.test(v), 'O CEP tem 8 números.');

/** Todos os campos do endereço são obrigatórios, exceto o complemento (RN-BEN-01). */
export const esquemaNovoBeneficiario = z.object({
  nomeFantasia: texto(150).min(1),
  razaoSocial: texto(200).min(1),
  cnpj,
  natureza: z.enum(naturezasDeBeneficiario),
  cep,
  logradouro: texto(200).min(1),
  numero: texto(20).min(1),
  complemento: texto(100).optional(),
  bairro: texto(100).min(1),
  cidade: texto(100).min(1),
  estado: z.enum(ufs),
});
export type CorpoNovoBeneficiario = z.infer<typeof esquemaNovoBeneficiario>;

export const esquemaAtualizarBeneficiario = esquemaNovoBeneficiario
  .partial()
  .extend({ complemento: texto(100).nullable().optional() })
  .refine((v) => Object.values(v).some((x) => x !== undefined), 'Informe ao menos um campo.');
export type CorpoAtualizarBeneficiario = z.infer<typeof esquemaAtualizarBeneficiario>;

export const esquemaSituacaoDoBeneficiario = z.object({ situacao: z.enum(['ativo', 'inativo']) });

export interface BeneficiarioDto {
  readonly id: number;
  readonly nomeFantasia: string;
  readonly razaoSocial: string;
  readonly cnpj: string;
  readonly natureza: NaturezaDeBeneficiarioDto;
  readonly cep: string;
  readonly logradouro: string;
  readonly numero: string;
  readonly complemento: string | null;
  readonly bairro: string;
  readonly cidade: string;
  readonly estado: Uf;
  readonly situacao: 'ativo' | 'inativo';
  readonly criadoEm: string;
}

export interface PaginaDeBeneficiarios {
  readonly itens: readonly BeneficiarioDto[];
  readonly total: number;
  readonly pagina: number;
  readonly porPagina: number;
}

// ---------------------------------------------------------------------------
// Projetos de lei
// ---------------------------------------------------------------------------

export const statusDeProjeto = ['em_andamento', 'concluido', 'arquivado', 'cancelado'] as const;
export type StatusDeProjeto = (typeof statusDeProjeto)[number];

export const resultadosDeVotacao = [
  'aprovado',
  'aprovado_com_emendas',
  'rejeitado',
  'retirado_de_pauta',
  'adiado',
] as const;
export type ResultadoDeVotacaoDto = (typeof resultadosDeVotacao)[number];

const numeroDoProjeto = texto(40).min(1);
const nomes = z.array(texto(150).min(1)).max(30);

export const esquemaNovoProjeto = z.object({
  titulo: texto(250).min(1),
  ementa: texto(5000).min(1),
  autoria: texto(250).min(1),
  /** O número só existe depois do protocolo; pode ficar em branco enquanto o projeto está em redação. */
  numero: numeroDoProjeto.optional(),
  tipoProposicaoId: id,
  prazo: data.optional(),
  /** Se omitido, quem cadastra é o responsável. */
  responsavelId: id.optional(),
  assuntos: z.array(id).max(20).default([]),
  coautores: nomes.default([]),
});
export type CorpoNovoProjeto = z.infer<typeof esquemaNovoProjeto>;

export const esquemaAtualizarProjeto = z
  .object({
    titulo: texto(250).min(1).optional(),
    ementa: texto(5000).min(1).optional(),
    autoria: texto(250).min(1).optional(),
    numero: numeroDoProjeto.nullable().optional(),
    tipoProposicaoId: id.optional(),
    prazo: data.nullable().optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), 'Informe ao menos um campo.');
export type CorpoAtualizarProjeto = z.infer<typeof esquemaAtualizarProjeto>;

export const esquemaMoverProjeto = z.object({ etapaId: id, observacao: texto(1000).optional() });
export const esquemaReatribuirProjeto = z.object({ responsavelId: id });
export const esquemaCancelarProjeto = z.object({
  justificativa: texto(1000).min(10, 'A justificativa deve ter ao menos 10 caracteres.'),
});
/** Substitui a lista (assuntos ou coautores) inteira. */
export const esquemaAssuntosDoProjeto = z.object({ assuntos: z.array(id).max(20) });
export const esquemaCoautoresDoProjeto = z.object({ coautores: nomes });

export const esquemaNovaTramitacao = z.object({
  comissao: texto(200).min(1),
  data,
  parecer: texto(2000).optional(),
});
export type CorpoNovaTramitacao = z.infer<typeof esquemaNovaTramitacao>;

export const esquemaAtualizarTramitacao = z
  .object({
    comissao: texto(200).min(1).optional(),
    data: data.optional(),
    parecer: texto(2000).nullable().optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), 'Informe ao menos um campo.');

/** A votação guarda só a data e o resultado, nunca o placar individual (RN-PRO-05). */
export const esquemaNovaVotacao = z.object({
  data,
  resultado: z.enum(resultadosDeVotacao),
  local: texto(200).optional(),
});
export type CorpoNovaVotacao = z.infer<typeof esquemaNovaVotacao>;

export const esquemaAtualizarVotacao = z
  .object({
    data: data.optional(),
    resultado: z.enum(resultadosDeVotacao).optional(),
    local: texto(200).nullable().optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), 'Informe ao menos um campo.');

export interface ProjetoResumo {
  readonly id: number;
  readonly titulo: string;
  readonly numero: string | null;
  readonly tipoProposicao: { readonly id: number; readonly nome: string };
  readonly autoria: string;
  readonly prazo: string | null;
  readonly etapa: EtapaResumo;
  /** Derivado do papel da etapa (ou "cancelado"). Nunca armazenado. */
  readonly status: StatusDeProjeto;
  /** Derivado na leitura: prazo vencido e ainda em andamento. Nunca armazenado. */
  readonly atrasado: boolean;
  readonly responsavel: { readonly id: number; readonly nome: string };
  readonly assuntos: readonly { readonly id: number; readonly nome: string }[];
  readonly criadoEm: string;
}

export interface TramitacaoDto {
  readonly id: number;
  readonly comissao: string;
  readonly data: string;
  readonly parecer: string | null;
  readonly registradoPor: string;
  readonly registradoEm: string;
}

export interface VotacaoDto {
  readonly id: number;
  readonly data: string;
  readonly resultado: ResultadoDeVotacaoDto;
  readonly local: string | null;
  readonly registradoPor: string;
  readonly registradoEm: string;
}

export interface ProjetoFicha extends ProjetoResumo {
  readonly ementa: string;
  readonly criador: string;
  readonly coautores: readonly { readonly id: number; readonly nome: string }[];
  readonly tramitacoes: readonly TramitacaoDto[];
  readonly votacoes: readonly VotacaoDto[];
  readonly canceladoEm: string | null;
  readonly justificativaCancelamento: string | null;
  readonly movimentacoes: readonly MovimentacaoDto[];
}

export interface PaginaDeProjetos {
  readonly itens: readonly ProjetoResumo[];
  readonly total: number;
  readonly pagina: number;
  readonly porPagina: number;
}

/** O consolidado dos projetos: tudo calculado na leitura, nada gravado. */
export interface ConsolidadoDeProjetos {
  readonly emAndamento: number;
  readonly atrasados: number;
  readonly concluidos: number;
  readonly arquivados: number;
  readonly cancelados: number;
  readonly minhasEmAndamento: number;
  readonly porEtapa: readonly {
    readonly etapaId: number;
    readonly nome: string;
    readonly papel: EtapaResumo['papel'];
    readonly ordem: number;
    readonly total: number;
  }[];
}
