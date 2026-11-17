import type { ProjetoFicha } from '@gabinete/compartilhado';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { chamar } from '../api/cliente';
import { chavesDoLegislativo } from '../api/legislativo';
import { useToast } from '../componentes/toast';

export interface PedidoDeAcao {
  readonly metodo: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** O caminho depois de `/api/projetos/:id`, por exemplo `/mover` ou `/tramitacoes/3`. */
  readonly caminho: string;
  readonly corpo?: unknown;
}

/**
 * Executa uma ação sobre o projeto, atualiza a ficha na hora e invalida a lista e o consolidado. Toda
 * ação do projeto devolve a ficha inteira, então a tela nunca fica com um pedaço desatualizado.
 */
export function useAcaoDoProjeto(id: number, mensagem?: string) {
  const cliente = useQueryClient();
  const avisar = useToast();
  return useMutation({
    mutationFn: ({ metodo, caminho, corpo }: PedidoDeAcao) =>
      chamar<ProjetoFicha>(metodo, `/api/projetos/${id}${caminho}`, {
        ...(corpo !== undefined ? { corpo } : {}),
      }),
    onSuccess: async (ficha) => {
      cliente.setQueryData(chavesDoLegislativo.projeto(id), ficha);
      await cliente.invalidateQueries({ queryKey: chavesDoLegislativo.tudo });
      if (mensagem) avisar({ tom: 'sucesso', titulo: mensagem });
    },
    onError: (erro) =>
      avisar({ tom: 'erro', titulo: 'Não foi possível concluir', texto: erro.message }),
  });
}
