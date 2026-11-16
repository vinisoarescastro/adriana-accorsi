import type { ItemDaAgenda } from '@gabinete/compartilhado';
import { Lock, MapPin } from 'lucide-react';
import { useId, type CSSProperties } from 'react';
import { formatarHora } from '../formatos';
import { eDiaInteiro } from './calendario';

export type AoAbrirItem = (item: ItemDaAgenda) => void;

/**
 * Um item da agenda como cartão clicável. O nome acessível é só o título; o horário e o local ficam
 * como descrição. O horário ocupado de outra pessoa não revela nada e não abre.
 */
export function CartaoDaAgenda({
  item,
  aoAbrir,
  compacto,
  curto,
  estilo,
}: {
  item: ItemDaAgenda;
  aoAbrir: AoAbrirItem;
  compacto?: boolean;
  /** Evento de até 45 minutos: título e horário na mesma linha. */
  curto?: boolean;
  estilo?: CSSProperties;
}) {
  const id = useId();
  const hora = eDiaInteiro(item)
    ? 'Dia inteiro'
    : `${formatarHora(item.inicio)} às ${formatarHora(item.fim)}`;
  const classe = `agenda-cartao agenda-cartao--${item.tipo}${compacto ? ' agenda-cartao--compacto' : ''}${curto ? ' agenda-cartao--curto' : ''}`;

  if (item.tipo === 'ocupado') {
    return (
      <div className={classe} style={estilo}>
        <span className="agenda-cartao__titulo">Horário ocupado</span>
        <span className="agenda-cartao__hora">{hora}</span>
      </div>
    );
  }

  const titulo = item.tipo === 'compromisso' ? item.titulo : 'Indisponível';
  const local = item.tipo === 'compromisso' ? item.local : null;
  return (
    <button
      type="button"
      className={`${classe}${item.tipo === 'compromisso' && item.cancelado ? ' agenda-cartao--cancelado' : ''}`}
      style={estilo}
      title={[titulo, hora, local].filter(Boolean).join(' · ')}
      aria-labelledby={`${id}-t`}
      aria-describedby={`${id}-h`}
      onClick={() => aoAbrir(item)}
    >
      <span id={`${id}-t`} className="agenda-cartao__titulo">
        {item.tipo === 'bloqueio' ? <Lock size={12} aria-hidden="true" /> : null}
        {titulo}
      </span>
      <span id={`${id}-h`} className="agenda-cartao__hora">
        {hora}
      </span>
      {local && !compacto ? (
        <span className="agenda-cartao__local">
          <MapPin size={12} aria-hidden="true" /> {local}
        </span>
      ) : null}
    </button>
  );
}
