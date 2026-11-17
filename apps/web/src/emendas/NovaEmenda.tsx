import type { EmendaFicha, RespostaDaSessao } from '@gabinete/compartilhado';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { chamar } from '../api/cliente';
import { chavesDoFinanceiro } from '../api/financeiro';
import { Modal } from '../componentes/modal';
import { useToast } from '../componentes/toast';
import { AvisoDeErro } from '../componentes/ui';
import { FormularioDaEmenda, type DadosDoFormularioDaEmenda } from './FormularioDaEmenda';

/** Cadastro de emenda: nasce na Entrada do fluxo, com o valor disponibilizado. */
export function NovaEmenda({
  sessao,
  aoFechar,
  aoAbrir,
}: {
  sessao: RespostaDaSessao;
  aoFechar: () => void;
  aoAbrir: (id: number) => void;
}) {
  const cliente = useQueryClient();
  const avisar = useToast();
  const criar = useMutation({
    mutationFn: (d: DadosDoFormularioDaEmenda) =>
      chamar<EmendaFicha>('POST', '/api/emendas', {
        corpo: {
          identificacao: d.identificacao,
          exercicio: d.exercicio,
          tipoId: d.tipoId,
          finalidade: d.finalidade,
          valor: d.valor,
          ...(d.prazoDestinacao ? { prazoDestinacao: d.prazoDestinacao } : {}),
          ...(d.prazoEmpenho ? { prazoEmpenho: d.prazoEmpenho } : {}),
          ...(d.prazoExecucao ? { prazoExecucao: d.prazoExecucao } : {}),
          ...(d.responsavelId ? { responsavelId: d.responsavelId } : {}),
        },
      }),
    onSuccess: async (e) => {
      await cliente.invalidateQueries({ queryKey: chavesDoFinanceiro.tudo });
      avisar({ tom: 'sucesso', titulo: 'Emenda cadastrada' });
      aoAbrir(e.id);
    },
  });
  return (
    <Modal titulo="Nova emenda" tamanho="lg" aoFechar={aoFechar}>
      <FormularioDaEmenda
        sessao={sessao}
        rotuloDeEnviar="Cadastrar emenda"
        enviando={criar.isPending}
        aoEnviar={(d) => criar.mutate(d)}
        aoCancelar={aoFechar}
        erro={<AvisoDeErro erro={criar.error} />}
      />
    </Modal>
  );
}
