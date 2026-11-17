import { nivelDoPerfil } from '@gabinete/autorizacao';
import type { RespostaDaSessao } from '@gabinete/compartilhado';
import { FileText, GitCompareArrows, History, SlidersHorizontal } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useProjeto } from '../api/legislativo';
import { Guias, PainelDaGuia, usePrefixoDeGuias, type ItemDeGuia } from '../componentes/guias';
import { Historico } from '../componentes/historico';
import { Modal } from '../componentes/modal';
import { ResumoDaFicha } from '../componentes/resumo';
import { SeloDeAtraso } from '../componentes/situacao';
import { Aviso, AvisoDeErro, Carregando, Selo } from '../componentes/ui';
import { rotuloDoStatusDoProjeto } from '../rotulos';
import { AcoesDoProjeto } from './AcoesDoProjeto';
import { DadosDoProjeto } from './DadosDoProjeto';
import { TramitacaoDoProjeto } from './TramitacaoDoProjeto';

type Guia = 'detalhes' | 'tramitacao' | 'historico' | 'acoes';

/**
 * Ficha do projeto de lei: no topo, o que importa de relance (etapa, atraso, responsável, prazo);
 * embaixo, guias para os detalhes, a tramitação (comissões e votações), o histórico e as ações.
 */
export function FichaDoProjeto({
  id,
  sessao,
  aoFechar,
}: {
  id: number;
  sessao: RespostaDaSessao;
  aoFechar: () => void;
}) {
  const { data: ficha, isLoading, error } = useProjeto(id);
  const [guia, setGuia] = useState<Guia>('detalhes');
  const prefixo = usePrefixoDeGuias();

  const nivel = nivelDoPerfil[sessao.usuario.perfil];
  const cancelado = ficha?.status === 'cancelado';
  // O responsável, o Supervisor ou superior alteram; o projeto cancelado não se altera.
  const podeAlterar =
    ficha !== undefined && !cancelado && (nivel >= 3 || ficha.responsavel.id === sessao.usuario.id);

  const guias: ItemDeGuia<Guia>[] = ficha
    ? [
        { id: 'detalhes', rotulo: 'Detalhes', icone: <FileText size={14} aria-hidden="true" /> },
        {
          id: 'tramitacao',
          rotulo: 'Tramitação',
          icone: <GitCompareArrows size={14} aria-hidden="true" />,
          contagem: ficha.tramitacoes.length + ficha.votacoes.length,
        },
        {
          id: 'historico',
          rotulo: 'Histórico',
          icone: <History size={14} aria-hidden="true" />,
          contagem: ficha.movimentacoes.length,
        },
        ...(podeAlterar
          ? ([
              {
                id: 'acoes',
                rotulo: 'Ações',
                icone: <SlidersHorizontal size={14} aria-hidden="true" />,
              },
            ] as ItemDeGuia<Guia>[])
          : []),
      ]
    : [];
  const painel = (g: Guia, conteudo: ReactNode) =>
    guias.some((x) => x.id === g) ? (
      <PainelDaGuia id={g} prefixo={prefixo} ativa={guia === g}>
        {conteudo}
      </PainelDaGuia>
    ) : null;

  return (
    <Modal
      titulo={ficha ? ficha.titulo : 'Projeto de lei'}
      tamanho="xl"
      classe="modal--ficha"
      aoFechar={aoFechar}
    >
      {isLoading || error ? (
        <div className="ficha-topo">
          {isLoading ? <Carregando /> : null}
          <AvisoDeErro erro={error} />
        </div>
      ) : null}

      {ficha ? (
        <>
          <div className="ficha-topo">
            <div className="ficha-selos">
              {cancelado ? (
                <Selo tom="perigo" ponto>
                  {rotuloDoStatusDoProjeto.cancelado}
                </Selo>
              ) : null}
              <Selo tom="primario" ponto>
                {ficha.etapa.nome}
              </Selo>
              {ficha.numero ? <Selo tom="neutro">{ficha.numero}</Selo> : null}
              {ficha.atrasado ? <SeloDeAtraso /> : null}
            </div>
            <ResumoDaFicha
              responsaveis={[ficha.responsavel.nome]}
              prazo={ficha.prazo}
              atrasada={ficha.atrasado}
            />
            {cancelado ? (
              <Aviso tipo="atencao" titulo="Projeto cancelado. Ele não se altera mais.">
                {ficha.justificativaCancelamento}
              </Aviso>
            ) : null}
          </div>

          <Guias
            rotulo="Seções do projeto"
            prefixo={prefixo}
            valor={guia}
            aoMudar={setGuia}
            itens={guias}
          />

          <div className="ficha-rolagem">
            {painel(
              'detalhes',
              <DadosDoProjeto ficha={ficha} sessao={sessao} podeEditar={podeAlterar} />,
            )}
            {painel('tramitacao', <TramitacaoDoProjeto ficha={ficha} podeAlterar={podeAlterar} />)}
            {painel(
              'historico',
              <Historico movimentacoes={ficha.movimentacoes} inicio="Cadastrado em" />,
            )}
            {painel(
              'acoes',
              <AcoesDoProjeto
                ficha={ficha}
                sessao={sessao}
                key={`${ficha.id}-${ficha.etapa.id}`}
              />,
            )}
          </div>
        </>
      ) : null}
    </Modal>
  );
}
