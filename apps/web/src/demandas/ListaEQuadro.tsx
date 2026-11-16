import type { DemandaResumo, PaginaDeDemandas, QuadroDeDemandas } from '@gabinete/compartilhado';
import { FileText } from 'lucide-react';
import { EstadoVazio } from '../componentes/dicas';
import {
  CelulaDaEtapa,
  CelulaDoItem,
  CelulaDoPrazo,
  CelulaDoResponsavel,
} from '../componentes/lista';
import { Quadro } from '../componentes/quadro';
import { todosOsResponsaveis } from '../componentes/responsaveis';
import { SeloDePrioridade } from '../componentes/situacao';
import { Paginacao } from '../componentes/tabela';
import type { DestinoDaEtapa } from './useMoverDemanda';

const solicitanteDe = (d: DemandaResumo) => d.solicitante.nome ?? 'Dados eliminados';

export function ListaDeDemandas({
  pagina,
  aoAbrir,
  aoMudarPagina,
}: {
  pagina: PaginaDeDemandas;
  aoAbrir: (id: number) => void;
  aoMudarPagina: (p: number) => void;
}) {
  const totalDePaginas = Math.max(1, Math.ceil(pagina.total / pagina.porPagina));
  return (
    <div className="cartao cartao--tabela">
      <div className="tabela-rolavel">
        <table className="tabela">
          <caption>
            {pagina.total} demanda(s), página {pagina.pagina} de {totalDePaginas}
          </caption>
          <thead>
            <tr>
              <th scope="col">Demanda</th>
              <th scope="col">Etapa</th>
              <th scope="col">Prioridade</th>
              <th scope="col">Responsável</th>
              <th scope="col">Prazo</th>
            </tr>
          </thead>
          <tbody>
            {pagina.itens.map((d) => (
              <tr key={d.id}>
                <td>
                  <CelulaDoItem
                    titulo={d.titulo}
                    apoio={[d.protocolo, solicitanteDe(d)]}
                    aoAbrir={() => aoAbrir(d.id)}
                  />
                </td>
                <td>
                  <CelulaDaEtapa nome={d.etapa.nome} papel={d.etapa.papel} status={d.status} />
                </td>
                <td>
                  <SeloDePrioridade prioridade={d.prioridade} />
                </td>
                <td>
                  <CelulaDoResponsavel
                    nomes={todosOsResponsaveis(d.responsavel, d.corresponsaveis).map((r) => r.nome)}
                  />
                </td>
                <td>
                  <CelulaDoPrazo prazo={d.prazo} atrasada={d.atrasada} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pagina.itens.length === 0 ? (
        <EstadoVazio
          icone={<FileText size={24} />}
          titulo="Nenhuma demanda encontrada."
          texto="Ajuste a busca ou os filtros, ou registre uma nova demanda."
        />
      ) : null}
      <Paginacao pagina={pagina.pagina} totalDePaginas={totalDePaginas} aoMudar={aoMudarPagina} />
    </div>
  );
}

/**
 * Quadro por etapa. Cada cartão leva a prioridade, o título, o protocolo e o solicitante, o prazo e o
 * responsável: o que precisa para decidir qual abrir. Abrir é um clique; arrastar (ou o menu "Mover
 * para…") passa a demanda para outra etapa.
 */
export function QuadroDasDemandas({
  quadro,
  aoAbrir,
  podeMover,
  aoMover,
}: {
  quadro: QuadroDeDemandas;
  aoAbrir: (id: number) => void;
  podeMover: (d: DemandaResumo) => boolean;
  aoMover: (d: DemandaResumo, destino: DestinoDaEtapa) => void;
}) {
  return (
    <Quadro
      rotulo="Quadro de demandas por etapa"
      colunas={quadro.colunas.map((c) => ({
        id: c.etapa.id,
        nome: c.etapa.nome,
        papel: c.etapa.papel,
        total: c.total,
        itens: c.itens,
      }))}
      vazio="Nenhuma demanda nesta etapa."
      dados={(d) => ({
        titulo: d.titulo,
        apoio: `${d.protocolo} · ${solicitanteDe(d)}`,
        prioridade: d.prioridade,
        prazo: d.prazo,
        atrasada: d.atrasada,
        responsaveis: todosOsResponsaveis(d.responsavel, d.corresponsaveis).map((r) => r.nome),
      })}
      aoAbrir={aoAbrir}
      podeMover={podeMover}
      aoMover={(d, etapaId) => {
        const etapa = quadro.colunas.find((c) => c.etapa.id === etapaId)?.etapa;
        if (etapa) aoMover(d, { id: etapa.id, nome: etapa.nome, papel: etapa.papel });
      }}
    />
  );
}
