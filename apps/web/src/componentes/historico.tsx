import type { MovimentacaoDto } from '@gabinete/compartilhado';
import { formatarDataHora } from '../formatos';

/**
 * Histórico de movimentações em linha do tempo: cada passagem de etapa com quem fez e quando, e a
 * observação (se houver) logo abaixo. A mais recente fica em cima. Nada é cortado: o texto quebra.
 */
export function Historico({
  movimentacoes,
  inicio,
}: {
  movimentacoes: readonly MovimentacaoDto[];
  /** Como aparece a primeira entrada (sem etapa de origem), por exemplo "Registrada em". */
  inicio: string;
}) {
  if (movimentacoes.length === 0)
    return <p className="campo__ajuda">Nenhuma movimentação ainda.</p>;
  return (
    <ol className="historico">
      {[...movimentacoes].reverse().map((m) => (
        <li key={m.id} className="historico__item">
          <span className="historico__ponto" aria-hidden="true" />
          <div className="historico__conteudo">
            <span className="historico__titulo">
              {m.de ? `${m.de} → ` : `${inicio} `}
              <strong>{m.para}</strong>
            </span>
            <span className="historico__meta">
              por {m.autor} · {formatarDataHora(m.criadaEm)}
            </span>
            {m.observacao ? <span className="historico__obs">{m.observacao}</span> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
