import type { EmendaFicha, PaginaDeEmendas } from '@gabinete/compartilhado';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { chamar } from '../api/cliente';
import { chavesDoFinanceiro } from '../api/financeiro';
import { useToast } from '../componentes/toast';
import type { DestinoDaEtapa } from '../demandas/useMoverDemanda';

export interface PedidoDeAcaoDaEmenda {
  readonly metodo: 'POST' | 'PATCH';
  /** O caminho depois de `/api/emendas/:id`. */
  readonly caminho: string;
  readonly corpo?: unknown;
}

/** Executa uma ação sobre a emenda, atualiza a ficha na hora e invalida lista, consolidado e painel. */
export function useAcaoDaEmenda(id: number, mensagem?: string) {
  const cliente = useQueryClient();
  const avisar = useToast();
  return useMutation({
    mutationFn: ({ metodo, caminho, corpo }: PedidoDeAcaoDaEmenda) =>
      chamar<EmendaFicha>(metodo, `/api/emendas/${id}${caminho}`, {
        ...(corpo !== undefined ? { corpo } : {}),
      }),
    onSuccess: async (ficha) => {
      cliente.setQueryData(chavesDoFinanceiro.emenda(id), ficha);
      await cliente.invalidateQueries({ queryKey: chavesDoFinanceiro.tudo });
      if (mensagem) avisar({ tom: 'sucesso', titulo: mensagem });
    },
    onError: (erro) =>
      avisar({ tom: 'erro', titulo: 'Não foi possível concluir', texto: erro.message }),
  });
}

const statusDoPapel = {
  entrada: 'em_andamento',
  intermediaria: 'em_andamento',
  conclusao: 'concluida',
  arquivamento: 'arquivada',
} as const;

/** Move a emenda de etapa (arrastar no quadro): reage na hora e volta atrás se o servidor recusar. */
export function useMoverEmenda() {
  const cliente = useQueryClient();
  const avisar = useToast();
  const prefixo = ['financeiro', 'emendas'] as const;
  return useMutation({
    mutationFn: ({ id, destino }: { id: number; destino: DestinoDaEtapa }) =>
      chamar<unknown>('POST', `/api/emendas/${id}/mover`, { corpo: { etapaId: destino.id } }),
    onMutate: async ({ id, destino }) => {
      await cliente.cancelQueries({ queryKey: prefixo });
      const anteriores = cliente.getQueriesData<PaginaDeEmendas>({ queryKey: prefixo });
      for (const [chave, pagina] of anteriores) {
        if (!pagina?.itens) continue;
        cliente.setQueryData(chave, {
          ...pagina,
          itens: pagina.itens.map((e) =>
            e.id === id
              ? {
                  ...e,
                  etapa: { id: destino.id, nome: destino.nome, papel: destino.papel },
                  status: statusDoPapel[destino.papel],
                }
              : e,
          ),
        });
      }
      return { anteriores };
    },
    onError: (erro, _v, contexto) => {
      for (const [chave, pagina] of contexto?.anteriores ?? []) cliente.setQueryData(chave, pagina);
      avisar({ tom: 'erro', titulo: 'Não foi possível mover a emenda', texto: erro.message });
    },
    onSuccess: (_r, { destino }) =>
      avisar({ tom: 'sucesso', titulo: `Emenda movida para ${destino.nome}` }),
    onSettled: () => cliente.invalidateQueries({ queryKey: chavesDoFinanceiro.tudo }),
  });
}
