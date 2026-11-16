import { useState } from 'react';
import { useAuditoria } from '../api/consultas';
import { CabecalhoDaPagina } from '../componentes/cabecalho';
import { BarraDeFerramentas, EsqueletoDeTabela, Paginacao } from '../componentes/tabela';
import { AvisoDeErro, Campo } from '../componentes/ui';
import { formatarDataHora } from '../formatos';

export function PaginaAuditoria() {
  const [pagina, setPagina] = useState(1);
  const [operacao, setOperacao] = useState('');
  const [entidade, setEntidade] = useState('');
  const { data, isLoading, error } = useAuditoria({ pagina, operacao, entidade });

  const totalDePaginas = data ? Math.max(1, Math.ceil(data.total / data.porPagina)) : 1;

  return (
    <section>
      <CabecalhoDaPagina
        titulo="Auditoria"
        descricao="Trilha imutável: ninguém altera nem apaga estes registros."
      />

      <BarraDeFerramentas rotulo="Filtros da auditoria" aoBuscar={() => setPagina(1)}>
        <Campo rotulo="Operação" ajuda="Por exemplo: equipe.criar">
          {(p) => (
            <input
              {...p}
              value={operacao}
              onChange={(e) => {
                setOperacao(e.target.value);
                setPagina(1);
              }}
            />
          )}
        </Campo>
        <Campo rotulo="Entidade" ajuda="Por exemplo: usuario">
          {(p) => (
            <input
              {...p}
              value={entidade}
              onChange={(e) => {
                setEntidade(e.target.value);
                setPagina(1);
              }}
            />
          )}
        </Campo>
      </BarraDeFerramentas>

      <AvisoDeErro erro={error} />
      {isLoading ? <EsqueletoDeTabela colunas={5} /> : null}

      {data ? (
        <div className="cartao cartao--tabela">
          <div className="tabela-rolavel">
            <table className="tabela">
              <caption>
                {data.total} registro(s), página {data.pagina} de {totalDePaginas}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Quando</th>
                  <th scope="col">Quem</th>
                  <th scope="col">Operação</th>
                  <th scope="col">Registro</th>
                  <th scope="col">Detalhes</th>
                </tr>
              </thead>
              <tbody>
                {data.itens.map((item) => (
                  <tr key={item.id}>
                    <td>{formatarDataHora(item.ocorridaEm)}</td>
                    <td>
                      {item.autorNome ??
                        (item.origem === 'comando' ? 'Comando de linha' : 'Sistema')}
                    </td>
                    <td>{item.operacao}</td>
                    <td>
                      {item.entidade}
                      {item.registroId ? ` #${item.registroId}` : ''}
                    </td>
                    <td>
                      {item.valorNovo || item.valorAnterior ? (
                        <details>
                          <summary>Ver</summary>
                          {item.valorAnterior ? (
                            <pre>Antes: {JSON.stringify(item.valorAnterior, null, 2)}</pre>
                          ) : null}
                          {item.valorNovo ? (
                            <pre>Depois: {JSON.stringify(item.valorNovo, null, 2)}</pre>
                          ) : null}
                        </details>
                      ) : (
                        '-'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Paginacao pagina={pagina} totalDePaginas={totalDePaginas} aoMudar={setPagina} />
        </div>
      ) : null}
    </section>
  );
}
