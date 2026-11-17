export interface ColunaVertical {
  readonly id: string | number;
  readonly rotulo: string;
  readonly valor: number;
}

/**
 * Colunas verticais de uma só cor, da mesma linha de base, com o valor em cima e o nome embaixo. Mostra as
 * oito maiores. Os números estão em texto, então nada depende da cor.
 */
export function ColunasVerticais({
  rotulo,
  colunas,
  unidade,
  formatar = (n) => String(n),
}: {
  rotulo: string;
  colunas: readonly ColunaVertical[];
  unidade: string;
  formatar?: (valor: number) => string;
}) {
  const visiveis = [...colunas].sort((a, b) => b.valor - a.valor).slice(0, 8);
  const maximo = Math.max(1, ...visiveis.map((c) => c.valor));
  return (
    <ul className="colunas-v" aria-label={rotulo}>
      {visiveis.map((c) => (
        <li
          key={c.id}
          className="colunas-v__item"
          title={`${c.rotulo}: ${formatar(c.valor)} ${unidade}`}
        >
          <span className="colunas-v__valor">{formatar(c.valor)}</span>
          <span className="colunas-v__trilho" aria-hidden="true">
            <span
              className="colunas-v__barra"
              style={{ height: `${c.valor === 0 ? 0 : Math.max(3, (c.valor / maximo) * 100)}%` }}
            />
          </span>
          <span className="colunas-v__rotulo">{c.rotulo}</span>
        </li>
      ))}
    </ul>
  );
}
