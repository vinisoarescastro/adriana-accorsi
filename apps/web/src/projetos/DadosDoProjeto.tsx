import type { ProjetoFicha, RespostaDaSessao } from '@gabinete/compartilhado';
import { Pencil } from 'lucide-react';
import { useState } from 'react';
import { AvisoDeErro, Botao } from '../componentes/ui';
import { Propriedades } from '../componentes/propriedades';
import { formatarDataHora } from '../formatos';
import { FormularioDoProjeto, type DadosDoFormularioDoProjeto } from './FormularioDoProjeto';
import { useAcaoDoProjeto } from './useAcaoDoProjeto';

const iguais = (a: readonly (number | string)[], b: readonly (number | string)[]) =>
  a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|');

/**
 * Os dados do projeto na guia Detalhes: a ementa, o número, o tipo, a autoria, os assuntos e os
 * coautores. Quem pode alterar (o responsável, o Supervisor ou superior) edita ali mesmo.
 */
export function DadosDoProjeto({
  ficha,
  sessao,
  podeEditar,
}: {
  ficha: ProjetoFicha;
  sessao: RespostaDaSessao;
  podeEditar: boolean;
}) {
  const [editando, setEditando] = useState(false);
  const acao = useAcaoDoProjeto(ficha.id);

  const salvar = async (d: DadosDoFormularioDoProjeto) => {
    const mudancas: Record<string, unknown> = {};
    if (d.titulo !== ficha.titulo) mudancas.titulo = d.titulo;
    if (d.ementa !== ficha.ementa) mudancas.ementa = d.ementa;
    if (d.autoria !== ficha.autoria) mudancas.autoria = d.autoria;
    if (d.numero !== (ficha.numero ?? '')) mudancas.numero = d.numero || null;
    if (d.tipoProposicaoId !== ficha.tipoProposicao.id)
      mudancas.tipoProposicaoId = d.tipoProposicaoId;
    if (d.prazo !== (ficha.prazo ?? '')) mudancas.prazo = d.prazo || null;

    // Cada parte tem a sua rota; só chama o que mudou. A última devolve a ficha atualizada.
    if (Object.keys(mudancas).length > 0) {
      await acao.mutateAsync({ metodo: 'PATCH', caminho: '', corpo: mudancas });
    }
    if (
      !iguais(
        d.assuntos,
        ficha.assuntos.map((a) => a.id),
      )
    ) {
      await acao.mutateAsync({
        metodo: 'PUT',
        caminho: '/assuntos',
        corpo: { assuntos: d.assuntos },
      });
    }
    if (
      !iguais(
        d.coautores,
        ficha.coautores.map((c) => c.nome),
      )
    ) {
      await acao.mutateAsync({
        metodo: 'PUT',
        caminho: '/coautores',
        corpo: { coautores: d.coautores },
      });
    }
    setEditando(false);
  };

  if (editando) {
    return (
      <FormularioDoProjeto
        sessao={sessao}
        projeto={ficha}
        rotuloDeEnviar="Salvar dados"
        enviando={acao.isPending}
        aoEnviar={(d) => void salvar(d).catch(() => undefined)}
        aoCancelar={() => setEditando(false)}
        erro={<AvisoDeErro erro={acao.error} />}
      />
    );
  }

  return (
    <>
      <Propriedades
        colunas
        itens={[
          { rotulo: 'Número', valor: ficha.numero ?? 'Ainda sem número' },
          { rotulo: 'Tipo de proposição', valor: ficha.tipoProposicao.nome },
          { rotulo: 'Autoria', valor: ficha.autoria },
          {
            rotulo: 'Coautores',
            valor: ficha.coautores.length > 0 ? ficha.coautores.map((c) => c.nome).join(', ') : '-',
          },
          {
            rotulo: 'Assuntos',
            valor: ficha.assuntos.length > 0 ? ficha.assuntos.map((a) => a.nome).join(', ') : '-',
          },
          {
            rotulo: 'Cadastrado',
            valor: (
              <>
                {ficha.criador}
                <span className="propriedades__apoio">{formatarDataHora(ficha.criadoEm)}</span>
              </>
            ),
          },
        ]}
      />
      <h4 className="ficha-acoes__titulo">Ementa</h4>
      <p className="ficha-texto">{ficha.ementa}</p>
      {podeEditar ? (
        <Botao
          pequeno
          variante="secundario"
          icone={<Pencil size={14} aria-hidden="true" />}
          onClick={() => setEditando(true)}
        >
          Editar dados
        </Botao>
      ) : null}
    </>
  );
}
