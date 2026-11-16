import { ChevronDown, Search, X } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { Avatar } from './avatar';

export interface OpcaoDePessoa {
  readonly id: number;
  readonly nome: string;
  readonly apoio?: string;
  readonly temFoto?: boolean;
}

/**
 * Escolha de várias pessoas num menu suspenso, com busca. Cada linha mostra o avatar à esquerda do
 * nome; as escolhidas aparecem como etiquetas abaixo do campo, com um X para retirar.
 */
export function SeletorDePessoas({
  rotulo,
  opcoes,
  valor,
  aoMudar,
  vazio = 'Ninguém disponível.',
}: {
  rotulo: string;
  opcoes: readonly OpcaoDePessoa[];
  valor: readonly number[];
  aoMudar: (ids: number[]) => void;
  vazio?: string;
}) {
  const [posicao, setPosicao] = useState<CSSProperties | null>(null);
  const [busca, setBusca] = useState('');
  const gatilho = useRef<HTMLButtonElement>(null);
  const painel = useRef<HTMLDivElement>(null);
  const idDoRotulo = useId();
  const aberto = posicao !== null;

  const escolhidas = opcoes.filter((o) => valor.includes(o.id));
  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return termo ? opcoes.filter((o) => o.nome.toLowerCase().includes(termo)) : opcoes;
  }, [opcoes, busca]);

  const abrir = () => {
    const caixa = gatilho.current?.getBoundingClientRect();
    if (!caixa) return;
    const cabeEmBaixo = caixa.bottom + 4 + 320 <= window.innerHeight;
    setBusca('');
    setPosicao({
      position: 'fixed',
      left: caixa.left,
      width: caixa.width,
      ...(cabeEmBaixo ? { top: caixa.bottom + 4 } : { bottom: window.innerHeight - caixa.top + 4 }),
    });
  };

  useEffect(() => {
    if (!aberto) return;
    const fechar = () => setPosicao(null);
    const fora = (e: MouseEvent) => {
      const alvo = e.target as Node;
      if (!painel.current?.contains(alvo) && !gatilho.current?.contains(alvo)) fechar();
    };
    // Esc fecha só o menu (e não o modal que o contém): captura antes de o modal ouvir.
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      fechar();
      gatilho.current?.focus();
    };
    const rolagem = (e: Event) => {
      if (!painel.current?.contains(e.target as Node)) fechar();
    };
    document.addEventListener('mousedown', fora);
    document.addEventListener('keydown', tecla, true);
    window.addEventListener('scroll', rolagem, true);
    window.addEventListener('resize', fechar);
    return () => {
      document.removeEventListener('mousedown', fora);
      document.removeEventListener('keydown', tecla, true);
      window.removeEventListener('scroll', rolagem, true);
      window.removeEventListener('resize', fechar);
    };
  }, [aberto]);

  const alternar = (id: number, marcado: boolean) =>
    aoMudar(marcado ? [...valor, id] : valor.filter((x) => x !== id));

  return (
    <div className="seletor-pessoas">
      <span id={idDoRotulo} className="campo__rotulo">
        {rotulo}
      </span>
      <button
        ref={gatilho}
        type="button"
        className="seletor-pessoas__gatilho"
        aria-labelledby={idDoRotulo}
        aria-haspopup="listbox"
        aria-expanded={aberto}
        onClick={() => (aberto ? setPosicao(null) : abrir())}
      >
        <span className={escolhidas.length === 0 ? 'seletor-pessoas__vazio' : undefined}>
          {escolhidas.length === 0
            ? 'Selecionar pessoas'
            : `${escolhidas.length} selecionada${escolhidas.length > 1 ? 's' : ''}`}
        </span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>

      {escolhidas.length > 0 ? (
        <ul className="seletor-pessoas__etiquetas" aria-label="Selecionadas">
          {escolhidas.map((o) => (
            <li key={o.id} className="seletor-pessoas__etiqueta">
              <Avatar nome={o.nome} id={o.id} temFoto={o.temFoto} pequeno />
              <span>{o.nome}</span>
              <button
                type="button"
                aria-label={`Retirar ${o.nome}`}
                onClick={() => alternar(o.id, false)}
              >
                <X size={14} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {aberto
        ? createPortal(
            <div ref={painel} className="seletor-pessoas__painel" style={posicao}>
              <div className="seletor-pessoas__busca">
                <Search size={16} aria-hidden="true" />
                <input
                  type="search"
                  aria-label={`Buscar em ${rotulo}`}
                  placeholder="Buscar pelo nome"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="seletor-pessoas__lista" role="group" aria-label={rotulo}>
                {visiveis.length === 0 ? (
                  <p className="campo__ajuda seletor-pessoas__nada">
                    {opcoes.length === 0 ? vazio : 'Nenhum nome encontrado.'}
                  </p>
                ) : (
                  visiveis.map((o) => (
                    <label key={o.id} className="seletor-pessoas__linha">
                      <input
                        type="checkbox"
                        checked={valor.includes(o.id)}
                        onChange={(e) => alternar(o.id, e.target.checked)}
                      />
                      <Avatar nome={o.nome} id={o.id} temFoto={o.temFoto} pequeno />
                      <span className="seletor-pessoas__nome">{o.nome}</span>
                      {o.apoio ? <span className="seletor-pessoas__apoio">{o.apoio}</span> : null}
                    </label>
                  ))
                )}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
