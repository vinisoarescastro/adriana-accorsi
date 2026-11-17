import { formatarReais, paraCentavos, type ValoresDaEmenda } from '@gabinete/compartilhado';

const cent = (v: string) => paraCentavos(v) ?? 0;

/**
 * Os cinco valores da emenda: só o disponibilizado é cadastrado, o resto é conta. A barra fina divide o
 * disponibilizado em utilizado, ainda a executar e ainda disponível (com a legenda em texto).
 */
export function ValoresDaEmendaVisao({
  valores,
  compacto,
}: {
  valores: ValoresDaEmenda;
  compacto?: boolean;
}) {
  const total = Math.max(1, cent(valores.disponibilizado));
  const parte = (v: string) => `${(cent(v) / total) * 100}%`;
  return (
    <div className={`valores${compacto ? ' valores--compacto' : ''}`}>
      <div
        className="valores__barra"
        role="img"
        aria-label={`Utilizado ${formatarReais(valores.utilizado)}, a executar ${formatarReais(valores.aExecutar)} e disponível ${formatarReais(valores.disponivel)}, de ${formatarReais(valores.disponibilizado)}.`}
      >
        <span
          className="valores__trecho valores__trecho--utilizado"
          style={{ width: parte(valores.utilizado) }}
        />
        <span
          className="valores__trecho valores__trecho--a-executar"
          style={{ width: parte(valores.aExecutar) }}
        />
        <span
          className="valores__trecho valores__trecho--disponivel"
          style={{ width: parte(valores.disponivel) }}
        />
      </div>
      <dl className="valores__lista">
        <div>
          <dt>Disponibilizado</dt>
          <dd>{formatarReais(valores.disponibilizado)}</dd>
        </div>
        <div>
          <dt>
            <span
              className="grafico__chave"
              style={{ background: 'var(--chart-1)' }}
              aria-hidden="true"
            />{' '}
            Utilizado
          </dt>
          <dd>{formatarReais(valores.utilizado)}</dd>
        </div>
        <div>
          <dt>
            <span
              className="grafico__chave"
              style={{ background: 'var(--chart-2)' }}
              aria-hidden="true"
            />{' '}
            A executar
          </dt>
          <dd>{formatarReais(valores.aExecutar)}</dd>
        </div>
        <div>
          <dt>
            <span
              className="grafico__chave"
              style={{ background: 'var(--chart-neutral)' }}
              aria-hidden="true"
            />{' '}
            Disponível
          </dt>
          <dd>{formatarReais(valores.disponivel)}</dd>
        </div>
        <div>
          <dt>Comprometido</dt>
          <dd>{formatarReais(valores.comprometido)}</dd>
        </div>
      </dl>
    </div>
  );
}
