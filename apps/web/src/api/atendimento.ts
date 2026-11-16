import type {
  ComentarioDto,
  DemandaFicha,
  DemandaRegistrada,
  DocumentoDto,
  PaginaDeDemandas,
  PaginaDePessoas,
  PainelDeAtendimento,
  PessoaDto,
  QuadroDeDemandas,
  StatusDeDemanda,
} from '@gabinete/compartilhado';
import { useQuery } from '@tanstack/react-query';
import { chamar, ErroDaApi } from './cliente';

/** Chaves das consultas do atendimento. Invalidar `atendimento` atualiza tudo (lista, quadro, painel, ficha). */
export const chavesDoAtendimento = {
  tudo: ['atendimento'] as const,
  demandas: (filtro: object) => ['atendimento', 'demandas', filtro] as const,
  quadro: ['atendimento', 'quadro'] as const,
  ficha: (id: number) => ['atendimento', 'ficha', id] as const,
  pessoas: (filtro: object) => ['atendimento', 'pessoas', filtro] as const,
  pessoa: (id: number) => ['atendimento', 'pessoa', id] as const,
  painel: ['atendimento', 'painel'] as const,
};

export interface FiltroDeDemandas {
  readonly pagina: number;
  readonly busca: string;
  readonly status: StatusDeDemanda | '';
  readonly atrasadas: boolean;
  readonly solicitanteId?: number;
}

export function consultaDeDemandas(filtro: FiltroDeDemandas): string {
  const q = new URLSearchParams({ pagina: String(filtro.pagina), porPagina: '25' });
  if (filtro.busca) q.set('busca', filtro.busca);
  if (filtro.status) q.set('status', filtro.status);
  if (filtro.atrasadas) q.set('atrasadas', 'true');
  if (filtro.solicitanteId) q.set('solicitanteId', String(filtro.solicitanteId));
  return q.toString();
}

export const useDemandas = (filtro: FiltroDeDemandas, ativo = true) =>
  useQuery({
    queryKey: chavesDoAtendimento.demandas(filtro),
    enabled: ativo,
    queryFn: () => chamar<PaginaDeDemandas>('GET', `/api/demandas?${consultaDeDemandas(filtro)}`),
  });

export interface FiltroDoQuadro {
  readonly busca: string;
  readonly atrasadas: boolean;
  readonly solicitanteId?: number | undefined;
}

export const useQuadro = (ativo: boolean, filtro: FiltroDoQuadro) =>
  useQuery({
    queryKey: [...chavesDoAtendimento.quadro, filtro] as const,
    queryFn: () => {
      const q = new URLSearchParams();
      if (filtro.busca) q.set('busca', filtro.busca);
      if (filtro.atrasadas) q.set('atrasadas', 'true');
      if (filtro.solicitanteId) q.set('solicitanteId', String(filtro.solicitanteId));
      const texto = q.toString();
      return chamar<QuadroDeDemandas>('GET', `/api/demandas/quadro${texto ? `?${texto}` : ''}`);
    },
    enabled: ativo,
  });

export const useFicha = (id: number | null) =>
  useQuery({
    queryKey: chavesDoAtendimento.ficha(id ?? 0),
    queryFn: () => chamar<DemandaFicha>('GET', `/api/demandas/${id}`),
    enabled: id !== null,
  });

export const usePainelDeAtendimento = (ativo: boolean) =>
  useQuery({
    queryKey: chavesDoAtendimento.painel,
    queryFn: () => chamar<PainelDeAtendimento>('GET', '/api/painel/atendimento'),
    enabled: ativo,
  });

export const usePessoas = (filtro: { pagina: number; busca: string; situacao: string }) =>
  useQuery({
    queryKey: chavesDoAtendimento.pessoas(filtro),
    queryFn: () => {
      const q = new URLSearchParams({ pagina: String(filtro.pagina), porPagina: '25' });
      if (filtro.busca) q.set('busca', filtro.busca);
      if (filtro.situacao) q.set('situacao', filtro.situacao);
      return chamar<PaginaDePessoas>('GET', `/api/pessoas?${q.toString()}`);
    },
  });

/** A pessoa ativa com esse telefone, ou `null`. Usada na tela de registro para evitar duplicata. */
export async function buscarPessoaPorTelefone(telefone: string): Promise<PessoaDto | null> {
  const r = await chamar<{ pessoa: PessoaDto | null }>(
    'GET',
    `/api/pessoas/por-telefone?telefone=${encodeURIComponent(telefone)}`,
  );
  return r.pessoa;
}

export type { ComentarioDto, DemandaFicha, DemandaRegistrada, DocumentoDto };
export { ErroDaApi };

export const usePessoa = (id: number | null) =>
  useQuery({
    queryKey: chavesDoAtendimento.pessoa(id ?? 0),
    queryFn: () => chamar<PessoaDto>('GET', `/api/pessoas/${id}`),
    enabled: id !== null,
  });
