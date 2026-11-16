import type { ReactNode } from 'react';

/** Cabeçalho de página: título, descrição e as ações principais, sempre no mesmo lugar. */
export function CabecalhoDaPagina({
  titulo,
  descricao,
  acoes,
}: {
  titulo: string;
  descricao?: string;
  acoes?: ReactNode;
}) {
  return (
    <header className="cabecalho-da-pagina">
      <div className="cabecalho-da-pagina__texto">
        <h1>{titulo}</h1>
        {descricao ? <p className="cabecalho-da-pagina__descricao">{descricao}</p> : null}
      </div>
      {acoes ? <div className="acoes">{acoes}</div> : null}
    </header>
  );
}
