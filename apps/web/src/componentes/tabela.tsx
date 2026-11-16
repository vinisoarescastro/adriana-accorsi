import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { Botao } from './ui';

/** Barra acima da tabela: a busca e os filtros no mesmo lugar, em toda lista. */
export function BarraDeFerramentas({
  rotulo,
  aoBuscar,
  children,
  acoes,
}: {
  rotulo: string;
  aoBuscar?: () => void;
  children: ReactNode;
  acoes?: ReactNode;
}) {
  return (
    <form
      className="ferramentas"
      role="search"
      aria-label={rotulo}
      onSubmit={(e) => {
        e.preventDefault();
        aoBuscar?.();
      }}
    >
      <div className="ferramentas__campos">{children}</div>
      {acoes ? <div className="acoes">{acoes}</div> : null}
    </form>
  );
}

/** Paginação: onde se está, para onde ir. Quem consulta a página inteira vê o total pelo cabeçalho da tabela. */
export function Paginacao({
  pagina,
  totalDePaginas,
  aoMudar,
}: {
  pagina: number;
  totalDePaginas: number;
  aoMudar: (pagina: number) => void;
}) {
  return (
    <nav className="paginacao" aria-label="Paginação">
      <span className="paginacao__posicao">
        Página {pagina} de {totalDePaginas}
      </span>
      <div className="acoes">
        <Botao
          variante="secundario"
          pequeno
          icone={<ChevronLeft size={16} aria-hidden="true" />}
          onClick={() => aoMudar(pagina - 1)}
          disabled={pagina <= 1}
        >
          Anterior
        </Botao>
        <Botao
          variante="secundario"
          pequeno
          onClick={() => aoMudar(pagina + 1)}
          disabled={pagina >= totalDePaginas}
        >
          Próxima
          <ChevronRight size={16} aria-hidden="true" />
        </Botao>
      </div>
    </nav>
  );
}

/** Esqueleto de tabela: mostra a forma do conteúdo enquanto ele carrega. */
export function EsqueletoDeTabela({
  linhas = 5,
  colunas = 4,
}: {
  linhas?: number;
  colunas?: number;
}) {
  return (
    <div className="cartao cartao--tabela" role="status" aria-busy="true">
      <span className="somente-leitor">Carregando…</span>
      <div className="tabela-rolavel" aria-hidden="true">
        <table className="tabela">
          <thead>
            <tr>
              {Array.from({ length: colunas }, (_, i) => (
                <th key={i}>
                  <span className="esqueleto esqueleto--curto" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: linhas }, (_, r) => (
              <tr key={r}>
                {Array.from({ length: colunas }, (_, c) => (
                  <td key={c}>
                    <span className={`esqueleto${c === 0 ? '' : ' esqueleto--medio'}`} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Esqueleto de cartões de número, para o painel. */
export function EsqueletoDeCartoes({ quantidade = 4 }: { quantidade?: number }) {
  return (
    <div className="cartoes-do-painel" role="status" aria-busy="true">
      <span className="somente-leitor">Carregando…</span>
      {Array.from({ length: quantidade }, (_, i) => (
        <div key={i} className="cartao-numero" aria-hidden="true">
          <span className="esqueleto esqueleto--valor" />
          <span className="esqueleto esqueleto--medio" />
        </div>
      ))}
    </div>
  );
}
