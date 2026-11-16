import type { PaginaDeTarefas, TarefaResumo } from '@gabinete/compartilhado';
import { ListChecks } from 'lucide-react';
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
import type { DestinoDaEtapa } from '../demandas/useMoverDemanda';
import { rotuloDoVinculo } from '../rotulos';

const apoioDaTarefa = (t: TarefaResumo) => (t.vinculo ? rotuloDoVinculo[t.vinculo.tipo] : null);

export function ListaDeTarefas({
  pagina,
  aoAbrir,
  aoMudarPagina,
}: {
  pagina: PaginaDeTarefas;
  aoAbrir: (id: number) => void;
  aoMudarPagina: (p: number) => void;
}) {
  const totalDePaginas = Math.max(1, Math.ceil(pagina.total / pagina.porPagina));
  return (
    <div className="cartao cartao--tabela">
      <div className="tabela-rolavel">
        <table className="tabela">
          <caption>
            {pagina.total} tarefa(s), página {pagina.pagina} de {totalDePaginas}
          </caption>
          <thead>
            <tr>
              <th scope="col">Tarefa</th>
              <th scope="col">Etapa</th>
              <th scope="col">Prioridade</th>
              <th scope="col">Responsável</th>
              <th scope="col">Prazo</th>
            </tr>
          </thead>
          <tbody>
            {pagina.itens.map((t) => (
              <tr key={t.id}>
                <td>
                  <CelulaDoItem
                    titulo={t.titulo}
                    apoio={[apoioDaTarefa(t)]}
                    aoAbrir={() => aoAbrir(t.id)}
                  />
                </td>
                <td>
                  <CelulaDaEtapa nome={t.etapa.nome} papel={t.etapa.papel} status={t.status} />
                </td>
                <td>
                  <SeloDePrioridade prioridade={t.prioridade} />
                </td>
                <td>
                  <CelulaDoResponsavel
                    nomes={todosOsResponsaveis(t.responsavel, t.corresponsaveis).map((r) => r.nome)}
                  />
                </td>
                <td>
                  <CelulaDoPrazo prazo={t.prazo} atrasada={t.atrasada} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pagina.itens.length === 0 ? (
        <EstadoVazio
          icone={<ListChecks size={24} />}
          titulo="Nenhuma tarefa encontrada."
          texto="Ajuste os filtros ou crie uma tarefa nova."
        />
      ) : null}
      <Paginacao pagina={pagina.pagina} totalDePaginas={totalDePaginas} aoMudar={aoMudarPagina} />
    </div>
  );
}

export interface EtapaDoQuadro {
  readonly id: number;
  readonly nome: string;
  readonly papel: string;
  readonly ordem: number;
}

const papeis = ['entrada', 'intermediaria', 'conclusao', 'arquivamento'] as const;
const papelValido = (papel: string) =>
  (papeis as readonly string[]).includes(papel)
    ? (papel as (typeof papeis)[number])
    : 'intermediaria';

/**
 * Quadro de tarefas por etapa. As canceladas ficam de fora (a etapa delas é a de antes de cancelar).
 * `total` é o que o servidor tem com os mesmos filtros; se passar do que veio, o quadro avisa.
 * Arrastar (ou o menu "Mover para…") passa a tarefa para outra etapa.
 */
export function QuadroDeTarefas({
  etapas,
  tarefas,
  total,
  aoAbrir,
  podeMover,
  aoMover,
}: {
  etapas: readonly EtapaDoQuadro[];
  tarefas: readonly TarefaResumo[];
  total: number;
  aoAbrir: (id: number) => void;
  podeMover: (t: TarefaResumo) => boolean;
  aoMover: (t: TarefaResumo, destino: DestinoDaEtapa) => void;
}) {
  const visiveis = tarefas.filter((t) => t.status !== 'cancelada');
  const ordenadas = [...etapas].sort((a, b) => a.ordem - b.ordem);
  return (
    <>
      <Quadro
        rotulo="Quadro de tarefas por etapa"
        colunas={ordenadas.map((e) => {
          const daEtapa = visiveis.filter((t) => t.etapa.id === e.id);
          return {
            id: e.id,
            nome: e.nome,
            papel: papelValido(e.papel),
            total: daEtapa.length,
            itens: daEtapa,
          };
        })}
        vazio="Nenhuma tarefa nesta etapa."
        dados={(t) => ({
          titulo: t.titulo,
          apoio: apoioDaTarefa(t) ?? undefined,
          prioridade: t.prioridade,
          prazo: t.prazo,
          atrasada: t.atrasada,
          responsaveis: todosOsResponsaveis(t.responsavel, t.corresponsaveis).map((r) => r.nome),
        })}
        aoAbrir={aoAbrir}
        podeMover={podeMover}
        aoMover={(t, etapaId) => {
          const e = ordenadas.find((x) => x.id === etapaId);
          if (e) aoMover(t, { id: e.id, nome: e.nome, papel: papelValido(e.papel) });
        }}
      />
      {total > tarefas.length ? (
        <p className="campo__ajuda">
          Mostrando {tarefas.length} de {total} tarefas. Use a lista para ver todas.
        </p>
      ) : null}
    </>
  );
}
