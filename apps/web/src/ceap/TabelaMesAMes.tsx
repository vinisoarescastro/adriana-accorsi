import { deCentavos, formatarReais, paraCentavos, type SaldoDaCeap } from '@gabinete/compartilhado';
import { Botao, Selo } from '../componentes/ui';
import { nomesDosMeses } from '../rotulos';

const centavos = (v: string | null) => paraCentavos(v ?? '0') ?? 0;

/**
 * O exercício mês a mês: cota, consumido, o que ficou sem consumir no mês e o consumo acumulado no ano. No rodapé, os totais do exercício. Os meses que
 * ainda não chegaram aparecem esmaecidos: já têm cota, mas ainda não têm consumo.
 */
export function TabelaMesAMes({
  saldo,
  podeEncerrar,
  ocupado,
  aoAlterar,
}: {
  saldo: SaldoDaCeap;
  podeEncerrar: boolean;
  ocupado: boolean;
  aoAlterar: (mes: number, acao: 'encerrar' | 'reabrir') => void;
}) {
  const totalDaCota = saldo.meses.reduce((s, m) => s + centavos(m.cota), 0);
  const totalConsumido = saldo.meses.reduce((s, m) => s + centavos(m.consumido), 0);
  const semConsumir = totalDaCota - totalConsumido;
  const percentual = totalDaCota > 0 ? Math.round((totalConsumido / totalDaCota) * 100) : null;

  return (
    <div className="cartao cartao--tabela">
      <div className="tabela-rolavel">
        <table className="tabela tabela--mensal">
          <caption>
            Mês a mês em {saldo.ano}
            <span className="tabela__discreto">
              {' '}
              · o saldo acumula dentro do exercício e não passa ao seguinte
            </span>
          </caption>
          <thead>
            <tr>
              <th scope="col">Mês</th>
              <th scope="col" className="e-numero">
                Cota
              </th>
              <th scope="col" className="e-numero">
                Consumido
              </th>
              <th scope="col" className="e-numero">
                Sem consumir
              </th>
              <th scope="col" className="e-numero">
                Consumido no ano
              </th>
              <th scope="col">Competência</th>
            </tr>
          </thead>
          <tbody>
            {saldo.meses.map((m) => {
              const futuro = m.mes > saldo.mesDeReferencia;
              const sobra = m.cota === null ? null : centavos(m.cota) - centavos(m.consumido);
              return (
                <tr key={m.mes} className={futuro ? 'tabela__futuro' : undefined}>
                  <th scope="row">{nomesDosMeses[m.mes - 1]}</th>
                  <td className="e-numero">
                    {m.cota ? (
                      formatarReais(m.cota)
                    ) : (
                      <span className="tabela__discreto">sem cota</span>
                    )}
                  </td>
                  <td className="e-numero">{formatarReais(m.consumido)}</td>
                  <td
                    className={`e-numero${sobra !== null && sobra < 0 ? ' tabela__negativo' : ''}`}
                  >
                    {sobra === null ? (
                      <span className="tabela__discreto">—</span>
                    ) : (
                      formatarReais(deCentavos(sobra))
                    )}
                  </td>
                  <td className="e-numero">{formatarReais(m.consumidoAcumulado)}</td>
                  <td>
                    {m.encerrada ? (
                      <Selo tom="neutro">Encerrada</Selo>
                    ) : (
                      <span className="tabela__discreto">Aberta</span>
                    )}{' '}
                    {podeEncerrar ? (
                      <Botao
                        pequeno
                        variante="fantasma"
                        carregando={ocupado}
                        onClick={() => aoAlterar(m.mes, m.encerrada ? 'reabrir' : 'encerrar')}
                      >
                        {m.encerrada ? 'Reabrir' : 'Encerrar'}
                      </Botao>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Total do exercício</th>
              <td className="e-numero">{formatarReais(deCentavos(totalDaCota))}</td>
              <td className="e-numero">{formatarReais(deCentavos(totalConsumido))}</td>
              <td className="e-numero">{formatarReais(deCentavos(semConsumir))}</td>
              <td className="e-numero">
                {percentual === null ? (
                  <span className="tabela__discreto">—</span>
                ) : (
                  `${percentual}% da cota`
                )}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
