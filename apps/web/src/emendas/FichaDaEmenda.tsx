import { nivelDoPerfil } from '@gabinete/autorizacao';
import type { RespostaDaSessao } from '@gabinete/compartilhado';
import { Coins, FileText, History, SlidersHorizontal } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useEmenda } from '../api/financeiro';
import { Guias, PainelDaGuia, usePrefixoDeGuias, type ItemDeGuia } from '../componentes/guias';
import { Historico } from '../componentes/historico';
import { Modal } from '../componentes/modal';
import { ResumoDaFicha } from '../componentes/resumo';
import { Aviso, AvisoDeErro, Carregando, Selo } from '../componentes/ui';
import { rotuloDoStatusDaEmenda } from '../rotulos';
import { AcoesDaEmenda } from './AcoesDaEmenda';
import { DadosDaEmenda } from './DadosDaEmenda';
import { DestinacoesDaEmenda } from './DestinacoesDaEmenda';

type Guia = 'detalhes' | 'destinacoes' | 'historico' | 'acoes';

/** Ficha da emenda: valores no alto, e guias para os dados, as destinações com as execuções, o histórico e as ações. */
export function FichaDaEmenda({
  id,
  sessao,
  aoFechar,
}: {
  id: number;
  sessao: RespostaDaSessao;
  aoFechar: () => void;
}) {
  const { data: ficha, isLoading, error } = useEmenda(id);
  const [guia, setGuia] = useState<Guia>('detalhes');
  const prefixo = usePrefixoDeGuias();
  const nivel = nivelDoPerfil[sessao.usuario.perfil];
  const cancelada = ficha?.status === 'cancelada';
  const podeAlterar =
    ficha !== undefined && !cancelada && (nivel >= 3 || ficha.responsavel.id === sessao.usuario.id);

  const guias: ItemDeGuia<Guia>[] = ficha
    ? [
        { id: 'detalhes', rotulo: 'Detalhes', icone: <FileText size={14} aria-hidden="true" /> },
        {
          id: 'destinacoes',
          rotulo: 'Destinações',
          icone: <Coins size={14} aria-hidden="true" />,
          contagem: ficha.destinacoes.filter((d) => !d.cancelada).length,
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
      titulo={ficha ? `${ficha.identificacao} · ${ficha.exercicio}` : 'Emenda'}
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
              {cancelada ? (
                <Selo tom="perigo" ponto>
                  {rotuloDoStatusDaEmenda.cancelada}
                </Selo>
              ) : null}
              <Selo tom="primario" ponto>
                {ficha.etapa.nome}
              </Selo>
              <Selo tom="neutro">{ficha.tipo.nome}</Selo>
              {ficha.atrasada ? (
                <Selo tom="perigo" ponto>
                  Atrasada
                </Selo>
              ) : null}
            </div>
            <ResumoDaFicha
              responsaveis={[ficha.responsavel.nome]}
              prazo={ficha.prazoExecucao}
              atrasada={ficha.atrasada}
            />
            {cancelada ? (
              <Aviso tipo="atencao" titulo="Emenda cancelada. Ela não se altera mais.">
                {ficha.justificativaCancelamento}
              </Aviso>
            ) : null}
          </div>
          <Guias
            rotulo="Seções da emenda"
            prefixo={prefixo}
            valor={guia}
            aoMudar={setGuia}
            itens={guias}
          />
          <div className="ficha-rolagem">
            {painel(
              'detalhes',
              <DadosDaEmenda ficha={ficha} sessao={sessao} podeEditar={podeAlterar} />,
            )}
            {painel('destinacoes', <DestinacoesDaEmenda ficha={ficha} sessao={sessao} />)}
            {painel(
              'historico',
              <Historico movimentacoes={ficha.movimentacoes} inicio="Cadastrada em" />,
            )}
            {painel(
              'acoes',
              <AcoesDaEmenda ficha={ficha} sessao={sessao} key={`${ficha.id}-${ficha.etapa.id}`} />,
            )}
          </div>
        </>
      ) : null}
    </Modal>
  );
}
