import type { ReactNode } from 'react';

export interface ItemDeAba<T extends string> {
  readonly id: T;
  readonly rotulo: string;
  readonly icone?: ReactNode;
}

/** Abas para trocar de visão ou de seção. Variante "segmentada" para duas ou três visões da mesma lista. */
export function Abas<T extends string>({
  rotulo,
  valor,
  aoMudar,
  itens,
  segmentada,
}: {
  rotulo: string;
  valor: T;
  aoMudar: (id: T) => void;
  itens: readonly ItemDeAba<T>[];
  segmentada?: boolean;
}) {
  return (
    <div
      className={`abas${segmentada ? ' abas--segmentada' : ''}`}
      role="group"
      aria-label={rotulo}
    >
      {itens.map((item) => (
        <button
          key={item.id}
          type="button"
          className="aba"
          aria-pressed={valor === item.id}
          onClick={() => aoMudar(item.id)}
        >
          {item.icone}
          {item.rotulo}
        </button>
      ))}
    </div>
  );
}
