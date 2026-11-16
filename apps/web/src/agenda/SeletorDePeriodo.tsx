import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import {
  diaPorExtenso,
  diasDoIntervalo,
  domingoDaSemana,
  inicialDoDiaDaSemana,
  intervaloDaVisao,
  nomeCurtoDoMes,
  nomeDoMesComAno,
  numeroDoDia,
  somarMeses,
  tituloDoPeriodo,
  type VisaoDaAgenda,
} from './calendario';

/**
 * Escolhe o período: o título abre um calendário. Na visão por semana, clicar num dia escolhe a semana
 * inteira (a linha fica destacada); na visão por mês, escolhe-se o mês e o ano.
 */
export function SeletorDePeriodo({
  visao,
  referencia,
  hoje,
  aoEscolher,
}: {
  visao: VisaoDaAgenda;
  referencia: string;
  hoje: string;
  aoEscolher: (data: string) => void;
}) {
  const [posicao, setPosicao] = useState<CSSProperties | null>(null);
  const [exibido, setExibido] = useState(referencia);
  const botao = useRef<HTMLButtonElement>(null);
  const painel = useRef<HTMLDivElement>(null);
  const aberto = posicao !== null;

  const abrir = () => {
    const caixa = botao.current?.getBoundingClientRect();
    if (!caixa) return;
    setExibido(referencia);
    setPosicao({
      position: 'fixed',
      top: caixa.bottom + 6,
      left: Math.max(8, Math.min(caixa.left, window.innerWidth - 296)),
    });
  };

  useEffect(() => {
    if (!aberto) return;
    const fechar = () => setPosicao(null);
    const fora = (e: MouseEvent) => {
      const alvo = e.target as Node;
      if (!painel.current?.contains(alvo) && !botao.current?.contains(alvo)) fechar();
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      fechar();
      botao.current?.focus();
    };
    document.addEventListener('mousedown', fora);
    document.addEventListener('keydown', tecla);
    window.addEventListener('resize', fechar);
    return () => {
      document.removeEventListener('mousedown', fora);
      document.removeEventListener('keydown', tecla);
      window.removeEventListener('resize', fechar);
    };
  }, [aberto]);

  const escolher = (data: string) => {
    setPosicao(null);
    aoEscolher(data);
    botao.current?.focus();
  };

  const semanaEscolhida = intervaloDaVisao('semana', referencia);
  const dias = diasDoIntervalo(
    intervaloDaVisao('mes', exibido).inicio,
    intervaloDaVisao('mes', exibido).fim,
  );

  return (
    <>
      <button
        ref={botao}
        type="button"
        className="seletor-periodo"
        aria-haspopup="dialog"
        aria-expanded={aberto}
        aria-label={`Escolher ${visao === 'semana' ? 'a semana' : 'o mês'}: ${tituloDoPeriodo(visao, referencia)}`}
        onClick={() => (aberto ? setPosicao(null) : abrir())}
      >
        <CalendarDays size={16} aria-hidden="true" />
        <span>{tituloDoPeriodo(visao, referencia)}</span>
        <ChevronDown size={16} aria-hidden="true" className="seletor-periodo__seta" />
      </button>
      {aberto
        ? createPortal(
            <div
              ref={painel}
              className="mini-calendario"
              role="dialog"
              aria-label={visao === 'semana' ? 'Escolher a semana' : 'Escolher o mês'}
              style={posicao}
            >
              <div className="mini-calendario__topo">
                <button
                  type="button"
                  className="mini-calendario__nav"
                  aria-label={visao === 'semana' ? 'Mês anterior' : 'Ano anterior'}
                  onClick={() => setExibido(somarMeses(exibido, visao === 'semana' ? -1 : -12))}
                >
                  <ChevronLeft size={16} aria-hidden="true" />
                </button>
                <strong className="mini-calendario__titulo">
                  {visao === 'semana' ? nomeDoMesComAno(exibido) : exibido.slice(0, 4)}
                </strong>
                <button
                  type="button"
                  className="mini-calendario__nav"
                  aria-label={visao === 'semana' ? 'Próximo mês' : 'Próximo ano'}
                  onClick={() => setExibido(somarMeses(exibido, visao === 'semana' ? 1 : 12))}
                >
                  <ChevronRight size={16} aria-hidden="true" />
                </button>
              </div>

              {visao === 'semana' ? (
                <div className="mini-calendario__semanas">
                  <div
                    className="mini-calendario__linha mini-calendario__linha--titulo"
                    aria-hidden="true"
                  >
                    {dias.slice(0, 7).map((d) => (
                      <span key={d}>{inicialDoDiaDaSemana(d)}</span>
                    ))}
                  </div>
                  {Array.from({ length: dias.length / 7 }, (_, s) => {
                    const semana = dias.slice(s * 7, s * 7 + 7);
                    const escolhida = domingoDaSemana(semana[0] ?? '') === semanaEscolhida.inicio;
                    return (
                      <div
                        key={semana[0]}
                        className={`mini-calendario__linha${escolhida ? ' mini-calendario__linha--escolhida' : ''}`}
                      >
                        {semana.map((d) => (
                          <button
                            key={d}
                            type="button"
                            className={`mini-calendario__dia${d.slice(0, 7) !== exibido.slice(0, 7) ? ' mini-calendario__dia--fora' : ''}${d === hoje ? ' mini-calendario__dia--hoje' : ''}`}
                            aria-label={diaPorExtenso(d)}
                            aria-current={d === hoje ? 'date' : undefined}
                            onClick={() => escolher(d)}
                          >
                            {numeroDoDia(d)}
                          </button>
                        ))}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="mini-calendario__meses">
                  {Array.from({ length: 12 }, (_, i) => {
                    const mes = somarMeses(`${exibido.slice(0, 4)}-01-01`, i);
                    return (
                      <button
                        key={mes}
                        type="button"
                        className={`mini-calendario__mes${mes.slice(0, 7) === referencia.slice(0, 7) ? ' mini-calendario__mes--escolhido' : ''}${mes.slice(0, 7) === hoje.slice(0, 7) ? ' mini-calendario__mes--hoje' : ''}`}
                        aria-pressed={mes.slice(0, 7) === referencia.slice(0, 7)}
                        onClick={() => escolher(mes)}
                      >
                        {nomeCurtoDoMes(mes)}
                      </button>
                    );
                  })}
                </div>
              )}

              <button
                type="button"
                className="mini-calendario__hoje"
                onClick={() => escolher(hoje)}
              >
                {visao === 'semana' ? 'Ir para esta semana' : 'Ir para este mês'}
              </button>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
