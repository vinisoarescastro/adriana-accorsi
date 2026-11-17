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
  alerta,
}: {
  rotulo: string;
  valor: number | string;
  icone?: ReactNode;
  apoio?: string;
  para?: string;
  /** Realça o número (em vermelho, e com a palavra no apoio): algo pede atenção. */
  alerta?: boolean;
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
      <span className={`indicador__valor${alerta ? ' indicador__valor--alerta' : ''}`}>
        {valor}
      </span>
      {apoio ? <span className="indicador__apoio">{apoio}</span> : null}
    </>
  );
  return para ? (
    <Link
      className={`cartao indicador indicador--link${alerta ? ' indicador--alerta' : ''}`}
      to={para}
    >
      {conteudo}
    </Link>
  ) : (
    <div className={`cartao indicador${alerta ? ' indicador--alerta' : ''}`}>{conteudo}</div>
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
