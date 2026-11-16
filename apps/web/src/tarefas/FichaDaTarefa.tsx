import { nivelDoPerfil } from '@gabinete/autorizacao';
import type { RespostaDaSessao } from '@gabinete/compartilhado';
import { FileText, History, SlidersHorizontal } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { chavesDoTrabalho, useTarefa } from '../api/trabalho';
import { DadosEditaveis } from '../componentes/dados-editaveis';
import { DescricaoEditavel } from '../componentes/descricao-editavel';
import { Guias, PainelDaGuia, usePrefixoDeGuias, type ItemDeGuia } from '../componentes/guias';
import { Historico } from '../componentes/historico';
import { Modal } from '../componentes/modal';
import { respondePeloItem, todosOsResponsaveis } from '../componentes/responsaveis';
import { ResumoDaFicha } from '../componentes/resumo';
import { SeloDeAtraso, SeloDePrioridade, SeloDeStatus } from '../componentes/situacao';
import { Aviso, AvisoDeErro, Carregando, Selo } from '../componentes/ui';
import { formatarDataHora } from '../formatos';
import { AcoesDaTarefa } from './AcoesDaTarefa';

type Guia = 'detalhes' | 'historico' | 'acoes';

/**
 * Ficha da tarefa: no topo, o que importa de relance (etapa, prioridade, atraso, responsável, prazo);
 * embaixo, guias para os detalhes, o histórico e as ações. O Assessor Externo só abre as dele (a API
 * responde "não encontrada").
 */
export function FichaDaTarefa({
  id,
  sessao,
  aoFechar,
}: {
  id: number;
  sessao: RespostaDaSessao;
  aoFechar: () => void;
}) {
  const { data: ficha, isLoading, error } = useTarefa(id);
  const [guia, setGuia] = useState<Guia>('detalhes');
  const prefixo = usePrefixoDeGuias();

  const nivel = nivelDoPerfil[sessao.usuario.perfil];
  const podeEditar =
    ficha !== undefined &&
    ficha.status !== 'cancelada' &&
    (nivel >= 3 || respondePeloItem(ficha, sessao.usuario.id));
  // As mesmas condições de AcoesDaTarefa: cancelada não age; senão, só quem altera (mover e cancelar).
  const temAcoes = podeEditar;
  const guias: ItemDeGuia<Guia>[] = ficha
    ? [
        { id: 'detalhes', rotulo: 'Detalhes', icone: <FileText size={14} aria-hidden="true" /> },
        {
          id: 'historico',
          rotulo: 'Histórico',
          icone: <History size={14} aria-hidden="true" />,
          contagem: ficha.movimentacoes.length,
        },
        ...(temAcoes
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
      titulo={ficha ? ficha.titulo : 'Tarefa'}
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
              {ficha.status === 'cancelada' ? <SeloDeStatus status={ficha.status} /> : null}
              <Selo tom="primario" ponto>
                {ficha.etapa.nome}
              </Selo>
              <SeloDePrioridade prioridade={ficha.prioridade} />
              {ficha.atrasada ? <SeloDeAtraso /> : null}
            </div>
            <ResumoDaFicha
              responsaveis={todosOsResponsaveis(ficha.responsavel, ficha.corresponsaveis).map(
                (r) => r.nome,
              )}
              prazo={ficha.prazo}
              atrasada={ficha.atrasada}
            />
            {ficha.status === 'cancelada' ? (
              <Aviso tipo="atencao" titulo="Tarefa cancelada. Ela não se altera mais.">
                {ficha.justificativaCancelamento}
              </Aviso>
            ) : null}
          </div>

          <Guias
            rotulo="Seções da tarefa"
            prefixo={prefixo}
            valor={guia}
            aoMudar={setGuia}
            itens={guias}
          />

          <div className="ficha-rolagem">
            {painel(
              'detalhes',
              <>
                <DadosEditaveis
                  caminho={`/api/tarefas/${ficha.id}`}
                  chaveDaFicha={chavesDoTrabalho.tarefa(ficha.id)}
                  chavesParaAtualizar={chavesDoTrabalho.tudo}
                  item={ficha}
                  podeEditar={podeEditar}
                  podeTrocarResponsaveis={nivel >= 2}
                  extras={[
                    {
                      rotulo: 'Criada',
                      valor: (
                        <>
                          {ficha.criador}
                          <span className="propriedades__apoio">
                            {formatarDataHora(ficha.criadoEm)}
                          </span>
                        </>
                      ),
                    },
                    ficha.vinculo?.tipo === 'demanda' && {
                      rotulo: 'Demanda ligada',
                      valor: (
                        <Link to={`/g/demandas?demanda=${ficha.vinculo.id}`}>
                          Abrir a demanda {ficha.vinculo.id}
                        </Link>
                      ),
                    },
                  ]}
                />
                <DescricaoEditavel
                  sessao={sessao}
                  caminho={`/api/tarefas/${ficha.id}`}
                  chaveDaFicha={chavesDoTrabalho.tarefa(ficha.id)}
                  chavesParaAtualizar={chavesDoTrabalho.tudo}
                  texto={ficha.descricao}
                  podeEditar={podeEditar}
                />
              </>,
            )}
            {painel(
              'historico',
              <Historico movimentacoes={ficha.movimentacoes} inicio="Criada em" />,
            )}
            {painel(
              'acoes',
              <AcoesDaTarefa ficha={ficha} sessao={sessao} key={`${ficha.id}-${ficha.etapa.id}`} />,
            )}
          </div>
        </>
      ) : null}
    </Modal>
  );
}
