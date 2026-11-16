import { AlertTriangle, CheckCircle2, CircleAlert, Info, X } from 'lucide-react';
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

export type TomDoToast = 'sucesso' | 'atencao' | 'erro' | 'info';

interface Item {
  readonly id: number;
  readonly tom: TomDoToast;
  readonly titulo: string;
  readonly texto?: string | undefined;
}

type Avisar = (toast: { tom: TomDoToast; titulo: string; texto?: string }) => void;

const Contexto = createContext<Avisar>(() => undefined);

/** Para avisar o resultado de uma ação sem tirar o usuário do lugar. Sem o provedor, não faz nada. */
export const useToast = () => useContext(Contexto);

const icones = { sucesso: CheckCircle2, atencao: AlertTriangle, erro: CircleAlert, info: Info };

const duracaoEmMs = 5000;

export function ProvedorDeToasts({ children }: { children: ReactNode }) {
  const [itens, definirItens] = useState<Item[]>([]);
  const proximo = useRef(1);
  const fechar = useCallback(
    (id: number) => definirItens((lista) => lista.filter((t) => t.id !== id)),
    [],
  );
  const avisar = useCallback<Avisar>(
    (toast) => {
      const id = proximo.current++;
      definirItens((lista) => [...lista.slice(-3), { id, ...toast }]);
      setTimeout(() => fechar(id), duracaoEmMs);
    },
    [fechar],
  );

  return (
    <Contexto.Provider value={avisar}>
      {children}
      <div className="toasts" aria-live="polite">
        {itens.map((t) => {
          const Icone = icones[t.tom];
          return (
            <div
              key={t.id}
              className={`toast toast--${t.tom}`}
              role={t.tom === 'erro' ? 'alert' : 'status'}
            >
              <Icone className="toast__icone" size={20} aria-hidden="true" />
              <div className="toast__corpo">
                <div className="toast__titulo">{t.titulo}</div>
                {t.texto ? <div className="toast__texto">{t.texto}</div> : null}
              </div>
              <button
                type="button"
                className="toast__fechar"
                aria-label="Fechar aviso"
                onClick={() => fechar(t.id)}
              >
                <X size={16} aria-hidden="true" />
              </button>
              <span className="toast__tempo" aria-hidden="true" />
            </div>
          );
        })}
      </div>
    </Contexto.Provider>
  );
}
