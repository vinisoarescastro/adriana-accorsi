import { formatarReais, type ReconstituicaoDeEmendas } from '@gabinete/compartilhado';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { chamar } from '../api/cliente';
import { Modal } from '../componentes/modal';
import { AvisoDeErro, Campo, Carregando } from '../componentes/ui';
import { hojeNoGabinete } from '../formatos';

/** Os valores das emendas como eram numa data passada (Administrador e Parlamentar). A mesma conta de hoje. */
export function ReconstituirEmendas({ aoFechar }: { aoFechar: () => void }) {
  const [dia, setDia] = useState(hojeNoGabinete());
  const { data, isLoading, error } = useQuery({
    queryKey: ['financeiro', 'reconstituicao-de-emendas', dia],
    enabled: /^\d{4}-\d{2}-\d{2}$/.test(dia),
    queryFn: () => chamar<ReconstituicaoDeEmendas>('GET', `/api/emendas/reconstituicao?em=${dia}`),
  });
  return (
    <Modal
      titulo="Valores das emendas em uma data"
      descricao="O que valia no fim do dia escolhido."
      tamanho="lg"
      aoFechar={aoFechar}
    >
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
      <AvisoDeErro erro={error} />
      {isLoading ? <Carregando /> : null}
      {data ? (
        <div className="tabela-rolavel">
          <table className="tabela">
            <caption className="somente-leitor">Valores das emendas em {dia}</caption>
            <thead>
              <tr>
                <th scope="col">Emenda</th>
                <th scope="col" className="e-numero">
                  Disponibilizado
                </th>
                <th scope="col" className="e-numero">
                  Comprometido
                </th>
                <th scope="col" className="e-numero">
                  Utilizado
                </th>
                <th scope="col" className="e-numero">
                  Disponível
                </th>
              </tr>
            </thead>
            <tbody>
              {data.itens.map((i) => (
                <tr key={i.id}>
                  <td>
                    {i.identificacao} · {i.exercicio}
                  </td>
                  <td className="e-numero">{formatarReais(i.valores.disponibilizado)}</td>
                  <td className="e-numero">{formatarReais(i.valores.comprometido)}</td>
                  <td className="e-numero">{formatarReais(i.valores.utilizado)}</td>
                  <td className="e-numero">{formatarReais(i.valores.disponivel)}</td>
                </tr>
              ))}
              <tr>
                <th scope="row">Total</th>
                <td className="e-numero">{formatarReais(data.total.disponibilizado)}</td>
                <td className="e-numero">{formatarReais(data.total.comprometido)}</td>
                <td className="e-numero">{formatarReais(data.total.utilizado)}</td>
                <td className="e-numero">{formatarReais(data.total.disponivel)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : null}
    </Modal>
  );
}
