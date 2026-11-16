import { ChevronDown, MoreHorizontal } from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export interface ItemDeMenu {
  readonly rotulo: string;
  readonly icone?: ReactNode;
  readonly perigo?: boolean;
  readonly separadorAntes?: boolean;
  readonly desabilitado?: boolean;
  readonly aoEscolher: () => void;
}

const alturaDoItem = 36;

/**
 * Menu suspenso aberto por um gatilho (padrão "menu da conta" e "mais ações" do Design System). A lista
 * é posicionada na janela, então não é cortada pela rolagem de tabelas. Fecha com Esc, clique fora,
 * rolagem ou ao escolher; as setas navegam; o foco volta ao gatilho.
 * Sem `gatilho`, mostra um botão só com ícone (reticências).
 */
export function MenuSuspenso({
  rotulo,
  gatilho,
  itens,
}: {
  rotulo: string;
  gatilho?: ReactNode;
  itens: readonly ItemDeMenu[];
}) {
  const [posicao, setPosicao] = useState<CSSProperties | null>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const lista = useRef<HTMLDivElement>(null);
  const aberto = posicao !== null;

  const abrir = () => {
    const caixa = botao.current?.getBoundingClientRect();
    if (!caixa) return;
    const altura = itens.length * alturaDoItem + 12;
    const cabeEmBaixo = caixa.bottom + 4 + altura <= window.innerHeight;
    setPosicao({
      position: 'fixed',
      right: Math.max(8, window.innerWidth - caixa.right),
      ...(cabeEmBaixo ? { top: caixa.bottom + 4 } : { bottom: window.innerHeight - caixa.top + 4 }),
    });
  };

  useEffect(() => {
    if (!aberto) return;
    const fechar = () => setPosicao(null);
    const focaveis = () =>
      Array.from(
        lista.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)') ?? [],
      );
    focaveis()[0]?.focus();
    const fora = (e: MouseEvent) => {
      const alvo = e.target as Node;
      if (!lista.current?.contains(alvo) && !botao.current?.contains(alvo)) fechar();
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        fechar();
        botao.current?.focus();
      } else if (e.key === 'Tab') {
        fechar();
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const todos = focaveis();
        if (todos.length === 0) return;
        const atual = todos.indexOf(document.activeElement as HTMLElement);
        const passo = e.key === 'ArrowDown' ? 1 : -1;
        todos[(atual + passo + todos.length) % todos.length]?.focus();
      }
    };
    document.addEventListener('mousedown', fora);
    document.addEventListener('keydown', tecla);
    window.addEventListener('resize', fechar);
    window.addEventListener('scroll', fechar, true);
    return () => {
      document.removeEventListener('mousedown', fora);
      document.removeEventListener('keydown', tecla);
      window.removeEventListener('resize', fechar);
      window.removeEventListener('scroll', fechar, true);
    };
  }, [aberto]);

  return (
    <div className="menu-suspenso">
      <button
        ref={botao}
        type="button"
        className={
          gatilho
            ? 'menu-suspenso__gatilho'
            : 'botao botao--fantasma botao--pequeno botao--icone menu-suspenso__icone'
        }
        aria-label={rotulo}
        aria-haspopup="menu"
        aria-expanded={aberto}
        onClick={() => (aberto ? setPosicao(null) : abrir())}
      >
        {gatilho ? (
          <>
            {gatilho}
            <ChevronDown size={16} aria-hidden="true" className="menu-suspenso__seta" />
          </>
        ) : (
          <MoreHorizontal size={18} aria-hidden="true" />
        )}
      </button>
      {aberto
        ? createPortal(
            <div
              ref={lista}
              className="menu-suspenso__lista"
              role="menu"
              aria-label={rotulo}
              style={posicao}
            >
              {itens.map((item) => (
                <div key={item.rotulo} role="none">
                  {item.separadorAntes ? (
                    <div className="menu-suspenso__separador" role="separator" />
                  ) : null}
                  <button
                    type="button"
                    role="menuitem"
                    disabled={item.desabilitado}
                    className={`menu-suspenso__item${item.perigo ? ' menu-suspenso__item--perigo' : ''}`}
                    onClick={() => {
                      setPosicao(null);
                      item.aoEscolher();
                    }}
                  >
                    {item.icone}
                    {item.rotulo}
                  </button>
                </div>
              ))}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
