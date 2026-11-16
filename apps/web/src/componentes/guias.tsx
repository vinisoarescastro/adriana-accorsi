import { useId, type KeyboardEvent, type ReactNode } from 'react';

export interface ItemDeGuia<T extends string> {
  readonly id: T;
  readonly rotulo: string;
  readonly icone?: ReactNode;
  /** Um número ao lado do nome (comentários, documentos…). */
  readonly contagem?: number | undefined;
}

/**
 * Guias (abas) de um modal, como o `Tabs` do Design System: traço embaixo da guia ativa, setas e
 * Home/End navegam. O conteúdo de cada guia fica em um `PainelDaGuia`, que continua montado quando
 * oculto (o que foi digitado não se perde ao trocar de guia).
 */
export function Guias<T extends string>({
  rotulo,
  valor,
  aoMudar,
  itens,
  prefixo,
}: {
  rotulo: string;
  valor: T;
  aoMudar: (id: T) => void;
  itens: readonly ItemDeGuia<T>[];
  /** Distingue os ids quando há mais de um conjunto de guias na tela. */
  prefixo: string;
}) {
  const aoTeclar = (e: KeyboardEvent<HTMLButtonElement>, indice: number) => {
    const ultimo = itens.length - 1;
    const proximo =
      e.key === 'ArrowRight'
        ? (indice + 1) % itens.length
        : e.key === 'ArrowLeft'
          ? (indice + ultimo) % itens.length
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? ultimo
              : null;
    if (proximo === null) return;
    e.preventDefault();
    const destino = itens[proximo];
    if (!destino) return;
    aoMudar(destino.id);
    (e.currentTarget.parentElement?.children[proximo] as HTMLElement | undefined)?.focus();
  };

  return (
    <div className="guias" role="tablist" aria-label={rotulo}>
      {itens.map((item, i) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          id={`${prefixo}-guia-${item.id}`}
          aria-controls={`${prefixo}-painel-${item.id}`}
          aria-selected={valor === item.id}
          tabIndex={valor === item.id ? 0 : -1}
          className="guia"
          onClick={() => aoMudar(item.id)}
          onKeyDown={(e) => aoTeclar(e, i)}
        >
          {item.icone}
          {item.rotulo}
          {item.contagem !== undefined ? (
            <span className="guia__contagem" aria-label={`${item.contagem} itens`}>
              {item.contagem}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

export function PainelDaGuia({
  id,
  prefixo,
  ativa,
  children,
}: {
  id: string;
  prefixo: string;
  ativa: boolean;
  children: ReactNode;
}) {
  return (
    <div
      role="tabpanel"
      id={`${prefixo}-painel-${id}`}
      aria-labelledby={`${prefixo}-guia-${id}`}
      hidden={!ativa}
      className="guia-painel"
    >
      {children}
    </div>
  );
}

/** Um prefixo único por instância, para os ids das guias. */
export const usePrefixoDeGuias = () => useId().replace(/:/g, '');
