import type {
  FluxoDeTrabalho,
  IdentidadeDoGabinete,
  PaginaDaTrilha,
  RespostaDaSessao,
  UsuarioDaEquipe,
} from '@gabinete/compartilhado';
import { useQuery } from '@tanstack/react-query';
import { chamar, ErroDaApi } from './cliente';

export const chaves = {
  sessao: ['sessao'] as const,
  equipe: ['equipe'] as const,
  gabinete: ['gabinete'] as const,
  fluxos: ['fluxos'] as const,
  auditoria: (filtro: object) => ['auditoria', filtro] as const,
  historico: (id: number) => ['historico', id] as const,
};

/** A sessão atual, ou `null` quando ninguém entrou (401 não é erro, é "sem sessão"). */
export function useSessao() {
  return useQuery({
    queryKey: chaves.sessao,
    queryFn: async () => {
      try {
        return await chamar<RespostaDaSessao>('GET', '/api/acesso/sessao');
      } catch (erro) {
        if (erro instanceof ErroDaApi && erro.status === 401) return null;
        throw erro;
      }
    },
    retry: false,
    staleTime: 60_000,
  });
}

export const useEquipe = () =>
  useQuery({
    queryKey: chaves.equipe,
    queryFn: () => chamar<UsuarioDaEquipe[]>('GET', '/api/equipe'),
  });

/** A identidade do gabinete, ou `null` enquanto não foi configurada (a API responde 404). */
export const useGabinete = () =>
  useQuery({
    queryKey: chaves.gabinete,
    queryFn: async () => {
      try {
        return await chamar<IdentidadeDoGabinete>('GET', '/api/gabinete');
      } catch (erro) {
        if (erro instanceof ErroDaApi && erro.status === 404) return null;
        throw erro;
      }
    },
    retry: false,
  });

export const useFluxos = () =>
  useQuery({
    queryKey: chaves.fluxos,
    queryFn: () => chamar<FluxoDeTrabalho[]>('GET', '/api/fluxos'),
  });

export interface FiltroDaAuditoria {
  readonly pagina: number;
  readonly operacao: string;
  readonly entidade: string;
  readonly autorId?: number | undefined;
  /** AAAA-MM-DD, no fuso do gabinete (Brasília). */
  readonly de?: string;
  readonly ate?: string;
}

export const useAuditoria = (filtro: FiltroDaAuditoria) =>
  useQuery({
    queryKey: chaves.auditoria(filtro),
    queryFn: () => {
      const consulta = new URLSearchParams({ pagina: String(filtro.pagina), porPagina: '25' });
      if (filtro.operacao) consulta.set('operacao', filtro.operacao);
      if (filtro.entidade) consulta.set('entidade', filtro.entidade);
      if (filtro.autorId) consulta.set('autorId', String(filtro.autorId));
      if (filtro.de) consulta.set('de', `${filtro.de}T00:00:00-03:00`);
      if (filtro.ate) consulta.set('ate', `${filtro.ate}T23:59:59.999-03:00`);
      return chamar<PaginaDaTrilha>('GET', `/api/auditoria?${consulta.toString()}`);
    },
  });

/** As operações e entidades que já aparecem na trilha: alimentam os filtros. */
export const useOpcoesDaAuditoria = () =>
  useQuery({
    queryKey: ['auditoria', 'opcoes'] as const,
    queryFn: () =>
      chamar<{ operacoes: string[]; entidades: string[] }>('GET', '/api/auditoria/opcoes'),
    staleTime: 60_000,
  });
