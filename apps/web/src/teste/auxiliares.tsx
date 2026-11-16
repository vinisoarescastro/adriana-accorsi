import userEvent from '@testing-library/user-event';
import type { Perfil, RespostaDaSessao } from '@gabinete/compartilhado';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { vi } from 'vitest';
import { App } from '../App';

interface RespostaSimulada {
  readonly status?: number;
  readonly corpo?: unknown;
}

export interface ChamadaFeita {
  readonly metodo: string;
  readonly caminho: string;
  readonly corpo: unknown;
}

/** Substitui o fetch: cada rota `"METODO /caminho"` devolve a resposta combinada; o resto é 404. */
export function simularApi(rotas: Record<string, RespostaSimulada | (() => RespostaSimulada)>) {
  const chamadas: ChamadaFeita[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (entrada: string, init?: RequestInit) => {
      const metodo = init?.method ?? 'GET';
      chamadas.push({
        metodo,
        caminho: entrada,
        corpo: typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : init?.body,
      });
      const definida = rotas[`${metodo} ${entrada}`];
      if (!definida) {
        return new Response(
          JSON.stringify({ codigo: 'nao_encontrado', mensagem: 'Não encontrado.' }),
          { status: 404 },
        );
      }
      const resposta = typeof definida === 'function' ? definida() : definida;
      const status = resposta.status ?? 200;
      return new Response(status === 204 ? null : JSON.stringify(resposta.corpo ?? {}), { status });
    }),
  );
  return chamadas;
}

export const semSessao: RespostaSimulada = {
  status: 401,
  corpo: { codigo: 'nao_autenticado', mensagem: 'Entre no sistema para continuar.' },
};

export const todasAsPaginas = [
  { id: 'painel', caminho: '/g/painel', titulo: 'Painel', operacao: 'painel.abrir' },
  { id: 'demandas', caminho: '/g/demandas', titulo: 'Demandas', operacao: 'demandas.consultar' },
  { id: 'tarefas', caminho: '/g/tarefas', titulo: 'Tarefas', operacao: 'tarefas.consultar' },
  { id: 'agenda', caminho: '/g/agenda', titulo: 'Agenda', operacao: 'agenda.consultar' },
  { id: 'eventos', caminho: '/g/eventos', titulo: 'Eventos', operacao: 'eventos.consultar' },
  { id: 'pessoas', caminho: '/g/pessoas', titulo: 'Pessoas', operacao: 'pessoas.consultar' },
  {
    id: 'emails',
    caminho: '/g/emails',
    titulo: 'E-mails',
    operacao: 'notificacoes.consultar_fila',
  },
  { id: 'equipe', caminho: '/g/equipe', titulo: 'Equipe', operacao: 'equipe.ver' },
  { id: 'fluxos', caminho: '/g/fluxos', titulo: 'Fluxos', operacao: 'fluxos.consultar' },
  {
    id: 'auditoria',
    caminho: '/g/auditoria',
    titulo: 'Auditoria',
    operacao: 'auditoria.consultar_gabinete',
  },
  {
    id: 'configuracoes',
    caminho: '/g/configuracoes',
    titulo: 'Configurações',
    operacao: 'gabinete.consultar',
  },
] as const;

export function sessaoDe(
  perfil: Perfil,
  opcoes: { paginas?: readonly string[]; trocaObrigatoria?: boolean } = {},
): RespostaDaSessao {
  const ids = opcoes.paginas ?? todasAsPaginas.map((p) => p.id);
  return {
    usuario: {
      id: 1,
      nome: 'Fulano de Tal',
      email: 'fulano@exemplo.test',
      perfil,
      habilitacoes: ['AT', 'AG'],
    },
    senhaTrocaObrigatoria: opcoes.trocaObrigatoria ?? false,
    expiraEm: '2026-11-13T00:00:00.000Z',
    paginasAlcancaveis: opcoes.trocaObrigatoria
      ? []
      : todasAsPaginas.filter((p) => ids.includes(p.id)),
  };
}

export function renderizar(caminho: string) {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={cliente}>
      <MemoryRouter initialEntries={[caminho]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** Abre uma guia (aba) de dentro de um modal: o conteúdo das outras fica oculto. */
export async function abrirGuia(dentro: HTMLElement, nome: string | RegExp) {
  await userEvent.setup().click(within(dentro).getByRole('tab', { name: nome }));
}
