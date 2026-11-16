import type { DemandaResumo, PaginaDeDemandas, QuadroDeDemandas } from '@gabinete/compartilhado';
import { CalendarClock, FileText } from 'lucide-react';
import { EstadoVazio } from '../componentes/dicas';
import { SeloDeAtraso, SeloDePrioridade, SeloDeStatus } from '../componentes/situacao';
import { Paginacao } from '../componentes/tabela';
import { Selo } from '../componentes/ui';

/** Texto de apoio: a situação nunca depende só de cor. */
function Indicadores({ d }: { d: DemandaResumo }) {
  return (
    <div className="acoes">
      <SeloDeStatus status={d.status} />
      {d.atrasada ? <SeloDeAtraso /> : null}
    </div>
  );
}

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
              <th scope="col">Protocolo</th>
              <th scope="col">Título</th>
              <th scope="col">Solicitante</th>
              <th scope="col">Etapa</th>
              <th scope="col">Situação</th>
              <th scope="col">Prioridade</th>
              <th scope="col">Responsável</th>
              <th scope="col">Prazo</th>
            </tr>
          </thead>
          <tbody>
            {pagina.itens.map((d) => (
              <tr key={d.id}>
                <td>
                  <button type="button" className="link-botao" onClick={() => aoAbrir(d.id)}>
                    {d.protocolo}
                  </button>
                </td>
                <td>{d.titulo}</td>
                <td>{d.solicitante.nome ?? 'Dados eliminados'}</td>
                <td>{d.etapa.nome}</td>
                <td>
                  <Indicadores d={d} />
                </td>
                <td>
                  <SeloDePrioridade prioridade={d.prioridade} />
                </td>
                <td>{d.responsavel.nome}</td>
                <td>{d.prazo ?? '-'}</td>
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
 * Quadro por etapa. Cada cartão leva o título, o protocolo, o solicitante, a prioridade e o prazo:
 * o que precisa para decidir qual abrir. Abrir é um clique; mover continua na ficha.
 */
export function QuadroDasDemandas({
  quadro,
  aoAbrir,
}: {
  quadro: QuadroDeDemandas;
  aoAbrir: (id: number) => void;
}) {
  return (
    <div className="quadro" role="list" aria-label="Quadro de demandas por etapa">
      {quadro.colunas.map((coluna) => (
        <section
          key={coluna.etapa.id}
          className="quadro__coluna"
          role="listitem"
          aria-label={coluna.etapa.nome}
        >
          <header className="quadro__cabeca">
            <span
              className={`quadro__ponto quadro__ponto--${coluna.etapa.papel}`}
              aria-hidden="true"
            />
            <h2 className="quadro__titulo">{coluna.etapa.nome}</h2>
            <Selo>{coluna.total}</Selo>
          </header>
          <div className="quadro__lista">
            {coluna.itens.map((d) => (
              <button
                key={d.id}
                type="button"
                className="quadro__cartao"
                onClick={() => aoAbrir(d.id)}
              >
                <strong className="quadro__cartao-titulo">{d.titulo}</strong>
                <span className="quadro__protocolo">{d.protocolo}</span>
                <span>
                  {d.solicitante.nome ?? 'Dados eliminados'} · {d.responsavel.nome}
                </span>
                <span className="quadro__meta">
                  <SeloDePrioridade prioridade={d.prioridade} />
                  {d.prazo ? (
                    <span
                      className={`quadro__prazo${d.atrasada ? ' quadro__prazo--atrasado' : ''}`}
                    >
                      <CalendarClock size={14} aria-hidden="true" />
                      {d.atrasada ? 'Atrasada · ' : ''}prazo {d.prazo}
                    </span>
                  ) : d.atrasada ? (
                    <SeloDeAtraso />
                  ) : null}
                </span>
              </button>
            ))}
            {coluna.itens.length === 0 ? (
              <div className="quadro__vazio">Nenhuma demanda nesta etapa.</div>
            ) : null}
          </div>
          {coluna.total > coluna.itens.length ? (
            <p className="campo__ajuda">
              Mostrando {coluna.itens.length} de {coluna.total}. Use a lista para ver todas.
            </p>
          ) : null}
        </section>
      ))}
    </div>
  );
}
