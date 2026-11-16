import type { QuadroDeDemandas } from '@gabinete/compartilhado';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { chavesDoAtendimento } from '../api/atendimento';
import { chamar } from '../api/cliente';
import { useToast } from '../componentes/toast';

export interface DestinoDaEtapa {
  readonly id: number;
  readonly nome: string;
  readonly papel: 'entrada' | 'intermediaria' | 'conclusao' | 'arquivamento';
}

/** Tira a demanda da coluna de origem e a põe no topo da de destino, para o quadro reagir na hora. */
export function moverNoQuadro(
  quadro: QuadroDeDemandas,
  demandaId: number,
  destino: DestinoDaEtapa,
): QuadroDeDemandas {
  const item = quadro.colunas.flatMap((c) => c.itens).find((d) => d.id === demandaId);
  if (!item) return quadro;
  const movida = { ...item, etapa: { id: destino.id, nome: destino.nome, papel: destino.papel } };
  return {
    ...quadro,
    colunas: quadro.colunas.map((c) => {
      if (c.itens.some((d) => d.id === demandaId))
        return { ...c, total: c.total - 1, itens: c.itens.filter((d) => d.id !== demandaId) };
      if (c.etapa.id === destino.id)
        return { ...c, total: c.total + 1, itens: [movida, ...c.itens] };
      return c;
    }),
  };
}

/**
 * Move a demanda para outra etapa (arrastar no quadro). O quadro muda na hora; se a API recusar (as
 * regras do fluxo continuam valendo), volta ao que era e a recusa aparece num aviso.
 */
export function useMoverDemanda() {
  const cliente = useQueryClient();
  const avisar = useToast();
  return useMutation({
    mutationFn: ({ id, destino }: { id: number; destino: DestinoDaEtapa }) =>
      chamar<unknown>('POST', `/api/demandas/${id}/mover`, { corpo: { etapaId: destino.id } }),
    onMutate: async ({ id, destino }) => {
      await cliente.cancelQueries({ queryKey: chavesDoAtendimento.quadro });
      const anteriores = cliente.getQueriesData<QuadroDeDemandas>({
        queryKey: chavesDoAtendimento.quadro,
      });
      for (const [chave, quadro] of anteriores)
        if (quadro) cliente.setQueryData(chave, moverNoQuadro(quadro, id, destino));
      return { anteriores };
    },
    onError: (erro, _variaveis, contexto) => {
      for (const [chave, quadro] of contexto?.anteriores ?? []) cliente.setQueryData(chave, quadro);
      avisar({ tom: 'erro', titulo: 'Não foi possível mover a demanda', texto: erro.message });
    },
    onSuccess: (_resposta, { destino }) =>
      avisar({ tom: 'sucesso', titulo: `Demanda movida para ${destino.nome}` }),
    onSettled: () => cliente.invalidateQueries({ queryKey: chavesDoAtendimento.tudo }),
  });
}
