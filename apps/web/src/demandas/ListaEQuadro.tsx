import type { DemandaResumo, PaginaDeDemandas, QuadroDeDemandas } from '@gabinete/compartilhado';
import { Botao, Selo } from '../componentes/ui';
import { rotuloDaPrioridade, rotuloDoStatus } from '../rotulos';

/** Texto de apoio: a situação nunca depende só de cor. */
function Indicadores({ d }: { d: DemandaResumo }) {
  return (
    <>
      <Selo tipo={d.status === 'em_andamento' ? 'ativo' : 'inativo'}>
        {rotuloDoStatus[d.status]}
      </Selo>{' '}
      {d.atrasada ? <Selo>Atrasada</Selo> : null}
    </>
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
    <div className="cartao tabela-rolavel">
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
              <td>{rotuloDaPrioridade[d.prioridade]}</td>
              <td>{d.responsavel.nome}</td>
              <td>{d.prazo ?? '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {pagina.itens.length === 0 ? <p>Nenhuma demanda encontrada.</p> : null}
      <div className="acoes" style={{ marginTop: 'var(--espaco-4)' }}>
        <Botao
          variante="secundario"
          onClick={() => aoMudarPagina(pagina.pagina - 1)}
          disabled={pagina.pagina <= 1}
        >
          Anterior
        </Botao>
        <Botao
          variante="secundario"
          onClick={() => aoMudarPagina(pagina.pagina + 1)}
          disabled={pagina.pagina >= totalDePaginas}
        >
          Próxima
        </Botao>
      </div>
    </div>
  );
}

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
          <h2 className="quadro__titulo">
            {coluna.etapa.nome} <Selo>{coluna.total}</Selo>
          </h2>
          {coluna.itens.map((d) => (
            <button
              key={d.id}
              type="button"
              className="quadro__cartao"
              onClick={() => aoAbrir(d.id)}
            >
              <strong>{d.titulo}</strong>
              <span>{d.protocolo}</span>
              <span>
                {d.solicitante.nome ?? 'Dados eliminados'} · {d.responsavel.nome}
              </span>
              <span>
                {rotuloDaPrioridade[d.prioridade]}
                {d.atrasada ? ' · Atrasada' : ''}
                {d.prazo ? ` · prazo ${d.prazo}` : ''}
              </span>
            </button>
          ))}
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
