import {
  statusDeTarefa,
  type RespostaDaSessao,
  type StatusDeTarefa,
} from '@gabinete/compartilhado';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { useTarefas } from '../api/trabalho';
import { ListChecks, Plus, Search } from 'lucide-react';
import { CabecalhoDaPagina } from '../componentes/cabecalho';
import { EstadoVazio } from '../componentes/dicas';
import { SeloDeAtraso, SeloDePrioridade, SeloDeStatus } from '../componentes/situacao';
import { BarraDeFerramentas, EsqueletoDeTabela, Paginacao } from '../componentes/tabela';
import { AvisoDeErro, Botao, Campo } from '../componentes/ui';
import { rotuloDoStatus } from '../rotulos';
import { FichaDaTarefa } from './FichaDaTarefa';
import { NovaTarefa } from './NovaTarefa';

/**
 * Tarefas: lista com busca, filtros e paginação no servidor. A ficha abre numa gaveta, e o endereço
 * guarda a tarefa aberta (`?tarefa=<id>`), então o link serve para compartilhar e para o sino.
 */
export function PaginaTarefas({ sessao }: { sessao: RespostaDaSessao }) {
  const [parametros, definirParametros] = useSearchParams();
  const aberta = Number(parametros.get('tarefa')) || null;
  const [criando, setCriando] = useState(false);
  const [busca, setBusca] = useState('');
  const [termo, setTermo] = useState('');
  const [status, setStatus] = useState<StatusDeTarefa | ''>(
    (parametros.get('status') as StatusDeTarefa) || '',
  );
  const [atrasadas, setAtrasadas] = useState(parametros.get('atrasadas') === 'true');
  const [minhas, setMinhas] = useState(parametros.get('minhas') === 'true');
  const [pagina, setPagina] = useState(1);

  const lista = useTarefas({ pagina, busca: termo, status, atrasadas, minhas });

  const abrir = (id: number | null) => {
    const novos = new URLSearchParams(parametros);
    if (id === null) novos.delete('tarefa');
    else novos.set('tarefa', String(id));
    definirParametros(novos);
  };
  const totalDePaginas = lista.data
    ? Math.max(1, Math.ceil(lista.data.total / lista.data.porPagina))
    : 1;

  return (
    <section>
      <CabecalhoDaPagina
        titulo="Tarefas"
        descricao="O trabalho da equipe, com responsável, prazo e etapa."
        acoes={
          <Botao icone={<Plus size={16} aria-hidden="true" />} onClick={() => setCriando(true)}>
            Nova tarefa
          </Botao>
        }
      />

      {criando ? (
        <NovaTarefa
          sessao={sessao}
          aoFechar={() => setCriando(false)}
          aoAbrir={(id) => {
            setCriando(false);
            abrir(id);
          }}
        />
      ) : null}

      <BarraDeFerramentas
        rotulo="Filtros das tarefas"
        aoBuscar={() => {
          setTermo(busca.trim());
          setPagina(1);
        }}
        acoes={
          <Botao
            type="submit"
            variante="secundario"
            icone={<Search size={16} aria-hidden="true" />}
          >
            Buscar
          </Botao>
        }
      >
        <Campo rotulo="Buscar" ajuda="Parte do título da tarefa.">
          {(p) => (
            <input {...p} type="search" value={busca} onChange={(e) => setBusca(e.target.value)} />
          )}
        </Campo>
        <Campo rotulo="Situação">
          {(p) => (
            <select
              {...p}
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as StatusDeTarefa | '');
                setPagina(1);
              }}
            >
              <option value="">Todas</option>
              {statusDeTarefa.map((s) => (
                <option key={s} value={s}>
                  {rotuloDoStatus[s]}
                </option>
              ))}
            </select>
          )}
        </Campo>
        <label className="opcao">
          <input
            type="checkbox"
            checked={minhas}
            onChange={(e) => {
              setMinhas(e.target.checked);
              setPagina(1);
            }}
          />
          Só as minhas
        </label>
        <label className="opcao">
          <input
            type="checkbox"
            checked={atrasadas}
            onChange={(e) => {
              setAtrasadas(e.target.checked);
              setPagina(1);
            }}
          />
          Só as atrasadas
        </label>
      </BarraDeFerramentas>

      <AvisoDeErro erro={lista.error} />
      {lista.isLoading ? <EsqueletoDeTabela colunas={6} /> : null}
      {lista.data ? (
        <div className="cartao cartao--tabela">
          <div className="tabela-rolavel">
            <table className="tabela">
              <caption>
                {lista.data.total} tarefa(s), página {lista.data.pagina} de {totalDePaginas}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Título</th>
                  <th scope="col">Etapa</th>
                  <th scope="col">Situação</th>
                  <th scope="col">Prioridade</th>
                  <th scope="col">Responsável</th>
                  <th scope="col">Prazo</th>
                </tr>
              </thead>
              <tbody>
                {lista.data.itens.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <button type="button" className="link-botao" onClick={() => abrir(t.id)}>
                        {t.titulo}
                      </button>
                    </td>
                    <td>{t.etapa.nome}</td>
                    <td>
                      <div className="acoes">
                        <SeloDeStatus status={t.status} />
                        {t.atrasada ? <SeloDeAtraso /> : null}
                      </div>
                    </td>
                    <td>
                      <SeloDePrioridade prioridade={t.prioridade} />
                    </td>
                    <td>{t.responsavel.nome}</td>
                    <td>{t.prazo ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {lista.data.itens.length === 0 ? (
            <EstadoVazio
              icone={<ListChecks size={24} />}
              titulo="Nenhuma tarefa encontrada."
              texto="Ajuste os filtros ou crie uma tarefa nova."
            />
          ) : null}
          <Paginacao pagina={pagina} totalDePaginas={totalDePaginas} aoMudar={setPagina} />
        </div>
      ) : null}

      {aberta ? <FichaDaTarefa id={aberta} sessao={sessao} aoFechar={() => abrir(null)} /> : null}
    </section>
  );
}
