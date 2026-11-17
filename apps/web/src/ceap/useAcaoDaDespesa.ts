import type { DespesaFicha } from '@gabinete/compartilhado';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { chamar } from '../api/cliente';
import { chavesDoFinanceiro } from '../api/financeiro';
import { useToast } from '../componentes/toast';

export interface PedidoDeAcaoDaDespesa {
  readonly metodo: 'POST' | 'PATCH' | 'DELETE';
  /** O caminho depois de `/api/ceap/despesas/:id`. */
  readonly caminho: string;
  readonly corpo?: unknown;
}

/** Executa uma ação sobre a despesa, atualiza a ficha na hora e invalida lista, saldo e painel. */
export function useAcaoDaDespesa(id: number, mensagem?: string) {
  const cliente = useQueryClient();
  const avisar = useToast();
  return useMutation({
    mutationFn: ({ metodo, caminho, corpo }: PedidoDeAcaoDaDespesa) =>
      chamar<DespesaFicha>(metodo, `/api/ceap/despesas/${id}${caminho}`, {
        ...(corpo !== undefined ? { corpo } : {}),
      }),
    onSuccess: async (ficha) => {
      if (ficha && 'comprovantes' in ficha)
        cliente.setQueryData(chavesDoFinanceiro.despesa(id), ficha);
      await cliente.invalidateQueries({ queryKey: chavesDoFinanceiro.tudo });
      if (mensagem) avisar({ tom: 'sucesso', titulo: mensagem });
    },
    onError: (erro) =>
      avisar({ tom: 'erro', titulo: 'Não foi possível concluir', texto: erro.message }),
  });
}
