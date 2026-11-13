import { estadosDeEnvio, type EstadoDeEnvioDto } from '@gabinete/compartilhado';
import { useState } from 'react';
import { useFilaDeEmails } from '../api/cidadao';
import { AvisoDeErro, Botao, Campo, Carregando, Selo } from '../componentes/ui';
import { formatarDataHora } from '../formatos';
import { rotuloDoEstadoDeEnvio, rotuloDoEventoDeEmail } from '../rotulos';

/**
 * Fila de e-mails ao cidadão (Supervisor em diante): o que foi enviado, o que falhou e o que foi
 * cancelado, com o motivo. Não mostra o endereço de e-mail nem o conteúdo: só o protocolo.
 */
export function PaginaEmails() {
  const [estado, setEstado] = useState<EstadoDeEnvioDto | ''>('');
  const [pagina, setPagina] = useState(1);
  const { data, isLoading, error } = useFilaDeEmails({ pagina, estado });
  const totalDePaginas = data ? Math.max(1, Math.ceil(data.total / data.porPagina)) : 1;

  return (
    <section>
      <h1>E-mails ao cidadão</h1>
      <p>
        Os avisos de andamento enviados a quem autorizou. Uma falha de envio nunca desfaz o ato que
        a gerou: o envio é repetido, e o resultado aparece aqui.
      </p>

      {data ? (
        <ul className="resumo-da-fila" aria-label="Resumo por situação">
          {estadosDeEnvio.map((e) => (
            <li key={e}>
              <strong>{data.porEstado[e]}</strong> {rotuloDoEstadoDeEnvio[e].toLowerCase()}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="cartao">
        <Campo rotulo="Situação">
          {(p) => (
            <select
              {...p}
              value={estado}
              onChange={(e) => {
                setEstado(e.target.value as EstadoDeEnvioDto | '');
                setPagina(1);
              }}
            >
              <option value="">Todas</option>
              {estadosDeEnvio.map((e) => (
                <option key={e} value={e}>
                  {rotuloDoEstadoDeEnvio[e]}
                </option>
              ))}
            </select>
          )}
        </Campo>
      </div>

      <AvisoDeErro erro={error} />
      {isLoading ? <Carregando /> : null}
      {data ? (
        <div className="cartao tabela-rolavel">
          <table className="tabela">
            <caption>
              {data.total} e-mail(s), página {data.pagina} de {totalDePaginas}
            </caption>
            <thead>
              <tr>
                <th scope="col">Protocolo</th>
                <th scope="col">Motivo do e-mail</th>
                <th scope="col">Situação</th>
                <th scope="col">Tentativas</th>
                <th scope="col">Quando</th>
                <th scope="col">Observação</th>
              </tr>
            </thead>
            <tbody>
              {data.itens.map((i) => (
                <tr key={i.id}>
                  <td>{i.protocolo}</td>
                  <td>{rotuloDoEventoDeEmail[i.evento]}</td>
                  <td>
                    <Selo tipo={i.estado === 'enviado' ? 'ativo' : 'inativo'}>
                      {rotuloDoEstadoDeEnvio[i.estado]}
                    </Selo>
                  </td>
                  <td>{i.tentativas}</td>
                  <td>
                    {i.enviadoEm
                      ? `Enviado em ${formatarDataHora(i.enviadoEm)}`
                      : i.proximaTentativa
                        ? `Próxima tentativa em ${formatarDataHora(i.proximaTentativa)}`
                        : `Criado em ${formatarDataHora(i.criadoEm)}`}
                  </td>
                  <td>{i.erro ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.itens.length === 0 ? <p>Nenhum e-mail encontrado.</p> : null}
          <div className="acoes" style={{ marginTop: 'var(--espaco-4)' }}>
            <Botao
              variante="secundario"
              onClick={() => setPagina((p) => p - 1)}
              disabled={pagina <= 1}
            >
              Anterior
            </Botao>
            <Botao
              variante="secundario"
              onClick={() => setPagina((p) => p + 1)}
              disabled={pagina >= totalDePaginas}
            >
              Próxima
            </Botao>
          </div>
        </div>
      ) : null}
    </section>
  );
}
