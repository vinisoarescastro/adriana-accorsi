import type { EmendaFicha, RespostaDaSessao } from '@gabinete/compartilhado';
import { formatarReais } from '@gabinete/compartilhado';
import { Pencil } from 'lucide-react';
import { useState } from 'react';
import { AvisoDeErro, Botao } from '../componentes/ui';
import { Propriedades } from '../componentes/propriedades';
import { formatarPrazo } from '../componentes/quadro';
import { formatarDataHora } from '../formatos';
import { FormularioDaEmenda, type DadosDoFormularioDaEmenda } from './FormularioDaEmenda';
import { ValoresDaEmendaVisao } from './ValoresDaEmenda';
import { useAcaoDaEmenda } from './useAcaoDaEmenda';

/** Os dados da emenda (e, no fim, o histórico do valor disponibilizado). Quem acompanha edita ali mesmo. */
export function DadosDaEmenda({
  ficha,
  sessao,
  podeEditar,
}: {
  ficha: EmendaFicha;
  sessao: RespostaDaSessao;
  podeEditar: boolean;
}) {
  const [editando, setEditando] = useState(false);
  const acao = useAcaoDaEmenda(ficha.id, 'Dados salvos');

  const salvar = (d: DadosDoFormularioDaEmenda) => {
    const corpo: Record<string, unknown> = {};
    if (d.identificacao !== ficha.identificacao) corpo.identificacao = d.identificacao;
    if (d.exercicio !== ficha.exercicio) corpo.exercicio = d.exercicio;
    if (d.tipoId !== ficha.tipo.id) corpo.tipoId = d.tipoId;
    if (d.finalidade !== ficha.finalidade) corpo.finalidade = d.finalidade;
    if (d.valor !== ficha.valores.disponibilizado) corpo.valor = d.valor;
    if (d.prazoDestinacao !== (ficha.prazoDestinacao ?? ''))
      corpo.prazoDestinacao = d.prazoDestinacao || null;
    if (d.prazoEmpenho !== (ficha.prazoEmpenho ?? '')) corpo.prazoEmpenho = d.prazoEmpenho || null;
    if (d.prazoExecucao !== (ficha.prazoExecucao ?? ''))
      corpo.prazoExecucao = d.prazoExecucao || null;
    if (Object.keys(corpo).length === 0) return setEditando(false);
    acao.mutate({ metodo: 'PATCH', caminho: '', corpo }, { onSuccess: () => setEditando(false) });
  };

  if (editando) {
    return (
      <FormularioDaEmenda
        sessao={sessao}
        emenda={ficha}
        rotuloDeEnviar="Salvar dados"
        enviando={acao.isPending}
        aoEnviar={salvar}
        aoCancelar={() => setEditando(false)}
        erro={<AvisoDeErro erro={acao.error} />}
      />
    );
  }

  const prazo = (v: string | null) => (v ? formatarPrazo(v) : '-');
  return (
    <>
      <ValoresDaEmendaVisao valores={ficha.valores} />
      <Propriedades
        colunas
        itens={[
          { rotulo: 'Tipo', valor: ficha.tipo.nome },
          { rotulo: 'Exercício', valor: String(ficha.exercicio) },
          { rotulo: 'Prazo da destinação', valor: prazo(ficha.prazoDestinacao) },
          { rotulo: 'Prazo do empenho', valor: prazo(ficha.prazoEmpenho) },
          { rotulo: 'Prazo da execução', valor: prazo(ficha.prazoExecucao) },
          {
            rotulo: 'Cadastrada',
            valor: (
              <>
                {ficha.criador}
                <span className="propriedades__apoio">{formatarDataHora(ficha.criadoEm)}</span>
              </>
            ),
          },
        ]}
      />
      <h4 className="ficha-acoes__titulo">Finalidade</h4>
      <p className="ficha-texto">{ficha.finalidade}</p>
      {ficha.historicoDoValor.length > 1 ? (
        <>
          <h4 className="ficha-acoes__titulo">Histórico do valor disponibilizado</h4>
          <ul className="lista-simples">
            {ficha.historicoDoValor.map((h) => (
              <li key={h.em}>
                <strong>{formatarReais(h.valor)}</strong>
                <span className="propriedades__apoio">
                  {h.por}, {formatarDataHora(h.em)}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
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
