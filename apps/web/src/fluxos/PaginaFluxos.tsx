import { pode } from '@gabinete/autorizacao';
import type { FluxoDeTrabalho, RespostaDaSessao } from '@gabinete/compartilhado';
import { useState } from 'react';
import { useFluxos } from '../api/consultas';
import { Abas } from '../componentes/abas';
import { CabecalhoDaPagina } from '../componentes/cabecalho';
import { EsqueletoDeTabela } from '../componentes/tabela';
import { Aviso, AvisoDeErro, Selo } from '../componentes/ui';
import { rotuloDoFluxo, rotuloDoPapel } from '../rotulos';
import { LinhaDaEtapa } from './LinhaDaEtapa';
import { NovaEtapa } from './NovaEtapa';

const ondeAparece: Record<FluxoDeTrabalho['tipo'], string> = {
  demanda: 'Colunas do quadro de Demandas e andamento mostrado ao cidadão',
  tarefa: 'Colunas do quadro de Tarefas',
  projeto_lei: 'Colunas do quadro de Projetos de lei',
  emenda: 'Colunas do quadro de Emendas (e das destinações)',
  despesa_ceap: 'Etapas da despesa da CEAP, que decidem se ela consome o saldo',
};

/** O caminho do fluxo de uma olhada: as etapas na ordem, com o papel de cada uma. */
function Trilho({ fluxo }: { fluxo: FluxoDeTrabalho }) {
  return (
    <ol className="fluxo-trilho" aria-label={`Caminho do fluxo de ${rotuloDoFluxo[fluxo.tipo]}`}>
      {fluxo.etapas.map((e) => (
        <li
          key={e.id}
          className={`fluxo-trilho__etapa fluxo-trilho__etapa--${e.papel}${e.situacao === 'inativa' ? ' fluxo-trilho__etapa--inativa' : ''}`}
        >
          <span className="fluxo-trilho__nome">{e.nomeInterno}</span>
          <span className="fluxo-trilho__papel">
            {rotuloDoPapel[e.papel]}
            {e.situacao === 'inativa' ? ' · inativa' : ''}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function PaginaFluxos({ sessao }: { sessao: RespostaDaSessao }) {
  const { data: fluxos, isLoading, error } = useFluxos();
  const [escolhido, setEscolhido] = useState<FluxoDeTrabalho['tipo']>('demanda');
  const autoridade = { perfil: sessao.usuario.perfil, habilitacoes: sessao.usuario.habilitacoes };
  const ajusta = pode('fluxos.ajustar', autoridade);
  const estrutura = pode('fluxos.estruturar', autoridade);
  const fluxo = fluxos?.find((f) => f.tipo === escolhido) ?? fluxos?.[0];
  const ativas = fluxo?.etapas.filter((e) => e.situacao === 'ativa').length ?? 0;

  return (
    <section>
      <CabecalhoDaPagina
        titulo="Fluxos de trabalho"
        descricao="As etapas de cada processo: são as colunas dos quadros e decidem o status de cada registro."
      />
      <AvisoDeErro erro={error} />
      {isLoading ? <EsqueletoDeTabela colunas={6} /> : null}
      {fluxos ? (
        <div className="ceap-barra">
          <Abas
            segmentada
            rotulo="Fluxos"
            valor={fluxo?.tipo ?? escolhido}
            aoMudar={setEscolhido}
            itens={fluxos.map((f) => ({ id: f.tipo, rotulo: rotuloDoFluxo[f.tipo] }))}
          />
        </div>
      ) : null}

      {fluxo ? (
        <div className="painel">
          <div className="cartao">
            <div className="fluxo-resumo">
              <div>
                <h2 className="cartao__titulo">{rotuloDoFluxo[fluxo.tipo]}</h2>
                <p className="campo__ajuda">{ondeAparece[fluxo.tipo]}</p>
              </div>
              <Selo tom="neutro">
                {ativas} {ativas === 1 ? 'etapa ativa' : 'etapas ativas'}
              </Selo>
            </div>
            <Trilho fluxo={fluxo} />
          </div>

          <div className="cartao cartao--tabela">
            <div className="tabela-rolavel">
              <table className="tabela tabela--fluxo">
                <caption>Etapas de {rotuloDoFluxo[fluxo.tipo]}</caption>
                <thead>
                  <tr>
                    <th scope="col">Ordem</th>
                    <th scope="col">Etapa</th>
                    <th scope="col">Papel</th>
                    {fluxo.tipo === 'demanda' ? (
                      <>
                        <th scope="col">Rótulo ao cidadão</th>
                        <th scope="col">Visível</th>
                      </>
                    ) : null}
                    <th scope="col">Prazo padrão</th>
                    <th scope="col">Situação</th>
                    {ajusta || estrutura ? <th scope="col">Ações</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {fluxo.etapas.map((etapa) => (
                    <LinhaDaEtapa
                      key={etapa.id}
                      etapa={etapa}
                      fluxo={fluxo}
                      ajusta={ajusta}
                      estrutura={estrutura}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {estrutura ? (
            <div className="cartao">
              <h2 className="cartao__titulo">Adicionar etapa</h2>
              <NovaEtapa fluxo={fluxo} />
            </div>
          ) : null}

          <Aviso tipo="info" titulo="Como as etapas funcionam">
            O status de um registro vem do papel da etapa em que ele está: Entrada (em andamento),
            Intermediária (em andamento), Conclusão (concluído) e Arquivamento (arquivado). Entrada
            e Arquivamento são únicas em cada fluxo e não se desativam; etapa já usada em registros
            também não. A ordem só muda a apresentação.
          </Aviso>
        </div>
      ) : null}
    </section>
  );
}
