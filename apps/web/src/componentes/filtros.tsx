import { Search, X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Botao } from './ui';

const esperaDaBuscaEmMs = 350;

/**
 * Filtros de uma lista ou quadro, numa linha só: busca à esquerda, filtros no meio, e à direita o
 * "Limpar" (só quando há filtro ativo) e a troca de visão. A busca roda sozinha depois de uma pausa na
 * digitação; Enter busca na hora. Sem rótulos soltos: cada controle tem nome acessível.
 */
export function BarraDeFiltros({
  rotulo,
  termo,
  aoBuscar,
  placeholder,
  ativos,
  aoLimpar,
  filtros,
  visao,
}: {
  rotulo: string;
  /** A busca já aplicada. */
  termo: string;
  aoBuscar: (termo: string) => void;
  placeholder: string;
  /** Há algum filtro (inclusive a busca) aplicado? Mostra o "Limpar". */
  ativos: boolean;
  aoLimpar: () => void;
  filtros?: ReactNode;
  /** A troca de visão (lista ou quadro), alinhada à direita. */
  visao?: ReactNode;
}) {
  const [texto, setTexto] = useState(termo);
  const aplicado = useRef(termo);
  aplicado.current = termo;

  // Quando a busca é limpa de fora, o campo acompanha.
  useEffect(() => setTexto(termo), [termo]);

  useEffect(() => {
    const limpo = texto.trim();
    if (limpo === aplicado.current) return;
    const espera = setTimeout(() => aoBuscar(limpo), esperaDaBuscaEmMs);
    return () => clearTimeout(espera);
    // aoBuscar costuma ser recriado a cada renderização; só o texto digitado reinicia a espera.
  }, [texto]);

  return (
    <form
      className="filtros"
      role="search"
      aria-label={rotulo}
      onSubmit={(e) => {
        e.preventDefault();
        aoBuscar(texto.trim());
      }}
    >
      <div className="filtros__busca">
        <Search size={16} aria-hidden="true" />
        <input
          type="search"
          aria-label="Buscar"
          placeholder={placeholder}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
      </div>
      {filtros ? <div className="filtros__controles">{filtros}</div> : null}
      <div className="filtros__fim">
        {ativos ? (
          <Botao
            variante="fantasma"
            pequeno
            icone={<X size={14} aria-hidden="true" />}
            onClick={aoLimpar}
          >
            Limpar
          </Botao>
        ) : null}
        {visao}
      </div>
    </form>
  );
}

/** Filtro de liga e desliga ("Atrasadas", "Minhas"): um botão que fica marcado enquanto vale. */
export function FiltroRapido({
  rotulo,
  ativo,
  aoAlternar,
  icone,
}: {
  rotulo: string;
  ativo: boolean;
  aoAlternar: (ativo: boolean) => void;
  icone?: ReactNode;
}) {
  return (
    <button
      type="button"
      className="filtro-rapido"
      aria-pressed={ativo}
      onClick={() => aoAlternar(!ativo)}
    >
      {icone}
      {rotulo}
    </button>
  );
}
