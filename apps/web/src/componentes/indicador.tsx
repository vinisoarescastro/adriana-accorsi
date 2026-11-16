import type { ReactNode } from 'react';
import { Link } from 'react-router';

/**
 * Cartão de indicador, como o `KpiCard` do Design System: o rótulo e o ícone em cima, o número grande
 * embaixo e, se houver, uma linha de apoio. Com `para`, o cartão inteiro leva à lista correspondente.
 */
export function CartaoDeIndicador({
  rotulo,
  valor,
  icone,
  apoio,
  para,
}: {
  rotulo: string;
  valor: number | string;
  icone?: ReactNode;
  apoio?: string;
  para?: string;
}) {
  const conteudo = (
    <>
      <span className="indicador__topo">
        <span className="indicador__rotulo">{rotulo}</span>
        {icone ? (
          <span className="indicador__icone" aria-hidden="true">
            {icone}
          </span>
        ) : null}
      </span>
      <span className="indicador__valor">{valor}</span>
      {apoio ? <span className="indicador__apoio">{apoio}</span> : null}
    </>
  );
  return para ? (
    <Link className="cartao indicador indicador--link" to={para}>
      {conteudo}
    </Link>
  ) : (
    <div className="cartao indicador">{conteudo}</div>
  );
}

/** Grade dos cartões de indicador. */
export function GradeDeIndicadores({ rotulo, children }: { rotulo?: string; children: ReactNode }) {
  return (
    <div className="indicadores" {...(rotulo ? { role: 'group', 'aria-label': rotulo } : {})}>
      {children}
    </div>
  );
}
