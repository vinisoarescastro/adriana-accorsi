import { formatarReais, paraCentavos, type MesDoSaldo } from '@gabinete/compartilhado';
import { useEffect, useRef, useState } from 'react';
import { nomesDosMeses } from '../rotulos';

const altura = 230;
const margem = { topo: 12, direita: 8, base: 26, esquerda: 44 };

const reais = (texto: string | null) => (paraCentavos(texto ?? '0') ?? 0) / 100;

/** O topo "redondo" do eixo (1, 2, 5 vezes uma potência de dez) e os marcos, no máximo cinco. */
function escalaDoEixo(maximo: number): { topo: number; marcos: number[] } {
  const alvo = Math.max(maximo, 1);
  const potencia = 10 ** Math.floor(Math.log10(alvo));
  for (const passo of [1, 2, 2.5, 5, 10].map((f) => f * potencia)) {
    if (alvo / passo <= 4) {
      const topo = Math.ceil(alvo / passo) * passo;
      return {
        topo,
        marcos: Array.from({ length: Math.round(topo / passo) + 1 }, (_, i) => i * passo),
      };
    }
  }
  return { topo: alvo, marcos: [0, alvo] };
}

const abreviar = (valor: number) =>
  valor === 0
    ? '0'
    : valor >= 1000
      ? `${(valor / 1000).toLocaleString('pt-BR')} mil`
      : String(valor);

/**
 * Cota e consumo de cada mês, lado a lado no mesmo eixo: a cota é a coluna clara (o que havia para gastar) e o
 * consumido, a coluna cheia (o que foi gasto). Passar o mouse numa coluna mostra os valores do mês; a tabela ao
 * lado dá os mesmos números em texto.
 */
export function ColunasMensais({
  meses,
  mesDeReferencia,
}: {
  meses: readonly MesDoSaldo[];
  mesDeReferencia: number;
}) {
  const caixa = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(560);
  const [indice, setIndice] = useState<number | null>(null);

  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const medir = () => setLargura(Math.max(260, Math.round(el.clientWidth)));
    medir();
    if (typeof ResizeObserver === 'undefined') return;
    const observador = new ResizeObserver(medir);
    observador.observe(el);
    return () => observador.disconnect();
  }, []);

  const maximo = Math.max(...meses.map((m) => Math.max(reais(m.cota), reais(m.consumido))));
  const { topo, marcos } = escalaDoEixo(maximo);
  const larguraUtil = largura - margem.esquerda - margem.direita;
  const alturaUtil = altura - margem.topo - margem.base;
  const faixa = larguraUtil / meses.length;
  const barra = Math.max(4, Math.min(18, (faixa - 6) / 2));
  const y = (valor: number) => margem.topo + alturaUtil - (valor / topo) * alturaUtil;
  const ativo = indice === null ? null : meses[indice];

  const resumo = meses
    .map(
      (m) =>
        `${nomesDosMeses[m.mes - 1]}: cota ${m.cota ? formatarReais(m.cota) : 'sem cota'}, consumido ${formatarReais(m.consumido)}`,
    )
    .join('; ');

  return (
    <div className="grafico">
      <ul className="grafico__legenda" aria-label="Legenda: cota e consumo por mês">
        <li>
          <span
            className="grafico__chave"
            style={{ background: 'var(--chart-neutral)', opacity: 0.45 }}
            aria-hidden="true"
          />
          Cota do mês
        </li>
        <li>
          <span
            className="grafico__chave"
            style={{ background: 'var(--chart-1)' }}
            aria-hidden="true"
          />
          Consumido
        </li>
      </ul>
      <div className="grafico__area" ref={caixa}>
        <svg
          width={largura}
          height={altura}
          role="img"
          aria-label={`Cota e consumo por mês. ${resumo}`}
          onPointerLeave={() => setIndice(null)}
        >
          {marcos.map((marco) => (
            <g key={marco}>
              <line
                x1={margem.esquerda}
                x2={largura - margem.direita}
                y1={y(marco)}
                y2={y(marco)}
                stroke="var(--chart-grid)"
                strokeWidth={1}
              />
              <text
                x={margem.esquerda - 6}
                y={y(marco) + 4}
                textAnchor="end"
                className="grafico__eixo"
              >
                {abreviar(marco)}
              </text>
            </g>
          ))}
          {meses.map((m, i) => {
            const centro = margem.esquerda + faixa * i + faixa / 2;
            const cota = reais(m.cota);
            const consumido = reais(m.consumido);
            const futuro = m.mes > mesDeReferencia;
            return (
              <g key={m.mes} opacity={futuro ? 0.55 : 1}>
                {indice === i ? (
                  <rect
                    x={centro - faixa / 2 + 1}
                    y={margem.topo}
                    width={faixa - 2}
                    height={alturaUtil}
                    fill="var(--surface-muted)"
                  />
                ) : null}
                {cota > 0 ? (
                  <rect
                    x={centro - barra - 1}
                    y={y(cota)}
                    width={barra}
                    height={y(0) - y(cota)}
                    rx={3}
                    fill="var(--chart-neutral)"
                    opacity={0.45}
                  />
                ) : null}
                {consumido > 0 ? (
                  <rect
                    x={centro + 1}
                    y={y(consumido)}
                    width={barra}
                    height={y(0) - y(consumido)}
                    rx={3}
                    fill="var(--chart-1)"
                  />
                ) : null}
                <text x={centro} y={altura - 8} textAnchor="middle" className="grafico__eixo">
                  {faixa < 30
                    ? nomesDosMeses[m.mes - 1]!.charAt(0).toUpperCase()
                    : nomesDosMeses[m.mes - 1]!.slice(0, 3)}
                </text>
                <rect
                  x={centro - faixa / 2}
                  y={margem.topo}
                  width={faixa}
                  height={alturaUtil + margem.base}
                  fill="transparent"
                  onPointerEnter={() => setIndice(i)}
                  onPointerMove={() => setIndice(i)}
                />
              </g>
            );
          })}
        </svg>
        {ativo ? (
          <div
            className="grafico__dica"
            role="status"
            style={{
              left: Math.min(
                Math.max(margem.esquerda + faixa * (indice ?? 0) + faixa / 2, 90),
                largura - 90,
              ),
            }}
          >
            <span className="grafico__dica-dia">{nomesDosMeses[ativo.mes - 1]}</span>
            <span>Cota: {ativo.cota ? formatarReais(ativo.cota) : 'sem cota'}</span>
            <span>Consumido: {formatarReais(ativo.consumido)}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
