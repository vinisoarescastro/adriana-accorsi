import { Link } from 'react-router';

export interface LinhaDeBarra {
  readonly id: string | number;
  readonly rotulo: string;
  readonly valor: number;
  /** O que se escreve na ponta, no lugar do número (dinheiro, por exemplo). */
  readonly texto?: string;
  /** Aonde o clique leva (a lista filtrada, por exemplo). */
  readonly para?: string;
}

/**
 * Barras horizontais de uma só cor, da mesma linha de base, com o valor na ponta: servem para comparar
 * grandezas (demandas por etapa, projetos por etapa). A barra é fina e arredondada só na ponta dos dados;
 * os números ficam em texto, então nada depende da cor.
 */
export function BarrasHorizontais({
  rotulo,
  linhas,
  unidade,
  largo,
}: {
  rotulo: string;
  linhas: readonly LinhaDeBarra[];
  /** "demandas", "projetos": entra na dica ao passar o mouse e na leitura de tela. */
  unidade: string;
  /** Coluna do valor mais larga, para textos como "R$ 12.345,67 · 18%". */
  largo?: boolean;
}) {
  const maximo = Math.max(1, ...linhas.map((l) => l.valor));
  return (
    <ul className={`barras${largo ? ' barras--largo' : ''}`} aria-label={rotulo}>
      {linhas.map((l) => {
        const largura = l.valor === 0 ? 0 : Math.max(2, (l.valor / maximo) * 100);
        const dica = `${l.rotulo}: ${l.texto ?? l.valor} ${unidade}`;
        const conteudo = (
          <>
            <span className="barras__rotulo">{l.rotulo}</span>
            <span className="barras__trilho" aria-hidden="true">
              <span className="barras__barra" style={{ width: `${largura}%` }} />
            </span>
            <span className="barras__valor">
              {l.texto ?? l.valor}
              <span className="somente-leitor"> {unidade}</span>
            </span>
          </>
        );
        return (
          <li key={l.id} title={dica}>
            {l.para ? (
              <Link className="barras__linha" to={l.para}>
                {conteudo}
              </Link>
            ) : (
              <div className="barras__linha">{conteudo}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
