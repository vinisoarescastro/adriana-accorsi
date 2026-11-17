import type {
  AgendaConsultada,
  AtividadeRecente,
  PainelDaEquipe,
  PendenciasDoUsuario,
  TendenciaDoAtendimento,
} from '@gabinete/compartilhado';
import { useQuery } from '@tanstack/react-query';
import { chamar } from './cliente';

/** As consultas do painel ficam sob `trabalho`: mexer em uma tarefa atualiza o painel junto. */
export const chavesDoPainel = {
  tendencia: ['trabalho', 'painel', 'tendencia'] as const,
  pendencias: ['trabalho', 'painel', 'pendencias'] as const,
  atividade: ['trabalho', 'painel', 'atividade'] as const,
  equipe: ['trabalho', 'painel', 'equipe'] as const,
  proximos: ['trabalho', 'painel', 'proximos'] as const,
};

export const useTendenciaDoAtendimento = (ativo: boolean) =>
  useQuery({
    queryKey: chavesDoPainel.tendencia,
    enabled: ativo,
    queryFn: () => chamar<TendenciaDoAtendimento>('GET', '/api/painel/atendimento/tendencia'),
  });

export const usePendenciasDoUsuario = () =>
  useQuery({
    queryKey: chavesDoPainel.pendencias,
    queryFn: () => chamar<PendenciasDoUsuario>('GET', '/api/painel/pendencias'),
  });

export const useAtividadeRecente = () =>
  useQuery({
    queryKey: chavesDoPainel.atividade,
    queryFn: () => chamar<AtividadeRecente[]>('GET', '/api/painel/atividade'),
  });

export const usePainelDaEquipe = (ativo: boolean) =>
  useQuery({
    queryKey: chavesDoPainel.equipe,
    enabled: ativo,
    queryFn: () => chamar<PainelDaEquipe>('GET', '/api/painel/equipe'),
  });

export const useProximosCompromissos = (ativo: boolean) =>
  useQuery({
    queryKey: chavesDoPainel.proximos,
    enabled: ativo,
    queryFn: () => chamar<AgendaConsultada>('GET', '/api/agenda/proximos?limite=5'),
  });
