import type { CargaDaPessoa } from '@gabinete/compartilhado';
import { nomeCurto } from '../formatos';
import { rotuloDoPerfil } from '../rotulos';

/**
 * Carga de trabalho por pessoa: uma barra por pessoa, em dois trechos separados por um fio da cor da
 * superfície (em dia, em cinza, e atrasadas, no vermelho da marca), com o total na ponta. A legenda
 * nomeia os trechos; o que cada pessoa concluiu no período vai em texto ao lado.
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
      <ul className="grafico__legenda" aria-label="Legenda">
        <li>
          <span
            className="grafico__chave"
            style={{ background: 'var(--chart-neutral)' }}
            aria-hidden="true"
          />
          Em dia
        </li>
        <li>
          <span
            className="grafico__chave"
            style={{ background: 'var(--chart-1)' }}
            aria-hidden="true"
          />
          Atrasadas
        </li>
      </ul>
      <ul className="carga__lista" aria-label="Demandas e tarefas em andamento por pessoa">
        {linhas.map((p) => {
          const emDia = p.total - p.atrasadas;
          const dica = `${p.nome}: ${p.demandasAbertas} demanda(s) e ${p.tarefasAbertas} tarefa(s) em andamento, ${p.atrasadas} atrasada(s); ${p.concluidasNoPeriodo} concluída(s) em ${periodoDias} dias`;
          return (
            <li key={p.id} className="carga__linha" title={dica}>
              <span className="carga__nome">
                {nomeCurto(p.nome)}
                <span className="carga__apoio">{rotuloDoPerfil[p.perfil]}</span>
              </span>
              <span className="carga__trilho" aria-hidden="true">
                <span className="carga__barra" style={{ width: `${(p.total / maximo) * 100}%` }}>
                  {emDia > 0 ? (
                    <span
                      className="carga__trecho carga__trecho--em-dia"
                      style={{ flexGrow: emDia }}
                    />
                  ) : null}
                  {p.atrasadas > 0 ? (
                    <span
                      className="carga__trecho carga__trecho--atrasada"
                      style={{ flexGrow: p.atrasadas }}
                    />
                  ) : null}
                </span>
              </span>
              <span className="carga__valor">
                {p.total}
                <span className="somente-leitor">
                  {' '}
                  em andamento, {p.atrasadas} atrasadas, {p.concluidasNoPeriodo} concluídas em{' '}
                  {periodoDias} dias
                </span>
              </span>
              <span className="carga__concluidas" aria-hidden="true">
                {p.concluidasNoPeriodo} concl.
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
