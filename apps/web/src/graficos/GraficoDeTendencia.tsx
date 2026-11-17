import type { PontoDaTendencia } from '@gabinete/compartilhado';
import { Table2 } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { Botao } from '../componentes/ui';

const altura = 220;
const margem = { topo: 14, direita: 12, base: 26, esquerda: 30 };

/** Dia AAAA-MM-DD em dia/mês. */
const diaMes = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;

/** O maior valor "redondo" do eixo e os marcos: 0, 1, 2, 5, 10… Nunca mais de 5 marcos. */
function escalaDoEixo(maximo: number): { topo: number; marcos: number[] } {
  const alvo = Math.max(maximo, 1);
  for (const base of [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000]) {
    if (alvo / base <= 4) {
      const topo = Math.ceil(alvo / base) * base;
      return { topo, marcos: Array.from({ length: topo / base + 1 }, (_, i) => i * base) };
    }
  }
  return { topo: alvo, marcos: [0, alvo] };
}

interface Serie {
  readonly chave: 'recebidas' | 'concluidas';
  readonly nome: string;
  readonly cor: string;
}

const series: readonly Serie[] = [
  { chave: 'recebidas', nome: 'Recebidas', cor: 'var(--chart-1)' },
  { chave: 'concluidas', nome: 'Concluídas', cor: 'var(--chart-2)' },
];

/**
 * Tendência diária de duas séries (recebidas e concluídas) em um só eixo. Linhas de 2 px, marcadores com
 * anel da cor da superfície, grade em fio. Passar o mouse (ou usar as setas, com o gráfico em foco) mostra
 * o dia com os dois valores; o botão "Ver como tabela" dá os mesmos números em texto.
 */
