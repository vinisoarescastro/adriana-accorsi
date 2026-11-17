export interface ParteDaFaixa {
  readonly nome: string;
  readonly valor: number;
  /** Variável de cor do gráfico, por exemplo `var(--chart-2)`. */
  readonly cor: string;
  /** O texto da parte (dinheiro, por exemplo); sem ele, vale o número. */
  readonly texto?: string;
}

export interface LinhaDaFaixa {
  readonly id: string;
  readonly rotulo: string;
  readonly partes: readonly ParteDaFaixa[];
}

/**
 * Uma barra por linha, dividida nas partes de um total (em dia e atrasadas, por exemplo): serve para ver a
 * proporção de uma olhada. Cada parte tem o seu texto, então nada depende da cor, e a legenda vem em cima.
 */
export function FaixaProporcional({
  rotulo,
  linhas,
}: {
  rotulo: string;
  linhas: readonly LinhaDaFaixa[];
}) {
  const legenda = linhas[0]?.partes ?? [];
  return (
    <div className="faixa">
      <ul className="grafico__legenda" aria-label={`Legenda: ${rotulo}`}>
        {legenda.map((p) => (
          <li key={p.nome}>
            <span className="grafico__chave" style={{ background: p.cor }} aria-hidden="true" />
            {p.nome}
          </li>
        ))}
      </ul>
      <ul className="faixa__linhas" aria-label={rotulo}>
        {linhas.map((l) => {
          const total = l.partes.reduce((s, p) => s + p.valor, 0);
          return (
            <li key={l.id} className="faixa__linha">
              <span className="faixa__rotulo">{l.rotulo}</span>
              <span className="faixa__barra" aria-hidden="true">
                {total === 0 ? (
                  <span className="faixa__vazia" />
                ) : (
                  l.partes
                    .filter((p) => p.valor > 0)
                    .map((p) => (
                      <span
                        key={p.nome}
                        className="faixa__parte"
                        style={{ flexGrow: p.valor, background: p.cor }}
                      />
                    ))
                )}
              </span>
              <span className="faixa__texto">
                {l.partes.map((p) => `${p.texto ?? p.valor} ${p.nome.toLowerCase()}`).join(' · ')}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
