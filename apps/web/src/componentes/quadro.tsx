import type { Prioridade } from '@gabinete/compartilhado';
import { ArrowRightLeft, CalendarClock, ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { MenuSuspenso } from './menu';
import { GrupoDeAvatares } from './responsaveis';
import { SeloDePrioridade } from './situacao';

type PapelDaEtapa = 'entrada' | 'intermediaria' | 'conclusao' | 'arquivamento';

/** O que o cartão mostra de uma demanda ou tarefa. */
export interface DadosDoCartao {
  readonly titulo: string;
  readonly apoio?: string | undefined;
  /** Projetos de lei não têm prioridade: sem ela, o cartão não mostra o selo. */
  readonly prioridade?: Prioridade | undefined;
  readonly prazo: string | null;
  readonly atrasada: boolean;
  /** O principal primeiro. */
  readonly responsaveis: readonly string[];
}

export interface ColunaDeQuadro<T> {
  readonly id: number;
  readonly nome: string;
  readonly papel: PapelDaEtapa;
  /** O total no servidor; pode passar do que veio (a coluna avisa). */
  readonly total: number;
  readonly itens: readonly T[];
}

/** O que, dentro do quadro, é de quem clica (cartão, botão, campo): não inicia o arrasto do fundo. */
const seletorDoQueNaoArrasta = 'article, button, a, input, select, textarea, [role="menu"]';

/**
 * Rolagem horizontal do quadro, sem depender da barra do fim da página: setas para os lados (rolam uma
 * tela de colunas), arrastar o fundo com o mouse e Shift + roda. Diz se ainda há o que rolar em cada
 * direção, para as setas só aparecerem quando servem.
 */
function useRolagemDoQuadro() {
  const faixa = useRef<HTMLDivElement>(null);
  const [podeVoltar, setPodeVoltar] = useState(false);
  const [podeAvancar, setPodeAvancar] = useState(false);

  const medir = useCallback(() => {
    const el = faixa.current;
    if (!el) return;
    setPodeVoltar(el.scrollLeft > 4);
    setPodeAvancar(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    const el = faixa.current;
    if (!el) return;
    medir();
    el.addEventListener('scroll', medir, { passive: true });
    window.addEventListener('resize', medir);
    // Colunas que chegam depois (carregamento) mudam a largura total.
    const observador = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(medir);
    observador?.observe(el);
    return () => {
      el.removeEventListener('scroll', medir);
      window.removeEventListener('resize', medir);
      observador?.disconnect();
    };
  }, [medir]);

  const rolar = (sentido: -1 | 1) => {
    const el = faixa.current;
    if (!el) return;
    el.scrollBy({ left: sentido * el.clientWidth * 0.8, behavior: 'smooth' });
  };

  // Arrastar o fundo com o mouse: só onde não há cartão nem controle.
  const arrasto = useRef<{ x: number; inicio: number } | null>(null);
  const aoPressionar = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = faixa.current;
    if (!el || e.pointerType !== 'mouse' || e.button !== 0) return;
    if ((e.target as HTMLElement).closest(seletorDoQueNaoArrasta)) return;
    arrasto.current = { x: e.clientX, inicio: el.scrollLeft };
    el.classList.add('is-panning');
  };
  const aoMover = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = faixa.current;
    if (!el || !arrasto.current) return;
    el.scrollLeft = arrasto.current.inicio - (e.clientX - arrasto.current.x);
  };
  const aoSoltar = () => {
    arrasto.current = null;
    faixa.current?.classList.remove('is-panning');
  };

  return { faixa, podeVoltar, podeAvancar, rolar, aoPressionar, aoMover, aoSoltar };
}

/**
 * Quadro por etapa, como o `KanbanBoard` do Design System: arraste um cartão para outra coluna para
 * movê-lo (a coluna de destino se destaca). Quem não pode mover não arrasta. O menu "Mover para…" de
 * cada cartão faz o mesmo pelo teclado e no toque. Abrir o cartão é um clique.
 */
