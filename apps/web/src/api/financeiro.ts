import type {
  CategoriaDaCeapDto,
  CategoriaDto,
  ConsolidadoDeEmendas,
  DespesaFicha,
  EmendaFicha,
  PainelFinanceiro,
  PaginaDeDespesas,
  PaginaDeEmendas,
  ParametrosDaCeap,
  SaldoDaCeap,
  StatusDeDespesa,
  StatusDeEmenda,
} from '@gabinete/compartilhado';
import { useQuery } from '@tanstack/react-query';
import { chamar } from './cliente';

/** Chaves das consultas do financeiro. Invalidar `financeiro` atualiza emendas, despesas, saldo e painel. */
export const chavesDoFinanceiro = {
  tudo: ['financeiro'] as const,
  emendas: (filtro: object) => ['financeiro', 'emendas', filtro] as const,
  emenda: (id: number) => ['financeiro', 'emenda', id] as const,
  etapasDeEmenda: ['financeiro', 'etapas-de-emenda'] as const,
  consolidadoDeEmendas: ['financeiro', 'consolidado-de-emendas'] as const,
  tiposDeEmenda: ['financeiro', 'tipos-de-emenda'] as const,
  saldo: (ano: number) => ['financeiro', 'saldo', ano] as const,
  despesas: (filtro: object) => ['financeiro', 'despesas', filtro] as const,
  despesa: (id: number) => ['financeiro', 'despesa', id] as const,
  etapasDeDespesa: ['financeiro', 'etapas-de-despesa'] as const,
  categorias: ['financeiro', 'categorias-da-ceap'] as const,
  parametros: ['financeiro', 'parametros-da-ceap'] as const,
  painel: ['financeiro', 'painel'] as const,
};

// --- Emendas ---

export interface FiltroDeEmendas {
  readonly pagina: number;
  readonly busca: string;
  readonly status: StatusDeEmenda | '';
  readonly atrasadas: boolean;
  readonly minhas: boolean;
  readonly exercicio?: number | undefined;
  readonly porPagina?: number;
}

export function consultaDeEmendas(f: FiltroDeEmendas): string {
  const q = new URLSearchParams({ pagina: String(f.pagina), porPagina: String(f.porPagina ?? 25) });
  if (f.busca) q.set('busca', f.busca);
  if (f.status) q.set('status', f.status);
  if (f.atrasadas) q.set('atrasadas', 'true');
  if (f.minhas) q.set('minhas', 'true');
  if (f.exercicio) q.set('exercicio', String(f.exercicio));
  return q.toString();
}

export const useEmendas = (filtro: FiltroDeEmendas, ativo = true) =>
  useQuery({
    queryKey: chavesDoFinanceiro.emendas(filtro),
    enabled: ativo,
    queryFn: () => chamar<PaginaDeEmendas>('GET', `/api/emendas?${consultaDeEmendas(filtro)}`),
  });

export const useEmenda = (id: number | null) =>
  useQuery({
    queryKey: chavesDoFinanceiro.emenda(id ?? 0),
    enabled: id !== null,
    queryFn: () => chamar<EmendaFicha>('GET', `/api/emendas/${id}`),
  });

export const useEtapasDeEmenda = () =>
  useQuery({
    queryKey: chavesDoFinanceiro.etapasDeEmenda,
    queryFn: () =>
      chamar<{ id: number; nome: string; papel: string; ordem: number }[]>(
        'GET',
        '/api/emendas/etapas',
      ),
  });

export const useConsolidadoDeEmendas = () =>
  useQuery({
    queryKey: chavesDoFinanceiro.consolidadoDeEmendas,
    queryFn: () => chamar<ConsolidadoDeEmendas>('GET', '/api/emendas/consolidado'),
  });

export const useTiposDeEmenda = () =>
  useQuery({
    queryKey: chavesDoFinanceiro.tiposDeEmenda,
    queryFn: () => chamar<CategoriaDto[]>('GET', '/api/emendas/tipos'),
  });

// --- CEAP ---

export const useSaldoDaCeap = (ano: number, ativo = true) =>
  useQuery({
    queryKey: chavesDoFinanceiro.saldo(ano),
    enabled: ativo,
    queryFn: () => chamar<SaldoDaCeap>('GET', `/api/ceap/saldo?ano=${ano}`),
  });

export interface FiltroDeDespesas {
  readonly pagina: number;
  readonly busca: string;
  readonly status: StatusDeDespesa | '';
  readonly ano: number;
  readonly mes?: number | undefined;
  readonly minhas: boolean;
}

export function consultaDeDespesas(f: FiltroDeDespesas): string {
  const q = new URLSearchParams({ pagina: String(f.pagina), porPagina: '25', ano: String(f.ano) });
  if (f.busca) q.set('busca', f.busca);
  if (f.status) q.set('status', f.status);
  if (f.mes) q.set('mes', String(f.mes));
  if (f.minhas) q.set('minhas', 'true');
  return q.toString();
}

export const useDespesas = (filtro: FiltroDeDespesas, ativo = true) =>
  useQuery({
    queryKey: chavesDoFinanceiro.despesas(filtro),
    enabled: ativo,
    queryFn: () =>
      chamar<PaginaDeDespesas>('GET', `/api/ceap/despesas?${consultaDeDespesas(filtro)}`),
  });

export const useDespesa = (id: number | null) =>
  useQuery({
    queryKey: chavesDoFinanceiro.despesa(id ?? 0),
    enabled: id !== null,
    queryFn: () => chamar<DespesaFicha>('GET', `/api/ceap/despesas/${id}`),
  });

export const useEtapasDeDespesa = () =>
  useQuery({
    queryKey: chavesDoFinanceiro.etapasDeDespesa,
    queryFn: () =>
      chamar<{ id: number; nome: string; papel: string; ordem: number }[]>(
        'GET',
        '/api/ceap/etapas',
      ),
  });

export const useCategoriasDaCeap = () =>
  useQuery({
    queryKey: chavesDoFinanceiro.categorias,
    queryFn: () => chamar<CategoriaDaCeapDto[]>('GET', '/api/ceap/categorias'),
  });

export const useParametrosDaCeap = () =>
  useQuery({
    queryKey: chavesDoFinanceiro.parametros,
    queryFn: () => chamar<ParametrosDaCeap>('GET', '/api/ceap/parametros'),
  });

export const usePainelFinanceiro = (ativo: boolean) =>
  useQuery({
    queryKey: chavesDoFinanceiro.painel,
    enabled: ativo,
    queryFn: () => chamar<PainelFinanceiro>('GET', '/api/painel/financeiro'),
  });
