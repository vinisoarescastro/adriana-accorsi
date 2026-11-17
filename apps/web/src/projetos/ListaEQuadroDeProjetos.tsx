import type { PaginaDeProjetos, ProjetoResumo } from '@gabinete/compartilhado';
import { Landmark } from 'lucide-react';
import { EstadoVazio } from '../componentes/dicas';
import { CelulaDoItem, CelulaDoPrazo, CelulaDoResponsavel } from '../componentes/lista';
import { Quadro } from '../componentes/quadro';
import { Paginacao } from '../componentes/tabela';
import { Selo } from '../componentes/ui';
import type { DestinoDaEtapa } from '../demandas/useMoverDemanda';
import { rotuloDoStatusDoProjeto } from '../rotulos';

/** O apoio de uma linha ou cartão: o número do projeto e o tipo de proposição. */
export const apoioDoProjeto = (p: ProjetoResumo): string =>
  [p.numero, p.tipoProposicao.nome].filter(Boolean).join(' · ');

/** A etapa em texto, com o ponto do papel; só a situação que a etapa não diz (cancelado) vira selo. */
export function CelulaDaEtapaDoProjeto({ projeto }: { projeto: ProjetoResumo }) {
  return projeto.status === 'cancelado' ? (
    <Selo tom="perigo" ponto>
      {rotuloDoStatusDoProjeto.cancelado}
    </Selo>
  ) : (
    <span className="celula-etapa">
      <span className={`quadro__ponto quadro__ponto--${projeto.etapa.papel}`} aria-hidden="true" />
      {projeto.etapa.nome}
    </span>
  );
}

export function ListaDeProjetos({
  pagina,
  aoAbrir,
  aoMudarPagina,
}: {
  pagina: PaginaDeProjetos;
  aoAbrir: (id: number) => void;
  aoMudarPagina: (p: number) => void;
}) {
  const totalDePaginas = Math.max(1, Math.ceil(pagina.total / pagina.porPagina));
  return (
    <div className="cartao cartao--tabela">
      <div className="tabela-rolavel">
        <table className="tabela">
          <caption>
            {pagina.total} projeto(s), página {pagina.pagina} de {totalDePaginas}
          </caption>
          <thead>
            <tr>
              <th scope="col">Projeto</th>
              <th scope="col">Etapa</th>
              <th scope="col">Autoria</th>
              <th scope="col">Responsável</th>
              <th scope="col">Prazo</th>
            </tr>
          </thead>
          <tbody>
            {pagina.itens.map((p) => (
              <tr key={p.id}>
                <td>
                  <CelulaDoItem
                    titulo={p.titulo}
                    apoio={[apoioDoProjeto(p)]}
                    aoAbrir={() => aoAbrir(p.id)}
                  />
                </td>
                <td>
                  <CelulaDaEtapaDoProjeto projeto={p} />
                </td>
                <td>{p.autoria}</td>
                <td>
                  <CelulaDoResponsavel nomes={[p.responsavel.nome]} />
                </td>
                <td>
                  <CelulaDoPrazo prazo={p.prazo} atrasada={p.atrasado} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pagina.itens.length === 0 ? (
        <EstadoVazio
          icone={<Landmark size={24} />}
          titulo="Nenhum projeto encontrado."
          texto="Ajuste os filtros ou cadastre um projeto de lei."
        />
      ) : null}
      <Paginacao pagina={pagina.pagina} totalDePaginas={totalDePaginas} aoMudar={aoMudarPagina} />
    </div>
  );
}

export interface EtapaDoQuadroDeProjetos {
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
 * Quadro dos projetos por etapa do fluxo federal. Os cancelados ficam de fora (a etapa deles é a de
 * antes de cancelar). Arrastar (ou o menu "Mover para…") passa o projeto para outra etapa.
 */
export function QuadroDeProjetos({
  etapas,
  projetos,
  total,
  aoAbrir,
  podeMover,
  aoMover,
}: {
  etapas: readonly EtapaDoQuadroDeProjetos[];
  projetos: readonly ProjetoResumo[];
  total: number;
  aoAbrir: (id: number) => void;
  podeMover: (p: ProjetoResumo) => boolean;
  aoMover: (p: ProjetoResumo, destino: DestinoDaEtapa) => void;
}) {
  const visiveis = projetos.filter((p) => p.status !== 'cancelado');
  const ordenadas = [...etapas].sort((a, b) => a.ordem - b.ordem);
  return (
    <>
      <Quadro
        rotulo="Quadro de projetos de lei por etapa"
        colunas={ordenadas.map((e) => {
          const daEtapa = visiveis.filter((p) => p.etapa.id === e.id);
          return {
            id: e.id,
            nome: e.nome,
            papel: papelValido(e.papel),
            total: daEtapa.length,
            itens: daEtapa,
          };
        })}
        vazio="Nenhum projeto nesta etapa."
        dados={(p) => ({
          titulo: p.titulo,
          apoio: apoioDoProjeto(p) || undefined,
          prazo: p.prazo,
          atrasada: p.atrasado,
          responsaveis: [p.responsavel.nome],
        })}
        aoAbrir={aoAbrir}
        podeMover={podeMover}
        aoMover={(p, etapaId) => {
          const e = ordenadas.find((x) => x.id === etapaId);
          if (e) aoMover(p, { id: e.id, nome: e.nome, papel: papelValido(e.papel) });
        }}
      />
      {total > projetos.length ? (
        <p className="campo__ajuda">
          Mostrando {projetos.length} de {total} projetos. Use a lista para ver todos.
        </p>
      ) : null}
    </>
  );
}
