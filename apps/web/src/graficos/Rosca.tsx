import { useState } from 'react';

export interface FatiaDaRosca {
  readonly id: string | number;
  readonly rotulo: string;
  readonly valor: number;
}

const cores = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)'];
const maximoDeFatias = 4;

/**
 * Rosca: a parte de cada item no total. Mostra as quatro maiores e junta o resto em "Demais" (cinza). O total
 * vai no centro e a legenda ao lado traz o valor e a porcentagem de cada fatia em texto.
 */
export function Rosca({
  rotulo,
  fatias,
  centro,
  formatar = (n) => String(n),
}: {
  rotulo: string;
  fatias: readonly FatiaDaRosca[];
  /** O texto no centro: o total e o que ele é. */
  centro: { readonly valor: string; readonly rotulo: string };
  formatar?: (valor: number) => string;
}) {
  const [ativa, setAtiva] = useState<string | number | null>(null);
  const ordenadas = [...fatias].filter((f) => f.valor > 0).sort((a, b) => b.valor - a.valor);
  const principais = ordenadas.slice(0, maximoDeFatias);
  const resto = ordenadas.slice(maximoDeFatias);
  const demais = resto.reduce((t, f) => t + f.valor, 0);
  const partes = [
    ...principais.map((f, i) => ({ ...f, cor: cores[i] ?? 'var(--chart-neutral)' })),
    ...(demais > 0
      ? [
          {
            id: 'demais',
            rotulo: `Demais (${resto.length})`,
            valor: demais,
            cor: 'var(--chart-neutral)',
          },
        ]
      : []),
  ];
  const total = partes.reduce((t, p) => t + p.valor, 0);
  if (total === 0) return <p className="campo__ajuda">Nada para mostrar ainda.</p>;

  let acumulado = 0;
  return (
    <div className="rosca">
      <div className="rosca__grafico">
        <svg
          viewBox="0 0 42 42"
          role="img"
          aria-label={`${rotulo}: ${centro.valor} ${centro.rotulo}`}
        >
          <circle className="rosca__fundo" cx="21" cy="21" r="15.9155" />
          {partes.map((p) => {
            const fracao = (p.valor / total) * 100;
            const folga = partes.length > 1 ? 0.8 : 0;
            const inicio = acumulado;
            acumulado += fracao;
            return (
              <circle
                key={p.id}
                className="rosca__fatia"
                cx="21"
                cy="21"
                r="15.9155"
                stroke={p.cor}
                strokeDasharray={`${Math.max(0, fracao - folga)} ${100 - Math.max(0, fracao - folga)}`}
                strokeDashoffset={25 - inicio}
                opacity={ativa === null || ativa === p.id ? 1 : 0.35}
              >
                <title>{`${p.rotulo}: ${formatar(p.valor)}`}</title>
              </circle>
            );
          })}
        </svg>
        <div className="rosca__centro" aria-hidden="true">
          <strong>{centro.valor}</strong>
          <span>{centro.rotulo}</span>
        </div>
      </div>
      <ul className="rosca__legenda" aria-label={`Legenda: ${rotulo}`}>
        {partes.map((p) => (
          <li
            key={p.id}
            onPointerEnter={() => setAtiva(p.id)}
            onPointerLeave={() => setAtiva(null)}
          >
            <span className="grafico__chave" style={{ background: p.cor }} aria-hidden="true" />
            <span className="rosca__nome">{p.rotulo}</span>
            <span className="rosca__valor">
              {formatar(p.valor)}{' '}
              <span className="tabela__discreto">{Math.round((p.valor / total) * 100)}%</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
