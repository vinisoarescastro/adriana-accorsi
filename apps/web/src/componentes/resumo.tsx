import { CalendarClock, Phone, UserRound } from 'lucide-react';
import { nomeCurto } from '../formatos';
import { GrupoDeAvatares } from './responsaveis';
import { formatarPrazo } from './quadro';

/**
 * Dados-chave sempre à vista no topo da ficha. Na demanda, o solicitante vem primeiro (nome, que abre
 * a ficha da pessoa, e telefone); depois o responsável e o prazo.
 */
export function ResumoDaFicha({
  responsaveis,
  prazo,
  atrasada,
  solicitante,
}: {
  /** O principal primeiro; todos com nome completo (a tela mostra só o primeiro e o segundo nome). */
  responsaveis: readonly string[];
  prazo: string | null;
  atrasada: boolean;
  solicitante?:
    | {
        nome: string;
        telefone?: string | null;
        /** Abre a ficha da pessoa; sem isto, o nome é só texto. */
        aoAbrir?: () => void;
      }
    | undefined;
}) {
  return (
    <ul className="ficha-resumo" aria-label="Resumo">
      {solicitante ? (
        <li className="ficha-resumo__solicitante">
          <UserRound size={14} aria-hidden="true" />
          <span className="somente-leitor">Solicitante: </span>
          {solicitante.aoAbrir ? (
            <button
              type="button"
              className="link-botao"
              aria-label={`Abrir a ficha de ${solicitante.nome}`}
              onClick={solicitante.aoAbrir}
            >
              {solicitante.nome}
            </button>
          ) : (
            <strong>{solicitante.nome}</strong>
          )}
          {solicitante.telefone ? (
            <span className="ficha-resumo__telefone">
              <Phone size={12} aria-hidden="true" />
              {solicitante.telefone}
            </span>
          ) : null}
        </li>
      ) : null}
      <li title={responsaveis.join(', ')}>
        <GrupoDeAvatares nomes={responsaveis} />
        <span className="somente-leitor">
          {responsaveis.length > 1 ? 'Responsáveis' : 'Responsável'}:{' '}
        </span>
        {responsaveis.map(nomeCurto).join(', ')}
      </li>
      <li className={atrasada ? 'ficha-resumo__atrasado' : undefined}>
        <CalendarClock size={14} aria-hidden="true" />
        <span className="somente-leitor">Prazo: </span>
        {prazo ? formatarPrazo(prazo) : 'Sem prazo'}
      </li>
    </ul>
  );
}
