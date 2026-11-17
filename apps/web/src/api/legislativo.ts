import type {
  BeneficiarioDto,
  CategoriaDto,
  ConsolidadoDeProjetos,
  NaturezaDeBeneficiarioDto,
  PaginaDeBeneficiarios,
  PaginaDeProjetos,
  ProjetoFicha,
  StatusDeProjeto,
} from '@gabinete/compartilhado';
import { useQuery } from '@tanstack/react-query';
import { chamar } from './cliente';

/** Chaves das consultas do legislativo. Invalidar `legislativo` atualiza lista, ficha e consolidado. */
export const chavesDoLegislativo = {
  tudo: ['legislativo'] as const,
  projetos: (filtro: object) => ['legislativo', 'projetos', filtro] as const,
  projeto: (id: number) => ['legislativo', 'projeto', id] as const,
  etapas: ['legislativo', 'etapas'] as const,
  consolidado: ['legislativo', 'consolidado'] as const,
  categorias: ['legislativo', 'categorias'] as const,
  beneficiarios: (filtro: object) => ['legislativo', 'beneficiarios', filtro] as const,
};

// ---------------------------------------------------------------------------
// Projetos de lei
// ---------------------------------------------------------------------------

export interface FiltroDeProjetos {
  readonly pagina: number;
  readonly busca: string;
  readonly status: StatusDeProjeto | '';
  readonly atrasados: boolean;
  readonly meus: boolean;
  /** Padrão 25; o quadro pede o máximo (100) de uma vez. */
  readonly porPagina?: number;
}

export function consultaDeProjetos(filtro: FiltroDeProjetos): string {
  const q = new URLSearchParams({
    pagina: String(filtro.pagina),
    porPagina: String(filtro.porPagina ?? 25),
  });
  if (filtro.busca) q.set('busca', filtro.busca);
  if (filtro.status) q.set('status', filtro.status);
  if (filtro.atrasados) q.set('atrasados', 'true');
  if (filtro.meus) q.set('meus', 'true');
  return q.toString();
}

export const useProjetos = (filtro: FiltroDeProjetos, ativo = true) =>
  useQuery({
    queryKey: chavesDoLegislativo.projetos(filtro),
    enabled: ativo,
    queryFn: () => chamar<PaginaDeProjetos>('GET', `/api/projetos?${consultaDeProjetos(filtro)}`),
  });

export const useProjeto = (id: number | null) =>
  useQuery({
    queryKey: chavesDoLegislativo.projeto(id ?? 0),
    queryFn: () => chamar<ProjetoFicha>('GET', `/api/projetos/${id}`),
    enabled: id !== null,
  });

export const useEtapasDeProjeto = () =>
  useQuery({
    queryKey: chavesDoLegislativo.etapas,
    queryFn: () =>
      chamar<{ id: number; nome: string; papel: string; ordem: number }[]>(
        'GET',
        '/api/projetos/etapas',
      ),
  });

export const useConsolidadoDeProjetos = (ativo = true) =>
  useQuery({
    queryKey: chavesDoLegislativo.consolidado,
    enabled: ativo,
    queryFn: () => chamar<ConsolidadoDeProjetos>('GET', '/api/projetos/consolidado'),
  });

export const useCategoriasDoLegislativo = () =>
  useQuery({
    queryKey: chavesDoLegislativo.categorias,
    queryFn: () => chamar<CategoriaDto[]>('GET', '/api/legislativo/categorias'),
  });

// ---------------------------------------------------------------------------
// Beneficiários
// ---------------------------------------------------------------------------

export interface FiltroDeBeneficiarios {
  readonly pagina: number;
  readonly busca: string;
  readonly situacao: 'ativo' | 'inativo' | '';
  readonly natureza: NaturezaDeBeneficiarioDto | '';
}

export function consultaDeBeneficiarios(filtro: FiltroDeBeneficiarios): string {
  const q = new URLSearchParams({ pagina: String(filtro.pagina), porPagina: '25' });
  if (filtro.busca) q.set('busca', filtro.busca);
  if (filtro.situacao) q.set('situacao', filtro.situacao);
  if (filtro.natureza) q.set('natureza', filtro.natureza);
  return q.toString();
}

export const useBeneficiarios = (filtro: FiltroDeBeneficiarios) =>
  useQuery({
    queryKey: chavesDoLegislativo.beneficiarios(filtro),
    queryFn: () =>
      chamar<PaginaDeBeneficiarios>('GET', `/api/beneficiarios?${consultaDeBeneficiarios(filtro)}`),
  });

export type { BeneficiarioDto };