export function Quadro<T extends { id: number }>({
  rotulo,
  colunas,
  vazio,
  dados,
  aoAbrir,
  podeMover,
  aoMover,
}: {
  rotulo: string;
  colunas: readonly ColunaDeQuadro<T>[];
  vazio: string;
  dados: (item: T) => DadosDoCartao;
  aoAbrir: (id: number) => void;
  podeMover: (item: T) => boolean;
  aoMover: (item: T, colunaId: number) => void;
}) {
  const rolagem = useRolagemDoQuadro();
  const [arrastando, setArrastando] = useState<{ item: T; deColuna: number } | null>(null);
  const [sobre, setSobre] = useState<number | null>(null);
  const encerrar = () => {
    setArrastando(null);
    setSobre(null);
  };

  return (
    <div className="quadro-moldura">
      {rolagem.podeVoltar ? (
        <button
          type="button"
          className="quadro-seta quadro-seta--esquerda"
          aria-label="Ver colunas anteriores"
          onClick={() => rolagem.rolar(-1)}
        >
          <ChevronLeft size={20} aria-hidden="true" />
        </button>
      ) : null}
      {rolagem.podeAvancar ? (
        <button
          type="button"
          className="quadro-seta quadro-seta--direita"
          aria-label="Ver próximas colunas"
          onClick={() => rolagem.rolar(1)}
        >
          <ChevronRight size={20} aria-hidden="true" />
        </button>
      ) : null}
      <div
        className="quadro"
        role="list"
        aria-label={rotulo}
        ref={rolagem.faixa}
        onPointerDown={rolagem.aoPressionar}
        onPointerMove={rolagem.aoMover}
        onPointerUp={rolagem.aoSoltar}
        onPointerLeave={rolagem.aoSoltar}
        onPointerCancel={rolagem.aoSoltar}
      >
        {colunas.map((coluna) => {
          const destino = arrastando !== null && arrastando.deColuna !== coluna.id;
          return (
            <section
              key={coluna.id}
              className={`quadro__coluna${destino && sobre === coluna.id ? ' is-over' : ''}`}
              role="listitem"
              aria-label={coluna.nome}
              onDragOver={(e) => {
                if (!destino) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                setSobre(coluna.id);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setSobre(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (arrastando && destino) aoMover(arrastando.item, coluna.id);
                encerrar();
              }}
            >
              <header className="quadro__cabeca">
                <span
                  className={`quadro__ponto quadro__ponto--${coluna.papel}`}
                  aria-hidden="true"
                />
                <h2 className="quadro__titulo">{coluna.nome}</h2>
                <span className="quadro__contagem" aria-label={`${coluna.total} itens`}>
                  {coluna.total}
                </span>
              </header>
              <div className="quadro__lista">
                {coluna.itens.length === 0 ? (
                  <div className="quadro__vazio">{destino ? 'Solte aqui para mover.' : vazio}</div>
                ) : (
                  coluna.itens.map((item) => {
                    const movel = podeMover(item);
                    return (
                      <CartaoDoQuadro
                        key={item.id}
                        dados={dados(item)}
                        aoAbrir={() => aoAbrir(item.id)}
                        arrastando={arrastando?.item.id === item.id}
                        aoComecarArrasto={
                          movel
                            ? (e) => {
                                e.dataTransfer.effectAllowed = 'move';
                                e.dataTransfer.setData('text/plain', String(item.id));
                                setArrastando({ item, deColuna: coluna.id });
                              }
                            : undefined
                        }
                        aoTerminarArrasto={encerrar}
                        destinos={
                          movel
                            ? colunas
                                .filter((c) => c.id !== coluna.id)
                                .map((c) => ({ id: c.id, nome: c.nome }))
                            : []
                        }
                        aoEscolherDestino={(destinoId) => aoMover(item, destinoId)}
                      />
                    );
                  })
                )}
              </div>
              {coluna.total > coluna.itens.length ? (
                <p className="campo__ajuda">
                  Mostrando {coluna.itens.length} de {coluna.total}. Use a lista para ver todas.
                </p>
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}

/** O cartão: prioridade, título, apoio e, embaixo, prazo e responsável. Arrastável quando pode mover. */
function CartaoDoQuadro({
  dados,
  aoAbrir,
  arrastando,
  aoComecarArrasto,
  aoTerminarArrasto,
  destinos,
  aoEscolherDestino,
}: {
  dados: DadosDoCartao;
  aoAbrir: () => void;
  arrastando: boolean;
  aoComecarArrasto: ((e: React.DragEvent) => void) | undefined;
  aoTerminarArrasto: () => void;
  destinos: readonly { id: number; nome: string }[];
  aoEscolherDestino: (colunaId: number) => void;
}): ReactNode {
  const { titulo, apoio, prioridade, prazo, atrasada, responsaveis } = dados;
  return (
    <article
      className={`quadro__cartao${aoComecarArrasto ? ' quadro__cartao--arrastavel' : ''}${arrastando ? ' is-dragging' : ''}`}
      draggable={Boolean(aoComecarArrasto)}
      onDragStart={aoComecarArrasto}
      onDragEnd={aoTerminarArrasto}
    >
      <button type="button" className="quadro__corpo" onClick={aoAbrir}>
        {prioridade ? (
          <span className="quadro__etiquetas">
            <SeloDePrioridade prioridade={prioridade} compacto />
          </span>
        ) : null}
        <strong className="quadro__cartao-titulo">{titulo}</strong>
        {apoio ? <span className="quadro__apoio">{apoio}</span> : null}
        <span className="quadro__meta">
          {prazo ? (
            <span className={`quadro__prazo${atrasada ? ' quadro__prazo--atrasado' : ''}`}>
              <CalendarClock size={12} aria-hidden="true" />
              {formatarPrazo(prazo)}
              {atrasada ? ' (atrasada)' : ''}
            </span>
          ) : atrasada ? (
            <span className="quadro__prazo quadro__prazo--atrasado">Atrasada</span>
          ) : (
            <span className="quadro__prazo">Sem prazo</span>
          )}
          <span>
            <GrupoDeAvatares nomes={responsaveis} />
            <span className="somente-leitor">
              {responsaveis.length > 1 ? 'Responsáveis' : 'Responsável'}: {responsaveis.join(', ')}
            </span>
          </span>
        </span>
      </button>
      {destinos.length > 0 ? (
        <div className="quadro__menu">
          <MenuSuspenso
            rotulo="Mover para outra etapa"
            icone={<ArrowRightLeft size={14} aria-hidden="true" />}
            itens={destinos.map((d) => ({
              rotulo: `Mover para ${d.nome}`,
              icone: <ArrowRightLeft size={16} aria-hidden="true" />,
              aoEscolher: () => aoEscolherDestino(d.id),
            }))}
          />
        </div>
      ) : null}
    </article>
  );
}

/** Prazo AAAA-MM-DD em dia/mês/ano; qualquer outro formato passa como veio. */
export function formatarPrazo(prazo: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(prazo) ? prazo.split('-').reverse().join('/') : prazo;
}
