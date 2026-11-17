import { z } from 'zod';
import type { EtapaResumo, MovimentacaoDto } from './atendimento.js';
import { dinheiroPositivo } from './dinheiro.js';

/** Contratos das emendas parlamentares (fase 6). Dinheiro é sempre texto, com duas casas. */

const texto = (max: number) => z.string().trim().max(max);
const id = z.number().int().positive();
const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use o formato AAAA-MM-DD.');

export const statusDeEmenda = ['em_andamento', 'concluida', 'arquivada', 'cancelada'] as const;
export type StatusDeEmenda = (typeof statusDeEmenda)[number];

export const esquemaNovaEmenda = z.object({
  identificacao: texto(100).min(1),
  exercicio: z.number().int().min(2000).max(2100),
  tipoId: id,
  finalidade: texto(2000).min(1),
  /** O valor disponibilizado. É o único valor que se cadastra: o resto é derivado. */
  valor: dinheiroPositivo,
  prazoDestinacao: data.optional(),
  prazoEmpenho: data.optional(),
  prazoExecucao: data.optional(),
  /** Se omitido, quem cadastra é o responsável. */
  responsavelId: id.optional(),
});
export type CorpoNovaEmenda = z.infer<typeof esquemaNovaEmenda>;

export const esquemaAtualizarEmenda = z
  .object({
    identificacao: texto(100).min(1).optional(),
    exercicio: z.number().int().min(2000).max(2100).optional(),
    tipoId: id.optional(),
    finalidade: texto(2000).min(1).optional(),
    /** Novo valor disponibilizado: entra no histórico e não pode ficar abaixo do comprometido. */
    valor: dinheiroPositivo.optional(),
    prazoDestinacao: data.nullable().optional(),
    prazoEmpenho: data.nullable().optional(),
    prazoExecucao: data.nullable().optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), 'Informe ao menos um campo.');
export type CorpoAtualizarEmenda = z.infer<typeof esquemaAtualizarEmenda>;

export const esquemaMoverEmenda = z.object({ etapaId: id, observacao: texto(1000).optional() });
export const esquemaReatribuirEmenda = z.object({ responsavelId: id });
export const esquemaCancelarEmenda = z.object({
  justificativa: texto(1000).min(10, 'A justificativa deve ter ao menos 10 caracteres.'),
});

export const esquemaNovaDestinacao = z.object({
  beneficiarioId: id,
  valor: dinheiroPositivo,
  finalidade: texto(2000).min(1),
});
export type CorpoNovaDestinacao = z.infer<typeof esquemaNovaDestinacao>;
export const esquemaCancelarDestinacao = esquemaCancelarEmenda;
export const esquemaMoverDestinacao = esquemaMoverEmenda;

export const esquemaNovaExecucao = z.object({
  valor: dinheiroPositivo,
  data,
  observacao: texto(1000).optional(),
});
export type CorpoNovaExecucao = z.infer<typeof esquemaNovaExecucao>;

/** Os valores de uma emenda. Só o disponibilizado é gravado; o resto é derivado na leitura. */
export interface ValoresDaEmenda {
  readonly disponibilizado: string;
  /** Soma das destinações não canceladas. */
  readonly comprometido: string;
  /** Soma das execuções das destinações não canceladas. */
  readonly utilizado: string;
  /** Disponibilizado menos comprometido: o que ainda se pode destinar. */
  readonly disponivel: string;
  /** Comprometido menos utilizado: o que falta executar. */
  readonly aExecutar: string;
}

export interface EmendaResumo {
  readonly id: number;
  readonly identificacao: string;
  readonly exercicio: number;
  readonly tipo: { readonly id: number; readonly nome: string };
  readonly finalidade: string;
  readonly etapa: EtapaResumo;
  /** Derivado do papel da etapa (ou "cancelada"). */
  readonly status: StatusDeEmenda;
  readonly responsavel: { readonly id: number; readonly nome: string };
  readonly prazoDestinacao: string | null;
  readonly prazoEmpenho: string | null;
  readonly prazoExecucao: string | null;
  /** Derivado: em andamento com algum prazo vencido. */
  readonly atrasada: boolean;
  readonly valores: ValoresDaEmenda;
  readonly criadoEm: string;
}

export interface ExecucaoDto {
  readonly id: number;
  readonly valor: string;
  readonly data: string;
  readonly observacao: string | null;
  readonly registradoPor: string;
  readonly registradoEm: string;
}

export interface DestinacaoDto {
  readonly id: number;
  readonly beneficiario: { readonly id: number; readonly nome: string; readonly cnpj: string };
  readonly valor: string;
  readonly finalidade: string;
  readonly etapa: EtapaResumo;
  readonly executado: string;
  readonly aExecutar: string;
  readonly cancelada: boolean;
  readonly justificativaCancelamento: string | null;
  readonly criadaPor: string;
  readonly criadaEm: string;
  readonly execucoes: readonly ExecucaoDto[];
}

export interface EmendaFicha extends EmendaResumo {
  readonly criador: string;
  readonly destinacoes: readonly DestinacaoDto[];
  readonly historicoDoValor: readonly {
    readonly valor: string;
    readonly em: string;
    readonly por: string;
  }[];
  readonly canceladaEm: string | null;
  readonly justificativaCancelamento: string | null;
  readonly movimentacoes: readonly MovimentacaoDto[];
}

export interface PaginaDeEmendas {
  readonly itens: readonly EmendaResumo[];
  readonly total: number;
  readonly pagina: number;
  readonly porPagina: number;
}

/** Quadro, consolidado e atrasadas: tudo calculado agora. */
export interface ConsolidadoDeEmendas {
  readonly emAndamento: number;
  readonly atrasadas: number;
  readonly concluidas: number;
  readonly arquivadas: number;
  readonly canceladas: number;
  readonly minhasEmAndamento: number;
  /** Soma dos valores das emendas não canceladas. */
  readonly valores: ValoresDaEmenda;
  readonly porEtapa: readonly {
    readonly etapaId: number;
    readonly nome: string;
    readonly papel: EtapaResumo['papel'];
    readonly ordem: number;
    readonly total: number;
  }[];
}

/** Os valores de cada emenda numa data passada (Administrador, ou a Parlamentar para consultar). */
export interface ReconstituicaoDeEmendas {
  readonly em: string;
  readonly itens: readonly {
    readonly id: number;
    readonly identificacao: string;
    readonly exercicio: number;
    readonly valores: ValoresDaEmenda;
  }[];
  readonly total: ValoresDaEmenda;
}
