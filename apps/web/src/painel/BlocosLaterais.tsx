import type { AtividadeRecente, AvisoDto, ItemDaAgenda } from '@gabinete/compartilhado';
import { Bell, CalendarClock, CalendarX, FileText, Landmark, ListChecks, Lock } from 'lucide-react';
import { Link } from 'react-router';
import { destinoDoAviso } from '../avisos/SinoDeAvisos';
import { formatarDataHora, formatarHora } from '../formatos';

const fusoDoGabinete = 'America/Sao_Paulo';
const diaDaSemana = new Intl.DateTimeFormat('pt-BR', {
  timeZone: fusoDoGabinete,
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
});

/** Os próximos compromissos que o usuário pode ver. O que ele não vê por inteiro aparece só como horário ocupado. */
export function ProximosCompromissos({ itens }: { itens: readonly ItemDaAgenda[] }) {
  if (itens.length === 0) {
    return <p className="campo__ajuda">Nenhum compromisso marcado pela frente.</p>;
  }
  return (
    <ul className="lista-painel">
      {itens.map((item, i) => {
        if (item.tipo === 'compromisso') {
          return (
            <li key={`c${item.id}`}>
              <Link className="lista-painel__item" to={`/g/agenda?compromisso=${item.id}`}>
                <span className="lista-painel__icone" aria-hidden="true">
                  <CalendarClock size={16} />
                </span>
                <span className="lista-painel__corpo">
                  <span className="lista-painel__titulo">{item.titulo}</span>
                  <span className="lista-painel__meta">
                    {diaDaSemana.format(new Date(item.inicio))}
                    {item.diaInteiro ? ' · dia inteiro' : ` · ${formatarHora(item.inicio)}`}
                    {item.local ? ` · ${item.local}` : ''}
                  </span>
                </span>
              </Link>
            </li>
          );
        }
        return (
          <li key={`o${i}`}>
            <span className="lista-painel__item lista-painel__item--discreto">
              <span className="lista-painel__icone" aria-hidden="true">
                {item.tipo === 'bloqueio' ? <CalendarX size={16} /> : <Lock size={16} />}
              </span>
              <span className="lista-painel__corpo">
                <span className="lista-painel__titulo">
                  {item.tipo === 'bloqueio' ? 'Indisponível' : 'Horário ocupado'}
                </span>
                <span className="lista-painel__meta">
                  {diaDaSemana.format(new Date(item.inicio))}
                  {'diaInteiro' in item && item.diaInteiro
                    ? ' · dia inteiro'
                    : ` · ${formatarHora(item.inicio)}`}
                </span>
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Os avisos mais recentes do sino, os não lidos marcados em texto ("Novo"). */
export function AvisosDoPainel({
  itens,
  naoLidos,
}: {
  itens: readonly AvisoDto[];
  naoLidos: number;
}) {
  const ultimos = itens.slice(0, 5);
  if (ultimos.length === 0) return <p className="campo__ajuda">Você não tem avisos.</p>;
  return (
    <>
      <p className="campo__ajuda">
        {naoLidos > 0 ? `${naoLidos} não lido(s). ` : 'Tudo lido. '}Eles também ficam no sino, no
        alto da página.
      </p>
      <ul className="lista-painel">
        {ultimos.map((a) => {
          const destino = destinoDoAviso(a);
          const corpo = (
            <>
              <span className="lista-painel__icone" aria-hidden="true">
                <Bell size={16} />
              </span>
              <span className="lista-painel__corpo">
                <span className="lista-painel__titulo">
                  {!a.lido ? <span className="lista-painel__novo">Novo</span> : null}
                  {a.frase}
                </span>
                <span className="lista-painel__meta">
                  {a.registro.titulo ? `${a.registro.titulo} · ` : ''}
                  {formatarDataHora(a.geradoEm)}
                </span>
              </span>
            </>
          );
          return (
            <li key={a.id}>
              {destino ? (
                <Link className="lista-painel__item" to={destino}>
                  {corpo}
                </Link>
              ) : (
                <span className="lista-painel__item lista-painel__item--discreto">{corpo}</span>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}

const iconeDoTipo = { demanda: FileText, tarefa: ListChecks, projeto_lei: Landmark } as const;
const paginaDoTipo = {
  demanda: (id: number) => `/g/demandas?demanda=${id}`,
  tarefa: (id: number) => `/g/tarefas?tarefa=${id}`,
  projeto_lei: (id: number) => `/g/projetos?projeto=${id}`,
} as const;
const nomeDoTipo = { demanda: 'Demanda', tarefa: 'Tarefa', projeto_lei: 'Projeto' } as const;

/** O que andou por último nos registros que o usuário alcança: quem moveu o quê, e para onde. */
export function AtividadeDoPainel({ itens }: { itens: readonly AtividadeRecente[] }) {
  if (itens.length === 0) return <p className="campo__ajuda">Nada se movimentou ainda.</p>;
  return (
    <ul className="lista-painel">
      {itens.map((a) => {
        const Icone = iconeDoTipo[a.tipo];
        return (
          <li key={`${a.tipo}-${a.id}`}>
            <Link className="lista-painel__item" to={paginaDoTipo[a.tipo](a.registroId)}>
              <span className="lista-painel__icone" aria-hidden="true">
                <Icone size={16} />
              </span>
              <span className="lista-painel__corpo">
                <span className="lista-painel__titulo">{a.titulo}</span>
                <span className="lista-painel__meta">
                  {nomeDoTipo[a.tipo]} → {a.etapa} · {a.autor} · {formatarDataHora(a.em)}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
