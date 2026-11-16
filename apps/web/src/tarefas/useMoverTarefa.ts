import type { PaginaDeTarefas } from '@gabinete/compartilhado';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { chamar } from '../api/cliente';
import { chavesDoTrabalho } from '../api/trabalho';
import { useToast } from '../componentes/toast';
import type { DestinoDaEtapa } from '../demandas/useMoverDemanda';

const statusDoPapel = {
  entrada: 'em_andamento',
  intermediaria: 'em_andamento',
  conclusao: 'concluido',
  arquivamento: 'arquivado',
} as const;

/** Troca a etapa da tarefa nas páginas em cache, para o quadro reagir na hora. */
export function moverNaPagina(
  pagina: PaginaDeTarefas,
  tarefaId: number,
  destino: DestinoDaEtapa,
): PaginaDeTarefas {
  return {
    ...pagina,
    itens: pagina.itens.map((t) =>
      t.id === tarefaId
        ? {
            ...t,
            etapa: { id: destino.id, nome: destino.nome, papel: destino.papel },
            status: statusDoPapel[destino.papel],
            atrasada:
              destino.papel === 'entrada' || destino.papel === 'intermediaria' ? t.atrasada : false,
          }
        : t,
    ),
  };
}

/** Move a tarefa para outra etapa (arrastar no quadro), com o mesmo cuidado da demanda. */
export function useMoverTarefa() {
  const cliente = useQueryClient();
  const avisar = useToast();
  const prefixo = ['trabalho', 'tarefas'] as const;
  return useMutation({
    mutationFn: ({ id, destino }: { id: number; destino: DestinoDaEtapa }) =>
      chamar<unknown>('POST', `/api/tarefas/${id}/mover`, { corpo: { etapaId: destino.id } }),
    onMutate: async ({ id, destino }) => {
      await cliente.cancelQueries({ queryKey: prefixo });
      const anteriores = cliente.getQueriesData<PaginaDeTarefas>({ queryKey: prefixo });
      for (const [chave, pagina] of anteriores)
        if (pagina?.itens) cliente.setQueryData(chave, moverNaPagina(pagina, id, destino));
      return { anteriores };
    },
    onError: (erro, _variaveis, contexto) => {
      for (const [chave, pagina] of contexto?.anteriores ?? []) cliente.setQueryData(chave, pagina);
      avisar({ tom: 'erro', titulo: 'Não foi possível mover a tarefa', texto: erro.message });
    },
    onSuccess: (_resposta, { destino }) =>
      avisar({ tom: 'sucesso', titulo: `Tarefa movida para ${destino.nome}` }),
    onSettled: () => cliente.invalidateQueries({ queryKey: chavesDoTrabalho.tudo }),
  });
}
