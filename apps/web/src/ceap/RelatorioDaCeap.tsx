import { pode } from '@gabinete/autorizacao';
import {
  formatarReais,
  type RelatorioDaCeap,
  type RespostaDaSessao,
  type SaldoDaCeap,
} from '@gabinete/compartilhado';
import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { useState } from 'react';
import { chamar } from '../api/cliente';
import { formatarPrazo } from '../componentes/quadro';
import { Aviso, AvisoDeErro, Campo, Carregando } from '../componentes/ui';
import { hojeNoGabinete } from '../formatos';
import { nomesDosMeses, rotuloDoStatusDaDespesa } from '../rotulos';

/** Relatório de prestação de contas e pacote de comprovantes por período de competências (Chefe em diante); reconstituição do saldo (Administrador e Parlamentar). */
export function RelatorioDaCeap({ sessao }: { sessao: RespostaDaSessao }) {
  const autoridade = { perfil: sessao.usuario.perfil, habilitacoes: sessao.usuario.habilitacoes };
  const ano = hojeNoGabinete().slice(0, 4);
  const [de, setDe] = useState(`${ano}-01`);
  const [ate, setAte] = useState(hojeNoGabinete().slice(0, 7));
  const [dia, setDia] = useState(hojeNoGabinete());
  const periodoOk = /^\d{4}-\d{2}$/.test(de) && /^\d{4}-\d{2}$/.test(ate) && de <= ate;
  const relatorio = useQuery({
    queryKey: ['financeiro', 'relatorio', de, ate],
    enabled: periodoOk,
    queryFn: () => chamar<RelatorioDaCeap>('GET', `/api/ceap/relatorio?de=${de}&ate=${ate}`),
  });
  const reconstituicao = useQuery({
    queryKey: ['financeiro', 'reconstituicao-da-ceap', dia],
    enabled: pode('ceap.reconstituir', autoridade) && /^\d{4}-\d{2}-\d{2}$/.test(dia),
    queryFn: () => chamar<SaldoDaCeap>('GET', `/api/ceap/reconstituicao?em=${dia}`),
  });
  const r = relatorio.data;

  return (
    <div className="painel">
      <div className="cartao">
        <h2 className="cartao__titulo">Relatório de prestação de contas</h2>
        <div className="grade-formulario">
          <Campo rotulo="De (competência)">
            {(p) => (
              <input {...p} type="month" value={de} onChange={(e) => setDe(e.target.value)} />
            )}
          </Campo>
          <Campo rotulo="Até (competência)">
            {(p) => (
              <input {...p} type="month" value={ate} onChange={(e) => setAte(e.target.value)} />
            )}
          </Campo>
        </div>
        {periodoOk ? (
          <a className="botao botao--secundario" href={`/api/ceap/pacote?de=${de}&ate=${ate}`}>
            <Download size={16} aria-hidden="true" /> Baixar o pacote (ZIP com a relação e os
            comprovantes)
          </a>
        ) : (
          <Aviso tipo="atencao" titulo="Período inválido: o início não pode ser depois do fim." />
        )}
        <AvisoDeErro erro={relatorio.error} />
        {relatorio.isLoading ? <Carregando /> : null}
        {r ? (
          <>
            <p>
              Total que consome saldo no período: <strong>{formatarReais(r.total)}</strong> em{' '}
              {r.despesas.length} despesa(s).
            </p>
            <div className="tabela-rolavel">
              <table className="tabela">
                <caption>Por categoria</caption>
                <thead>
                  <tr>
                    <th scope="col">Categoria</th>
                    <th scope="col" className="e-numero">
                      Despesas
                    </th>
                    <th scope="col" className="e-numero">
                      Valor
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {r.porCategoria.map((c) => (
                    <tr key={c.nome}>
                      <td>{c.nome}</td>
                      <td className="e-numero">{c.quantidade}</td>
                      <td className="e-numero">{formatarReais(c.valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="tabela-rolavel">
              <table className="tabela">
                <caption>Por situação</caption>
                <tbody>
                  {r.porStatus.map((s) => (
                    <tr key={s.status}>
                      <td>{rotuloDoStatusDaDespesa[s.status]}</td>
                      <td className="e-numero">{s.quantidade}</td>
                      <td className="e-numero">{formatarReais(s.valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {[
              ['Decididas por quem as lançou', r.decididasPeloLancador],
              ['Fora do prazo de apresentação', r.foraDoPrazo],
              ['Sem comprovante', r.semComprovante],
            ].map(([titulo, lista]) => {
              const itens = lista as RelatorioDaCeap['despesas'];
              return (
                <section key={titulo as string} aria-label={titulo as string}>
                  <h3>
                    {titulo as string} ({itens.length})
                  </h3>
                  {itens.length === 0 ? (
                    <p className="campo__ajuda">Nenhuma.</p>
                  ) : (
                    <ul className="lista-simples">
                      {itens.map((d) => (
                        <li key={d.id}>
                          {formatarPrazo(d.dataDocumento)} · {d.descricao} ·{' '}
                          <strong>{formatarReais(d.valor)}</strong>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </>
        ) : null}
      </div>

      {pode('ceap.reconstituir', autoridade) ? (
        <div className="cartao">
          <h2 className="cartao__titulo">Saldo em uma data passada</h2>
          <Campo rotulo="Data">
            {(p) => (
              <input
                {...p}
                type="date"
                max={hojeNoGabinete()}
                value={dia}
                onChange={(e) => setDia(e.target.value)}
              />
            )}
          </Campo>
          <AvisoDeErro erro={reconstituicao.error} />
          {reconstituicao.data ? (
            <p>
              Em <strong>{formatarPrazo(reconstituicao.data.em)}</strong> o saldo acumulado de{' '}
              {nomesDosMeses[reconstituicao.data.mesDeReferencia - 1]} era{' '}
              <strong>{formatarReais(reconstituicao.data.saldoAtual)}</strong>, com{' '}
              {reconstituicao.data.aguardandoAnalise} despesa(s) aguardando análise. A conta é a
              mesma de hoje, com as regras e os lançamentos daquela data.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
