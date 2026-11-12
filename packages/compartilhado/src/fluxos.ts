import { z } from 'zod';

/** Contratos dos fluxos de trabalho. */

export const tiposDeProcesso = [
  'demanda',
  'tarefa',
  'projeto_lei',
  'emenda',
  'despesa_ceap',
] as const;
export type TipoDeProcessoDto = (typeof tiposDeProcesso)[number];

export const papeisDeEtapa = ['entrada', 'intermediaria', 'conclusao', 'arquivamento'] as const;
export type PapelDeEtapaDto = (typeof papeisDeEtapa)[number];

const nomeInterno = z.string().trim().min(1).max(80);
const rotulo = z.string().trim().min(1).max(60);
const prazo = z.number().int().min(1).max(3650);

export const esquemaAjustarEtapa = z
  .object({
    nomeInterno: nomeInterno.optional(),
    ordem: z.number().int().min(1).max(999).optional(),
    rotuloPublico: rotulo.nullable().optional(),
    visivelPublico: z.boolean().optional(),
    prazoPadraoDias: prazo.nullable().optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), 'Informe ao menos um campo.');
export type CorpoAjustarEtapa = z.infer<typeof esquemaAjustarEtapa>;

/** Só etapas Intermediárias e de Conclusão se criam: Entrada e Arquivamento são únicas e fixas. */
export const esquemaNovaEtapa = z.object({
  nomeInterno,
  papel: z.enum(['intermediaria', 'conclusao']),
  ordem: z.number().int().min(1).max(999).optional(),
  rotuloPublico: rotulo.nullable().optional(),
  visivelPublico: z.boolean().optional(),
  prazoPadraoDias: prazo.nullable().optional(),
});
export type CorpoNovaEtapa = z.infer<typeof esquemaNovaEtapa>;

export const esquemaSituacaoDaEtapa = z.object({ situacao: z.enum(['ativa', 'inativa']) });

export interface EtapaDoFluxo {
  readonly id: number;
  readonly nomeInterno: string;
  readonly ordem: number;
  readonly papel: PapelDeEtapaDto;
  readonly rotuloPublico: string | null;
  readonly visivelPublico: boolean;
  readonly prazoPadraoDias: number | null;
  readonly situacao: 'ativa' | 'inativa';
}

export interface FluxoDeTrabalho {
  readonly tipo: TipoDeProcessoDto;
  readonly nome: string;
  readonly etapas: readonly EtapaDoFluxo[];
}
