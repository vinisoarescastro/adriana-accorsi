import type { PaginaDeProjetos } from '@gabinete/compartilhado';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { chamar } from '../api/cliente';
import { chavesDoLegislativo } from '../api/legislativo';
import { useToast } from '../componentes/toast';
import type { DestinoDaEtapa } from '../demandas/useMoverDemanda';

const statusDoPapel = {
  entrada: 'em_andamento',
  intermediaria: 'em_andamento',
  conclusao: 'concluido',
  arquivamento: 'arquivado',
} as const;

/** Troca a etapa do projeto nas páginas em cache, para o quadro reagir na hora. */
export function moverNaPagina(
  pagina: PaginaDeProjetos,
  projetoId: number,
  destino: DestinoDaEtapa,
): PaginaDeProjetos {
  return {
    ...pagina,
    itens: pagina.itens.map((p) =>
      p.id === projetoId
        ? {
            ...p,
            etapa: { id: destino.id, nome: destino.nome, papel: destino.papel },
            status: statusDoPapel[destino.papel],
            atrasado:
              destino.papel === 'entrada' || destino.papel === 'intermediaria' ? p.atrasado : false,
          }
        : p,
    ),
  };
}

/** Move o projeto para outra etapa (arrastar no quadro). Se o servidor recusar, o quadro volta. */
export function useMoverProjeto() {
  const cliente = useQueryClient();
  const avisar = useToast();
  const prefixo = ['legislativo', 'projetos'] as const;
  return useMutation({
    mutationFn: ({ id, destino }: { id: number; destino: DestinoDaEtapa }) =>
      chamar<unknown>('POST', `/api/projetos/${id}/mover`, { corpo: { etapaId: destino.id } }),
    onMutate: async ({ id, destino }) => {
      await cliente.cancelQueries({ queryKey: prefixo });
      const anteriores = cliente.getQueriesData<PaginaDeProjetos>({ queryKey: prefixo });
      for (const [chave, pagina] of anteriores)
        if (pagina?.itens) cliente.setQueryData(chave, moverNaPagina(pagina, id, destino));
      return { anteriores };
    },
    onError: (erro, _variaveis, contexto) => {
      for (const [chave, pagina] of contexto?.anteriores ?? []) cliente.setQueryData(chave, pagina);
      avisar({ tom: 'erro', titulo: 'Não foi possível mover o projeto', texto: erro.message });
    },
    onSuccess: (_resposta, { destino }) =>
      avisar({ tom: 'sucesso', titulo: `Projeto movido para ${destino.nome}` }),
    onSettled: () => cliente.invalidateQueries({ queryKey: chavesDoLegislativo.tudo }),
  });
}
