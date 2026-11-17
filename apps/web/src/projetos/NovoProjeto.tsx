import type { ProjetoFicha, RespostaDaSessao } from '@gabinete/compartilhado';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { chamar } from '../api/cliente';
import { chavesDoLegislativo } from '../api/legislativo';
import { Modal } from '../componentes/modal';
import { useToast } from '../componentes/toast';
import { AvisoDeErro } from '../componentes/ui';
import { FormularioDoProjeto, type DadosDoFormularioDoProjeto } from './FormularioDoProjeto';

/** Cadastro de projeto de lei. O projeto nasce na Entrada do fluxo federal (Em redação). */
export function NovoProjeto({
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
    mutationFn: (d: DadosDoFormularioDoProjeto) =>
      chamar<ProjetoFicha>('POST', '/api/projetos', {
        corpo: {
          titulo: d.titulo,
          ementa: d.ementa,
          autoria: d.autoria,
          ...(d.numero ? { numero: d.numero } : {}),
          tipoProposicaoId: d.tipoProposicaoId,
          ...(d.prazo ? { prazo: d.prazo } : {}),
          ...(d.responsavelId ? { responsavelId: d.responsavelId } : {}),
          assuntos: d.assuntos,
          coautores: d.coautores,
        },
      }),
    onSuccess: async (projeto) => {
      await cliente.invalidateQueries({ queryKey: chavesDoLegislativo.tudo });
      avisar({ tom: 'sucesso', titulo: 'Projeto cadastrado' });
      aoAbrir(projeto.id);
    },
  });

  return (
    <Modal titulo="Novo projeto de lei" tamanho="lg" aoFechar={aoFechar}>
      <FormularioDoProjeto
        sessao={sessao}
        rotuloDeEnviar="Cadastrar projeto"
        enviando={criar.isPending}
        aoEnviar={(d) => criar.mutate(d)}
        aoCancelar={aoFechar}
        erro={<AvisoDeErro erro={criar.error} />}
      />
    </Modal>
  );
}
