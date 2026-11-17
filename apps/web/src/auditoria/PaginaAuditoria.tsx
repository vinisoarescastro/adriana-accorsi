import { History, X } from 'lucide-react';
import { useState } from 'react';
import { useAuditoria, useEquipe, useOpcoesDaAuditoria } from '../api/consultas';
import { CabecalhoDaPagina } from '../componentes/cabecalho';
import { EstadoVazio } from '../componentes/dicas';
import { EsqueletoDeTabela, Paginacao } from '../componentes/tabela';
import { AvisoDeErro, Botao } from '../componentes/ui';
import { LinhaDaTrilha } from './LinhaDaTrilha';
import { descricaoDaOperacao, nomeDaEntidade } from './rotulos-da-trilha';

/**
 * Auditoria: a trilha imutável do gabinete, da mais recente para a mais antiga. Filtra por entidade, operação,
 * pessoa e período; cada linha abre o antes e depois, campo a campo.
 */
export function PaginaAuditoria() {
  const [pagina, setPagina] = useState(1);
  const [operacao, setOperacao] = useState('');
  const [entidade, setEntidade] = useState('');
  const [autor, setAutor] = useState('');
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');
  const opcoes = useOpcoesDaAuditoria();
  const equipe = useEquipe();
  const { data, isLoading, error } = useAuditoria({
    pagina,
    operacao,
    entidade,
    autorId: autor ? Number(autor) : undefined,
    ...(de ? { de } : {}),
    ...(ate ? { ate } : {}),
  });

  const totalDePaginas = data ? Math.max(1, Math.ceil(data.total / data.porPagina)) : 1;
  const ativos = Boolean(operacao || entidade || autor || de || ate);
  const mudar = (definir: (v: string) => void) => (v: string) => {
    definir(v);
    setPagina(1);
  };
  const operacoes = (opcoes.data?.operacoes ?? []).filter(
    (o) => !entidade || o.startsWith(`${entidade}.`),
  );

  return (
    <section>
      <CabecalhoDaPagina
        titulo="Auditoria"
        descricao="Trilha imutável: ninguém altera nem apaga estes registros."
      />

      <form className="filtros" role="search" aria-label="Filtros da auditoria">
        <div className="filtros__controles">
          <select
            className="filtros__selecao"
            aria-label="Entidade"
            value={entidade}
            onChange={(e) => {
              mudar(setEntidade)(e.target.value);
              setOperacao('');
            }}
          >
            <option value="">Todas as entidades</option>
            {(opcoes.data?.entidades ?? []).map((e) => (
              <option key={e} value={e}>
                {nomeDaEntidade(e)}
              </option>
            ))}
          </select>
          <select
            className="filtros__selecao"
            aria-label="Operação"
            value={operacao}
            onChange={(e) => mudar(setOperacao)(e.target.value)}
          >
            <option value="">Todas as operações</option>
            {operacoes.map((o) => (
              <option key={o} value={o}>
                {nomeDaEntidade(o.split('.')[0] ?? o)} · {descricaoDaOperacao(o)} ({o})
              </option>
            ))}
          </select>
          <select
            className="filtros__selecao"
            aria-label="Quem"
            value={autor}
            onChange={(e) => mudar(setAutor)(e.target.value)}
          >
            <option value="">Todas as pessoas</option>
            {(equipe.data ?? []).map((u) => (
              <option key={u.id} value={u.id}>
                {u.nome}
              </option>
            ))}
          </select>
          <label className="filtros__data">
            <span>De</span>
            <input
              type="date"
              value={de}
              max={ate || undefined}
              onChange={(e) => mudar(setDe)(e.target.value)}
            />
          </label>
          <label className="filtros__data">
            <span>Até</span>
            <input
              type="date"
              value={ate}
              min={de || undefined}
              onChange={(e) => mudar(setAte)(e.target.value)}
            />
          </label>
        </div>
        <div className="filtros__fim">
          {ativos ? (
            <Botao
              variante="fantasma"
              pequeno
              icone={<X size={14} aria-hidden="true" />}
              onClick={() => {
                setOperacao('');
                setEntidade('');
                setAutor('');
                setDe('');
                setAte('');
                setPagina(1);
              }}
            >
              Limpar
            </Botao>
          ) : null}
        </div>
      </form>

      <AvisoDeErro erro={error} />
      {isLoading ? <EsqueletoDeTabela colunas={5} /> : null}

      {data && data.itens.length === 0 ? (
        <EstadoVazio
          icone={<History size={22} aria-hidden="true" />}
          titulo="Nenhum registro"
          texto="Nada na trilha com estes filtros."
        />
      ) : null}

      {data && data.itens.length > 0 ? (
        <div className="cartao cartao--tabela">
          <div className="tabela-rolavel">
            <table className="tabela tabela--trilha">
              <caption>
                {data.total} {data.total === 1 ? 'registro' : 'registros'} · página {data.pagina} de{' '}
                {totalDePaginas}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Quando</th>
                  <th scope="col">Quem</th>
                  <th scope="col">O que fez</th>
                  <th scope="col">Registro</th>
                  <th scope="col">
                    <span className="somente-leitor">Detalhes</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.itens.map((item) => (
                  <LinhaDaTrilha key={item.id} item={item} />
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
