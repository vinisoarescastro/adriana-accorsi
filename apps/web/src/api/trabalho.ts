import type {
  AgendaConsultada,
  CaixaDeAvisos,
  CompromissoDto,
  ConfiguracaoDeAvisos,
  EventoDto,
  EventoFicha,
  PainelDeTarefas,
  PaginaDeEventos,
  PaginaDeTarefas,
  StatusDeTarefa,
  TarefaFicha,
} from '@gabinete/compartilhado';
import { useQuery } from '@tanstack/react-query';
import { chamar } from './cliente';

/** Chaves das consultas do trabalho da equipe. Invalidar `trabalho` atualiza tudo (lista, ficha, painel). */
export const chavesDoTrabalho = {
  tudo: ['trabalho'] as const,
  tarefas: (filtro: object) => ['trabalho', 'tarefas', filtro] as const,
  tarefa: (id: number) => ['trabalho', 'tarefa', id] as const,
  etapasDeTarefa: ['trabalho', 'etapas-de-tarefa'] as const,
  painelDeTarefas: ['trabalho', 'painel-de-tarefas'] as const,
  agenda: (filtro: object) => ['trabalho', 'agenda', filtro] as const,
  compromisso: (id: number) => ['trabalho', 'compromisso', id] as const,
  eventos: (filtro: object) => ['trabalho', 'eventos', filtro] as const,
  evento: (id: number) => ['trabalho', 'evento', id] as const,
  avisos: ['trabalho', 'avisos'] as const,
  configuracaoDeAvisos: ['trabalho', 'configuracao-de-avisos'] as const,
};

// ---------------------------------------------------------------------------
// Tarefas
// ---------------------------------------------------------------------------

export interface FiltroDeTarefas {
  readonly pagina: number;
  readonly busca: string;
  readonly status: StatusDeTarefa | '';
  readonly atrasadas: boolean;
  readonly minhas: boolean;
  /** Padrão 25; o quadro pede o máximo (100) de uma vez. */
  readonly porPagina?: number;
}

export function consultaDeTarefas(filtro: FiltroDeTarefas): string {
  const q = new URLSearchParams({
    pagina: String(filtro.pagina),
    porPagina: String(filtro.porPagina ?? 25),
  });
  if (filtro.busca) q.set('busca', filtro.busca);
  if (filtro.status) q.set('status', filtro.status);
  if (filtro.atrasadas) q.set('atrasadas', 'true');
  if (filtro.minhas) q.set('minhas', 'true');
  return q.toString();
}

export const useTarefas = (filtro: FiltroDeTarefas, ativo = true) =>
  useQuery({
    queryKey: chavesDoTrabalho.tarefas(filtro),
    enabled: ativo,
    queryFn: () => chamar<PaginaDeTarefas>('GET', `/api/tarefas?${consultaDeTarefas(filtro)}`),
  });

export const useTarefa = (id: number | null) =>
  useQuery({
    queryKey: chavesDoTrabalho.tarefa(id ?? 0),
    queryFn: () => chamar<TarefaFicha>('GET', `/api/tarefas/${id}`),
    enabled: id !== null,
  });

export const useEtapasDeTarefa = () =>
  useQuery({
    queryKey: chavesDoTrabalho.etapasDeTarefa,
    queryFn: () =>
      chamar<{ id: number; nome: string; papel: string; ordem: number }[]>(
        'GET',
        '/api/tarefas/etapas',
      ),
  });

export const usePainelDeTarefas = () =>
  useQuery({
    queryKey: chavesDoTrabalho.painelDeTarefas,
    queryFn: () => chamar<PainelDeTarefas>('GET', '/api/painel/tarefas'),
  });

// ---------------------------------------------------------------------------
// Avisos
// ---------------------------------------------------------------------------

/** O sino consulta a cada minuto; a caixa é só do usuário da sessão. */
export const useAvisos = () =>
  useQuery({
    queryKey: chavesDoTrabalho.avisos,
    queryFn: () => chamar<CaixaDeAvisos>('GET', '/api/avisos'),
    refetchInterval: 60_000,
  });

export const useConfiguracaoDeAvisos = (ativo: boolean) =>
  useQuery({
    queryKey: chavesDoTrabalho.configuracaoDeAvisos,
    queryFn: () => chamar<ConfiguracaoDeAvisos>('GET', '/api/avisos/configuracao'),
    enabled: ativo,
  });

// ---------------------------------------------------------------------------
// Agenda
// ---------------------------------------------------------------------------

export interface PeriodoDaAgenda {
  readonly de: string;
  readonly ate: string;
  readonly minha: boolean;
}

export const useAgenda = (periodo: PeriodoDaAgenda) =>
  useQuery({
    queryKey: chavesDoTrabalho.agenda(periodo),
    queryFn: () => {
      const q = new URLSearchParams({ de: periodo.de, ate: periodo.ate });
      if (periodo.minha) q.set('minha', 'true');
      return chamar<AgendaConsultada>('GET', `/api/agenda?${q.toString()}`);
    },
  });

export const useCompromisso = (id: number | null) =>
  useQuery({
    queryKey: chavesDoTrabalho.compromisso(id ?? 0),
    queryFn: () => chamar<CompromissoDto>('GET', `/api/agenda/compromissos/${id}`),
    enabled: id !== null,
  });

// ---------------------------------------------------------------------------
// Eventos
// ---------------------------------------------------------------------------

export const useEventos = (filtro: { pagina: number; situacao: string }) =>
  useQuery({
    queryKey: chavesDoTrabalho.eventos(filtro),
    queryFn: () => {
      const q = new URLSearchParams({
        pagina: String(filtro.pagina),
        porPagina: '25',
      });
      if (filtro.situacao) q.set('situacao', filtro.situacao);
      return chamar<PaginaDeEventos>('GET', `/api/eventos?${q.toString()}`);
    },
  });

export const useEvento = (id: number | null) =>
  useQuery({
    queryKey: chavesDoTrabalho.evento(id ?? 0),
    queryFn: () => chamar<EventoFicha>('GET', `/api/eventos/${id}`),
    enabled: id !== null,
  });

export type { EventoDto };