export function GraficoDeTendencia({ pontos }: { pontos: readonly PontoDaTendencia[] }) {
  const caixa = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(640);
  const [indice, setIndice] = useState<number | null>(null);
  const [tabela, setTabela] = useState(false);

  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const medir = () => setLargura(Math.max(240, Math.round(el.clientWidth)));
    medir();
    if (typeof ResizeObserver === 'undefined') return;
    const observador = new ResizeObserver(medir);
    observador.observe(el);
    return () => observador.disconnect();
  }, []);

  const maximo = Math.max(0, ...pontos.flatMap((p) => [p.recebidas, p.concluidas]));
  const { topo, marcos } = escalaDoEixo(maximo);
  const area = {
    x0: margem.esquerda,
    x1: largura - margem.direita,
    y0: margem.topo,
    y1: altura - margem.base,
  };
  const x = (i: number) =>
    pontos.length <= 1 ? area.x0 : area.x0 + (i * (area.x1 - area.x0)) / (pontos.length - 1);
  const y = (v: number) => area.y1 - (v / topo) * (area.y1 - area.y0);
  const caminho = (chave: Serie['chave']) =>
    pontos
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p[chave]).toFixed(1)}`)
      .join(' ');

  const totalDe = (chave: Serie['chave']) => pontos.reduce((s, p) => s + p[chave], 0);
  const resumo = `Recebidas e concluídas por dia, de ${diaMes(pontos[0]?.dia ?? '')} a ${diaMes(
    pontos[pontos.length - 1]?.dia ?? '',
  )}: ${totalDe('recebidas')} recebidas e ${totalDe('concluidas')} concluídas.`;

  const noIndice = (clientX: number) => {
    const caixaDoSvg = caixa.current?.getBoundingClientRect();
    if (!caixaDoSvg || pontos.length === 0) return null;
    const relativo = clientX - caixaDoSvg.left;
    const passo = (area.x1 - area.x0) / Math.max(1, pontos.length - 1);
    return Math.min(pontos.length - 1, Math.max(0, Math.round((relativo - area.x0) / passo)));
  };
  const aoMover = (e: PointerEvent<HTMLDivElement>) => setIndice(noIndice(e.clientX));
  const aoTeclar = (e: KeyboardEvent<HTMLDivElement>) => {
    const ultimo = pontos.length - 1;
    const atual = indice ?? ultimo;
    const novo =
      e.key === 'ArrowLeft'
        ? Math.max(0, atual - 1)
        : e.key === 'ArrowRight'
          ? Math.min(ultimo, atual + 1)
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? ultimo
              : null;
    if (novo === null) return;
    e.preventDefault();
    setIndice(novo);
  };

  const marcosDoX = [
    0,
    Math.floor((pontos.length - 1) / 3),
    Math.floor(((pontos.length - 1) * 2) / 3),
    pontos.length - 1,
  ].filter((v, i, todos) => pontos.length > 0 && todos.indexOf(v) === i);
  const ativo = indice !== null ? pontos[indice] : undefined;

  return (
    <div className="grafico">
      <div className="grafico__topo">
        <ul className="grafico__legenda" aria-label="Legenda">
          {series.map((s) => (
            <li key={s.chave}>
              <span className="grafico__chave" style={{ background: s.cor }} aria-hidden="true" />
              {s.nome}
              <strong>{totalDe(s.chave)}</strong>
            </li>
          ))}
        </ul>
        <Botao
          variante="fantasma"
          pequeno
          icone={<Table2 size={14} aria-hidden="true" />}
          aria-pressed={tabela}
          onClick={() => setTabela((v) => !v)}
        >
          {tabela ? 'Ver o gráfico' : 'Ver como tabela'}
        </Botao>
      </div>

      {tabela ? (
        <div className="grafico__tabela tabela-rolavel">
          <table className="tabela">
            <caption className="somente-leitor">{resumo}</caption>
            <thead>
              <tr>
                <th scope="col">Dia</th>
                <th scope="col" className="e-numero">
                  Recebidas
                </th>
                <th scope="col" className="e-numero">
                  Concluídas
                </th>
              </tr>
            </thead>
            <tbody>
              {[...pontos].reverse().map((p) => (
                <tr key={p.dia}>
                  <td>{diaMes(p.dia)}</td>
                  <td className="e-numero">{p.recebidas}</td>
                  <td className="e-numero">{p.concluidas}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div
          ref={caixa}
          className="grafico__area"
          // Em foco, as setas percorrem os dias; o resumo e a tabela dão os mesmos números sem mouse.
          tabIndex={0}
          role="group"
          aria-label={`${resumo} Use as setas para percorrer os dias.`}
          onPointerMove={aoMover}
          onPointerLeave={() => setIndice(null)}
          onKeyDown={aoTeclar}
          onBlur={() => setIndice(null)}
        >
          <svg width={largura} height={altura} role="presentation" aria-hidden="true">
            {marcos.map((m) => (
              <g key={m}>
                <line x1={area.x0} x2={area.x1} y1={y(m)} y2={y(m)} className="grafico__grade" />
                <text x={area.x0 - 8} y={y(m) + 4} textAnchor="end" className="grafico__eixo">
                  {m}
                </text>
              </g>
            ))}
            {marcosDoX.map((i) => (
              <text
                key={i}
                x={x(i)}
                y={altura - 6}
                textAnchor={i === 0 ? 'start' : i === pontos.length - 1 ? 'end' : 'middle'}
                className="grafico__eixo"
              >
                {diaMes(pontos[i]?.dia ?? '')}
              </text>
            ))}
            {series.map((s) => (
              <path
                key={s.chave}
                d={caminho(s.chave)}
                className="grafico__linha"
                style={{ stroke: s.cor }}
              />
            ))}
            {ativo && indice !== null ? (
              <>
                <line
                  x1={x(indice)}
                  x2={x(indice)}
                  y1={area.y0}
                  y2={area.y1}
                  className="grafico__mira"
                />
                {series.map((s) => (
                  <circle
                    key={s.chave}
                    cx={x(indice)}
                    cy={y(ativo[s.chave])}
                    r={4.5}
                    className="grafico__ponto"
                    style={{ fill: s.cor }}
                  />
                ))}
              </>
            ) : null}
          </svg>
          {ativo && indice !== null ? (
            <div
              className="grafico__dica"
              role="status"
              style={{
                left: Math.min(Math.max(x(indice), 70), largura - 70),
              }}
            >
              <span className="grafico__dica-dia">{diaMes(ativo.dia)}</span>
              {series.map((s) => (
                <span key={s.chave} className="grafico__dica-linha">
                  <span
                    className="grafico__chave"
                    style={{ background: s.cor }}
                    aria-hidden="true"
                  />
                  <strong>{ativo[s.chave]}</strong> {s.nome.toLowerCase()}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
