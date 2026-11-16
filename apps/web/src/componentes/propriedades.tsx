import type { ReactNode } from 'react';

export interface Propriedade {
  readonly rotulo: string;
  readonly valor: ReactNode;
}

/** Lista de propriedades de uma ficha: o rótulo pequeno em cima e o valor embaixo, sem linhas soltas. */
export function Propriedades({
  itens,
  colunas,
}: {
  itens: readonly (Propriedade | null | false)[];
  /** Em duas colunas quando há espaço (corpo de uma guia). */
  colunas?: boolean;
}) {
  return (
    <dl className={`propriedades${colunas ? ' propriedades--colunas' : ''}`}>
      {itens.map((item) =>
        item ? (
          <div key={item.rotulo} className="propriedades__item">
            <dt>{item.rotulo}</dt>
            <dd>{item.valor}</dd>
          </div>
        ) : null,
      )}
    </dl>
  );
}
