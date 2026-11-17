import type { PendenciasDoUsuario } from '@gabinete/compartilhado';
import { AlarmClock, CalendarClock, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { Abas } from '../componentes/abas';
import { formatarPrazo } from '../componentes/quadro';

type Aba = 'tarefas' | 'demandas';

/** O prazo em texto, com a palavra "atrasada" quando vencido: nada depende só da cor. */
function Prazo({ prazo, atrasada }: { prazo: string | null; atrasada: boolean }) {
  if (!prazo) return <span className="pendencia__prazo">Sem prazo</span>;
  return (
    <span className={`pendencia__prazo${atrasada ? ' pendencia__prazo--atrasada' : ''}`}>
      {atrasada ? (
        <AlarmClock size={13} aria-hidden="true" />
      ) : (
        <CalendarClock size={13} aria-hidden="true" />
      )}
      {formatarPrazo(prazo)}
      {atrasada ? ' (atrasada)' : ''}
    </span>
  );
}

/**
 * O que está na mão do usuário agora: as tarefas e, com atendimento, as demandas em andamento. As
 * atrasadas vêm primeiro, depois as de prazo mais próximo; cada uma abre a ficha.
 */
export function MinhasPendencias({ dados }: { dados: PendenciasDoUsuario }) {
  const temDemandas = dados.demandas !== null;
  // Abre na aba que tem o que fazer: as tarefas, ou as demandas se só elas tiverem algo.
  const [aba, setAba] = useState<Aba>(
    dados.totalDeTarefas === 0 && dados.totalDeDemandas > 0 ? 'demandas' : 'tarefas',
  );
  const mostrando: Aba = temDemandas ? aba : 'tarefas';

  return (
    <div className="pendencias">
      {temDemandas ? (
        <Abas
          segmentada
          rotulo="O que está com você"
          valor={mostrando}
          aoMudar={setAba}
          itens={[
            { id: 'tarefas', rotulo: `Tarefas (${dados.totalDeTarefas})` },
            { id: 'demandas', rotulo: `Demandas (${dados.totalDeDemandas})` },
          ]}
        />
      ) : null}

      {mostrando === 'tarefas' ? (
        dados.tarefas.length === 0 ? (
          <p className="pendencias__vazio">
            <CheckCircle2 size={18} aria-hidden="true" />
            Nenhuma tarefa em andamento com você.
          </p>
        ) : (
          <ul className="pendencias__lista">
            {dados.tarefas.map((t) => (
              <li key={t.id}>
                <Link to={`/g/tarefas?tarefa=${t.id}`} className="pendencia">
                  <span className="pendencia__titulo">{t.titulo}</span>
                  <span className="pendencia__meta">
                    {t.etapa} · <Prazo prazo={t.prazo} atrasada={t.atrasada} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )
      ) : (dados.demandas ?? []).length === 0 ? (
        <p className="pendencias__vazio">
          <CheckCircle2 size={18} aria-hidden="true" />
          Nenhuma demanda em andamento com você.
        </p>
      ) : (
        <ul className="pendencias__lista">
          {(dados.demandas ?? []).map((d) => (
            <li key={d.id}>
              <Link to={`/g/demandas?demanda=${d.id}`} className="pendencia">
                <span className="pendencia__titulo">{d.titulo}</span>
                <span className="pendencia__meta">
                  {d.protocolo} · {d.etapa} · <Prazo prazo={d.prazo} atrasada={d.atrasada} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Link
        className="pendencias__todas"
        to={
          mostrando === 'tarefas'
            ? '/g/tarefas?status=em_andamento&minhas=true'
            : '/g/demandas?status=em_andamento'
        }
      >
        Ver {mostrando === 'tarefas' ? 'todas as minhas tarefas' : 'as demandas em andamento'}
      </Link>
    </div>
  );
}
