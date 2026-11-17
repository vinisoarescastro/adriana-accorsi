import type { DespesaFicha, RespostaDaSessao } from '@gabinete/compartilhado';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { chamar } from '../api/cliente';
import { chavesDoFinanceiro } from '../api/financeiro';
import { Modal } from '../componentes/modal';
import { useToast } from '../componentes/toast';
import { AvisoDeErro } from '../componentes/ui';
import { FormularioDaDespesa, type DadosDoFormularioDaDespesa } from './FormularioDaDespesa';

/** Lançar despesa: ela nasce como rascunho (Lançada), sem consumir saldo; anexe o comprovante e envie para análise. */
export function NovaDespesa({
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
    mutationFn: (d: DadosDoFormularioDaDespesa) =>
      chamar<DespesaFicha>('POST', '/api/ceap/despesas', {
        corpo: {
          categoriaId: d.categoriaId,
          descricao: d.descricao,
          valor: d.valor,
          dataDocumento: d.dataDocumento,
          fornecedorNome: d.fornecedorNome,
          fornecedorDocumento: d.fornecedorDocumento,
          numeroDocumento: d.numeroDocumento,
          ...(d.responsavelId ? { responsavelId: d.responsavelId } : {}),
        },
      }),
    onSuccess: async (d) => {
      await cliente.invalidateQueries({ queryKey: chavesDoFinanceiro.tudo });
      avisar({
        tom: 'sucesso',
        titulo: 'Despesa lançada',
        texto: 'Anexe o comprovante e envie para análise.',
      });
      aoAbrir(d.id);
    },
  });
  return (
    <Modal titulo="Lançar despesa" tamanho="lg" aoFechar={aoFechar}>
      <FormularioDaDespesa
        sessao={sessao}
        rotuloDeEnviar="Lançar despesa"
        enviando={criar.isPending}
        aoEnviar={(d) => criar.mutate(d)}
        aoCancelar={aoFechar}
        erro={<AvisoDeErro erro={criar.error} />}
      />
    </Modal>
  );
}
