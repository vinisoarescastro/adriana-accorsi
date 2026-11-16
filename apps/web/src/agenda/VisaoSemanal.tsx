import type { ItemDaAgenda } from '@gabinete/compartilhado';
import { useEffect, useRef } from 'react';
import {
  agruparPorDia,
  diasDoIntervalo,
  eDiaInteiro,
  horasDoDia,
  minutosDoDia,
  nomeCurtoDoDiaDaSemana,
  numeroDoDia,
  posicionarNoDia,
} from './calendario';
import { CartaoDaAgenda, type AoAbrirItem } from './CartaoDaAgenda';

const horaInicialVisivel = 7;

/** Semana hora a hora: cada compromisso é um cartão na faixa do seu horário; sobrepostos ficam lado a lado. */
export function VisaoSemanal({
  inicio,
  fim,
  hoje,
  itens,
  aoAbrir,
}: {
  inicio: string;
  fim: string;
  hoje: string;
  itens: readonly ItemDaAgenda[];
  aoAbrir: AoAbrirItem;
}) {
  const dias = diasDoIntervalo(inicio, fim);
  const grupos = agruparPorDia(itens);
  const rolagem = useRef<HTMLDivElement>(null);
  const agora = minutosDoDia(new Date().toISOString());
  const temDiaInteiro = itens.some(eDiaInteiro);

  useEffect(() => {
    const el = rolagem.current;
    if (!el) return;
    const primeiro = Math.min(
      ...itens.filter((i) => !eDiaInteiro(i)).map((i) => minutosDoDia(i.inicio) / 60),
      horaInicialVisivel,
    );
    // O cabeçalho fixo ocupa o topo; a rolagem vai até uma hora antes do primeiro compromisso.
    el.scrollTop = Math.max(primeiro - 1, 0) * (el.scrollHeight / (horasDoDia + 2));
  }, [itens, inicio]);

  return (
    <div className="agenda-horas" role="group" aria-label="Semana hora a hora" ref={rolagem}>
      <div className="agenda-horas__interno">
        <div className="agenda-horas__topo">
          <div className="agenda-horas__linha">
            <span />
            {dias.map((dia) => (
              <div
                key={dia}
                className={`agenda-horas__dia${dia === hoje ? ' agenda-horas__dia--hoje' : ''}`}
              >
                <span className="agenda-horas__semana">{nomeCurtoDoDiaDaSemana(dia)}</span>
                <span className="agenda-horas__numero">{numeroDoDia(dia)}</span>
                {dia === hoje ? <span className="somente-leitor"> (hoje)</span> : null}
              </div>
            ))}
          </div>
          {temDiaInteiro ? (
            <div className="agenda-horas__linha agenda-horas__linha--inteiro">
              <span className="agenda-horas__rotulo agenda-horas__rotulo--inteiro">
                Dia inteiro
              </span>
              {dias.map((dia) => (
                <div key={dia} className="agenda-horas__inteiro-dia">
                  {(grupos.get(dia) ?? []).filter(eDiaInteiro).map((item, i) => (
                    <CartaoDaAgenda
                      key={`${item.tipo}-${i}`}
                      item={item}
                      aoAbrir={aoAbrir}
                      compacto
                    />
                  ))}
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="agenda-horas__grade">
          <div className="agenda-horas__eixo" aria-hidden="true">
            {Array.from({ length: horasDoDia }, (_, h) => (
              <span key={h} className="agenda-horas__rotulo">
                {h === 0 ? '' : `${String(h).padStart(2, '0')}:00`}
              </span>
            ))}
          </div>
          {dias.map((dia) => (
            <div
              key={dia}
              className={`agenda-horas__coluna${dia === hoje ? ' agenda-horas__coluna--hoje' : ''}`}
            >
              {dia === hoje ? (
                <span
                  className="agenda-horas__agora"
                  aria-hidden="true"
                  style={{ top: `calc(var(--agenda-hora) * ${agora / 60})` }}
                />
              ) : null}
              {posicionarNoDia(grupos.get(dia) ?? []).map((p, i) => (
                <CartaoDaAgenda
                  key={`${p.item.tipo}-${p.inicio}-${i}`}
                  item={p.item}
                  aoAbrir={aoAbrir}
                  curto={p.fim - p.inicio <= 45}
                  estilo={{
                    top: `calc(var(--agenda-hora) * ${p.inicio / 60} + 1px)`,
                    height: `calc(var(--agenda-hora) * ${(p.fim - p.inicio) / 60} - 2px)`,
                    left: `calc(${(p.coluna / p.colunas) * 100}% + 3px)`,
                    width: `calc(${100 / p.colunas}% - 6px)`,
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
