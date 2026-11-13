import type {
  AcompanhamentoInterno,
  EstadoDeEnvioDto,
  NotificacaoDaPessoa,
  PaginaDeEnvios,
  PoliticaEHistorico,
  RegistroDeConsentimento,
} from '@gabinete/compartilhado';
import { useQuery } from '@tanstack/react-query';
import { chamar } from './cliente';

/**
 * Consultas da fase 3. Ficam sob a chave `atendimento`: invalidar `atendimento` (como já se faz
 * ao mover, comentar ou cancelar) atualiza também o acompanhamento e a fila de e-mails.
 */
export const chavesDoCidadao = {
  acompanhamento: (demandaId: number) =>
    ['atendimento', 'cidadao', 'acompanhamento', demandaId] as const,
  consentimento: (pessoaId: number) =>
    ['atendimento', 'cidadao', 'consentimento', pessoaId] as const,
  politica: ['atendimento', 'cidadao', 'politica'] as const,
  fila: (filtro: object) => ['atendimento', 'cidadao', 'fila', filtro] as const,
};

export const useAcompanhamento = (demandaId: number, ativo: boolean) =>
  useQuery({
    queryKey: chavesDoCidadao.acompanhamento(demandaId),
    queryFn: () =>
      chamar<AcompanhamentoInterno>('GET', `/api/demandas/${demandaId}/acompanhamento`),
    enabled: ativo,
  });

export const useConsentimento = (pessoaId: number, ativo: boolean) =>
  useQuery({
    queryKey: chavesDoCidadao.consentimento(pessoaId),
    queryFn: () =>
      chamar<{ situacao: NotificacaoDaPessoa; historico: RegistroDeConsentimento[] }>(
        'GET',
        `/api/pessoas/${pessoaId}/consentimento`,
      ),
    enabled: ativo,
  });

export const usePolitica = (ativo: boolean) =>
  useQuery({
    queryKey: chavesDoCidadao.politica,
    queryFn: () => chamar<PoliticaEHistorico>('GET', '/api/publicacao/politica'),
    enabled: ativo,
  });

export const useFilaDeEmails = (filtro: { pagina: number; estado: EstadoDeEnvioDto | '' }) =>
  useQuery({
    queryKey: chavesDoCidadao.fila(filtro),
    queryFn: () => {
      const q = new URLSearchParams({ pagina: String(filtro.pagina), porPagina: '25' });
      if (filtro.estado) q.set('estado', filtro.estado);
      return chamar<PaginaDeEnvios>('GET', `/api/notificacoes?${q.toString()}`);
    },
    refetchInterval: 15_000,
  });
