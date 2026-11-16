import type { StatusDeDemanda } from '@gabinete/compartilhado';
import { CalendarClock } from 'lucide-react';
import { formatarPrazo } from './quadro';
import { GrupoDeAvatares, rotuloDosResponsaveis } from './responsaveis';
import { SeloDeAtraso, SeloDeStatus } from './situacao';

/** O principal da linha: o título (abre a ficha) e, abaixo, o apoio em cinza. */
export function CelulaDoItem({
  titulo,
  apoio,
  aoAbrir,
}: {
  titulo: string;
  apoio: ReadonlyArray<string | null>;
  aoAbrir: () => void;
}) {
  const partes = apoio.filter((p): p is string => Boolean(p));
  return (
    <div className="celula-item">
      <button type="button" className="link-botao celula-item__titulo" onClick={aoAbrir}>
        {titulo}
      </button>
      {partes.length > 0 ? (
        <span className="celula-item__apoio">
          {partes.map((p, i) => (
            <span key={i}>{p}</span>
          ))}
        </span>
      ) : null}
    </div>
  );
}

/** A etapa em texto, com o ponto do papel; só a situação que a etapa não diz (cancelada) vira selo. */
export function CelulaDaEtapa({
  nome,
  papel,
  status,
}: {
  nome: string;
  papel: 'entrada' | 'intermediaria' | 'conclusao' | 'arquivamento';
  status: StatusDeDemanda;
}) {
  return status === 'cancelada' ? (
    <SeloDeStatus status={status} />
  ) : (
    <span className="celula-etapa">
      <span className={`quadro__ponto quadro__ponto--${papel}`} aria-hidden="true" />
      {nome}
    </span>
  );
}

export function CelulaDoResponsavel({ nomes }: { nomes: readonly string[] }) {
  return (
    <span className="celula-responsavel" title={nomes.join(', ')}>
      <GrupoDeAvatares nomes={nomes} />
      {rotuloDosResponsaveis(nomes)}
    </span>
  );
}

export function CelulaDoPrazo({ prazo, atrasada }: { prazo: string | null; atrasada: boolean }) {
  if (!prazo) return atrasada ? <SeloDeAtraso /> : <span className="tabela__discreto">-</span>;
  return (
    <span className={`celula-prazo${atrasada ? ' celula-prazo--atrasado' : ''}`}>
      <CalendarClock size={14} aria-hidden="true" />
      {formatarPrazo(prazo)}
      {atrasada ? <SeloDeAtraso /> : null}
    </span>
  );
}
