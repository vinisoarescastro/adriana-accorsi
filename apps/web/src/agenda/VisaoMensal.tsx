import type { ItemDaAgenda } from '@gabinete/compartilhado';
import { agruparPorDia, diasDoIntervalo, nomeCurtoDoDiaDaSemana, numeroDoDia } from './calendario';
import { CartaoDaAgenda, type AoAbrirItem } from './CartaoDaAgenda';

/** Mês em semanas (domingo a sábado). Todos os compromissos do dia aparecem na célula, sem esconder nenhum. */
export function VisaoMensal({
  inicio,
  fim,
  mes,
  hoje,
  itens,
  aoAbrir,
  aoEscolherDia,
}: {
  inicio: string;
  fim: string;
  /** Qualquer data do mês em foco (AAAA-MM-DD); o resto das células fica esmaecido. */
  mes: string;
  hoje: string;
  itens: readonly ItemDaAgenda[];
  aoAbrir: AoAbrirItem;
  aoEscolherDia: (dia: string) => void;
}) {
  const dias = diasDoIntervalo(inicio, fim);
  const grupos = agruparPorDia(itens);

  return (
    <div className="agenda-mes" role="group" aria-label="Mês">
      <div className="agenda-mes__semana">
        {dias.slice(0, 7).map((dia) => (
          <span key={dia} className="agenda-mes__titulo">
            {nomeCurtoDoDiaDaSemana(dia)}
          </span>
        ))}
      </div>
      <div className="agenda-mes__grade">
        {dias.map((dia) => {
          const doDia = grupos.get(dia) ?? [];
          const fora = dia.slice(0, 7) !== mes.slice(0, 7);
          return (
            <div
              key={dia}
              className={`agenda-mes__celula${fora ? ' agenda-mes__celula--fora' : ''}${dia === hoje ? ' agenda-mes__celula--hoje' : ''}`}
            >
              <button
                type="button"
                className="agenda-mes__numero"
                aria-label={`Ver a semana de ${numeroDoDia(dia)}`}
                onClick={() => aoEscolherDia(dia)}
              >
                {numeroDoDia(dia)}
              </button>
              <div className="agenda-mes__itens">
                {doDia.map((item, i) => (
                  <CartaoDaAgenda
                    key={`${item.tipo}-${item.inicio}-${i}`}
                    item={item}
                    aoAbrir={aoAbrir}
                    compacto
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
