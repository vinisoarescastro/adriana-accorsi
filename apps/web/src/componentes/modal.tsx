import { X } from 'lucide-react';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Botao } from './ui';

export type TamanhoDoModal = 'sm' | 'md' | 'lg' | 'xl';

/** Modais abertos, do mais antigo ao mais novo: só o do topo reage ao Esc e ao Tab. */
const pilha: symbol[] = [];

const seletorDeFocaveis =
  'a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])';

/**
 * Diálogo modal: portal, fundo escurecido, foco preso, Esc e clique fora fecham, e a rolagem da
 * página fica travada. O foco volta ao que o abriu. No celular ocupa quase a tela inteira.
 */
export function Modal({
  titulo,
  descricao,
  tamanho = 'md',
  classe,
  aoFechar,
  rodape,
  children,
}: {
  titulo: string;
  descricao?: string;
  tamanho?: TamanhoDoModal;
  /** Classe extra no painel (para estilos de um tipo de modal, como a ficha). */
  classe?: string;
  aoFechar: () => void;
  rodape?: ReactNode;
  children?: ReactNode;
}) {
  const id = useId();
  const painel = useRef<HTMLDivElement>(null);
  const fechar = useRef(aoFechar);
  fechar.current = aoFechar;

  useEffect(() => {
    const eu = Symbol('modal');
    pilha.push(eu);
    const anterior = document.activeElement as HTMLElement | null;
    const corpo = painel.current;
    // Foca o primeiro controle do CORPO (o título e o botão de fechar ficam por último na ordem de foco).
    (
      corpo?.querySelector<HTMLElement>('.modal__corpo ' + seletorDeFocaveis) ??
      corpo?.querySelector<HTMLElement>(seletorDeFocaveis)
    )?.focus();
    const aoTeclar = (e: KeyboardEvent) => {
      if (pilha[pilha.length - 1] !== eu) return;
      if (e.key === 'Escape') {
        fechar.current();
        return;
      }
      if (e.key !== 'Tab' || !corpo) return;
      const itens = Array.from(corpo.querySelectorAll<HTMLElement>(seletorDeFocaveis));
      const primeiro = itens[0];
      const ultimo = itens[itens.length - 1];
      if (!primeiro || !ultimo) return;
      if (e.shiftKey && document.activeElement === primeiro) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primeiro.focus();
      }
    };
    const rolagem = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', aoTeclar);
    return () => {
      document.removeEventListener('keydown', aoTeclar);
      pilha.splice(pilha.indexOf(eu), 1);
      document.body.style.overflow = rolagem;
      anterior?.focus?.();
    };
  }, []);

  return createPortal(
    <div
      className="modal__fundo"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) aoFechar();
      }}
    >
      <div
        ref={painel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        className={`modal modal--${tamanho}${classe ? ` ${classe}` : ''}`}
      >
        <div className="modal__cabecalho">
          <div className="modal__titulos">
            <h2 id={id} className="modal__titulo">
              {titulo}
            </h2>
            {descricao ? <p className="modal__descricao">{descricao}</p> : null}
          </div>
          <Botao
            variante="fantasma"
            pequeno
            className="botao--icone"
            aria-label="Fechar"
            onClick={aoFechar}
          >
            <X size={18} aria-hidden="true" />
          </Botao>
        </div>
        <div className="modal__corpo">{children}</div>
        {rodape ? <div className="modal__rodape">{rodape}</div> : null}
      </div>
    </div>,
    document.body,
  );
}

export interface PedidoDeConfirmacao {
  titulo: string;
  mensagem: string;
  rotuloDeConfirmar?: string;
  perigo?: boolean;
  aoConfirmar: () => void;
}

/** Substitui o `window.confirm`: devolve `pedir(...)` e o elemento do modal para renderizar na tela. */
export function useConfirmacao() {
  const [pedido, setPedido] = useState<PedidoDeConfirmacao | null>(null);
  const elemento = pedido ? (
    <Modal
      titulo={pedido.titulo}
      tamanho="sm"
      aoFechar={() => setPedido(null)}
      rodape={
        <>
          <Botao variante="secundario" onClick={() => setPedido(null)}>
            Cancelar
          </Botao>
          <Botao
            variante={pedido.perigo ? 'perigo' : 'primario'}
            onClick={() => {
              const acao = pedido.aoConfirmar;
              setPedido(null);
              acao();
            }}
          >
            {pedido.rotuloDeConfirmar ?? 'Confirmar'}
          </Botao>
        </>
      }
    >
      <p>{pedido.mensagem}</p>
    </Modal>
  ) : null;
  return { pedir: setPedido, elemento };
}
