import type { CargaDaPessoa } from '@gabinete/compartilhado';
import { iniciais, nomeCurto } from '../formatos';
import { rotuloDoPerfil } from '../rotulos';

/**
 * Carga de trabalho por pessoa. Cada linha tem o avatar, o nome e o perfil, uma barra com dois trechos (demandas e
 * tarefas em andamento, na mesma escala para todos), o total e, à direita, quantas estão atrasadas e quantas a
 * pessoa concluiu no período. Tudo vai também em texto, então nada depende da cor.
 */
export function CargaDaEquipe({
  pessoas,
  periodoDias,
}: {
  pessoas: readonly CargaDaPessoa[];
  periodoDias: number;
}) {
  const linhas = pessoas
    .map((p) => ({ ...p, total: p.demandasAbertas + p.tarefasAbertas }))
    .filter((p) => p.total > 0 || p.concluidasNoPeriodo > 0)
    .sort((a, b) => b.total - a.total || b.concluidasNoPeriodo - a.concluidasNoPeriodo)
    .slice(0, 8);
  const maximo = Math.max(1, ...linhas.map((p) => p.total));

  if (linhas.length === 0)
    return <p className="campo__ajuda">Ninguém tem trabalho em andamento.</p>;
  return (
    <div className="carga">
      <ul className="grafico__legenda" aria-label="Legenda: carga da equipe">
        <li>
          <span
            className="grafico__chave"
            style={{ background: 'var(--chart-2)' }}
            aria-hidden="true"
          />
          Demandas
        </li>
        <li>
          <span
            className="grafico__chave"
            style={{ background: 'var(--chart-1)' }}
            aria-hidden="true"
          />
          Tarefas
        </li>
      </ul>
      <ul className="carga__lista" aria-label="Demandas e tarefas em andamento por pessoa">
        {linhas.map((p) => {
          const dica = `${p.nome}: ${p.demandasAbertas} demanda(s) e ${p.tarefasAbertas} tarefa(s) em andamento, ${p.atrasadas} atrasada(s); ${p.concluidasNoPeriodo} concluída(s) em ${periodoDias} dias`;
          return (
            <li key={p.id} className="carga__linha" title={dica}>
              <span className="carga__avatar" aria-hidden="true">
                {iniciais(p.nome)}
              </span>
              <span className="carga__nome">
                {nomeCurto(p.nome)}
                <span className="carga__apoio">{rotuloDoPerfil[p.perfil]}</span>
              </span>
              <span className="carga__trilho" aria-hidden="true">
                <span className="carga__barra" style={{ width: `${(p.total / maximo) * 100}%` }}>
                  {p.demandasAbertas > 0 ? (
                    <span
                      className="carga__trecho carga__trecho--demandas"
                      style={{ flexGrow: p.demandasAbertas }}
                    />
                  ) : null}
                  {p.tarefasAbertas > 0 ? (
                    <span
                      className="carga__trecho carga__trecho--tarefas"
                      style={{ flexGrow: p.tarefasAbertas }}
                    />
                  ) : null}
                </span>
              </span>
              <span className="carga__valor">
                {p.total}
                <span className="somente-leitor">
                  {' '}
                  em andamento ({p.demandasAbertas} demandas e {p.tarefasAbertas} tarefas),{' '}
                  {p.atrasadas} atrasadas, {p.concluidasNoPeriodo} concluídas em {periodoDias} dias
                </span>
              </span>
              <span className="carga__notas" aria-hidden="true">
                {p.atrasadas > 0 ? (
                  <span className="carga__atrasadas">{p.atrasadas} atras.</span>
                ) : null}
                <span>{p.concluidasNoPeriodo} concl.</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
