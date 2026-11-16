import type { ReactNode } from 'react';

/** Cartão: cabeçalho (título, descrição, ações), corpo e rodapé de ações. */
export function Cartao({
  titulo,
  descricao,
  acoes,
  rodape,
  tom,
  children,
  rotulo,
}: {
  titulo?: string;
  descricao?: string;
  acoes?: ReactNode;
  rodape?: ReactNode;
  tom?: 'suave' | 'muted';
  children?: ReactNode;
  rotulo?: string;
}) {
  return (
    <section
      className={`cartao${tom ? ` cartao--${tom}` : ''}`}
      {...(rotulo ? { 'aria-label': rotulo } : {})}
    >
      {titulo || acoes ? (
        <header className="cartao__cabecalho">
          <div>
            {titulo ? <h2 className="cartao__titulo">{titulo}</h2> : null}
            {descricao ? <p className="cartao__descricao">{descricao}</p> : null}
          </div>
          {acoes ? <div className="acoes">{acoes}</div> : null}
        </header>
      ) : null}
      {children ? <div className="cartao__corpo">{children}</div> : null}
      {rodape ? <footer className="cartao__rodape">{rodape}</footer> : null}
    </section>
  );
}
