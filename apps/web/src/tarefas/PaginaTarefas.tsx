import { nivelDoPerfil } from '@gabinete/autorizacao';
import {
  statusDeTarefa,
  type RespostaDaSessao,
  type StatusDeTarefa,
} from '@gabinete/compartilhado';
import { AlarmClock, Kanban, List, Plus, UserRound } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { useEtapasDeTarefa, useTarefas } from '../api/trabalho';
import { Abas } from '../componentes/abas';
import { respondePeloItem } from '../componentes/responsaveis';
import { CabecalhoDaPagina } from '../componentes/cabecalho';
import { BarraDeFiltros, FiltroRapido } from '../componentes/filtros';
import { EsqueletoDeCartoes, EsqueletoDeTabela } from '../componentes/tabela';
import { AvisoDeErro, Botao } from '../componentes/ui';
import { rotuloDoStatus } from '../rotulos';
import { FichaDaTarefa } from './FichaDaTarefa';
import { ListaDeTarefas, QuadroDeTarefas } from './ListaEQuadroDeTarefas';
import { NovaTarefa } from './NovaTarefa';
import { useMoverTarefa } from './useMoverTarefa';

const maximoNoQuadro = 100;

/**
 * Tarefas: quadro por etapa (a visão padrão) e lista, com busca, filtros e paginação no servidor. A
 * ficha abre numa gaveta, e o endereço guarda a tarefa aberta (`?tarefa=<id>`), então o link serve para
 * compartilhar e para o sino.
 */
export function PaginaTarefas({ sessao }: { sessao: RespostaDaSessao }) {
  const [parametros, definirParametros] = useSearchParams();
  const aberta = Number(parametros.get('tarefa')) || null;
  // Quem chega com um filtro de situação (os links do painel) cai na lista; senão, o quadro.
  const visaoDoEndereco = parametros.get('visao');
  const visao: 'lista' | 'quadro' =
    visaoDoEndereco === 'lista' || (visaoDoEndereco === null && parametros.get('status'))
      ? 'lista'
      : 'quadro';
  const [criando, setCriando] = useState(false);
  const [termo, setTermo] = useState('');
  const [status, setStatus] = useState<StatusDeTarefa | ''>(
    (parametros.get('status') as StatusDeTarefa) || '',
  );
  const [atrasadas, setAtrasadas] = useState(parametros.get('atrasadas') === 'true');
  const [minhas, setMinhas] = useState(parametros.get('minhas') === 'true');
  const [pagina, setPagina] = useState(1);

  const lista = useTarefas({ pagina, busca: termo, status, atrasadas, minhas }, visao === 'lista');
  const doQuadro = useTarefas(
    { pagina: 1, porPagina: maximoNoQuadro, busca: termo, status: '', atrasadas, minhas },
    visao === 'quadro',
  );
  const etapas = useEtapasDeTarefa();
  const mover = useMoverTarefa();

  const abrir = (id: number | null) => {
    const novos = new URLSearchParams(parametros);
    if (id === null) novos.delete('tarefa');
    else novos.set('tarefa', String(id));
    definirParametros(novos);
  };
  const mudarVisao = (nova: 'lista' | 'quadro') => {
    const novos = new URLSearchParams(parametros);
    novos.set('visao', nova);
    definirParametros(novos, { replace: true });
  };
  const limpar = () => {
    setTermo('');
    setStatus('');
    setAtrasadas(false);
    setMinhas(false);
    setPagina(1);
  };

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

      <BarraDeFiltros
        rotulo="Filtros das tarefas"
        termo={termo}
        aoBuscar={(t) => {
          setTermo(t);
          setPagina(1);
        }}
        placeholder="Buscar pelo título da tarefa"
        ativos={Boolean(termo || status || atrasadas || minhas)}
        aoLimpar={limpar}
        filtros={
          <>
            {visao === 'lista' ? (
              <select
                className="filtros__selecao"
                aria-label="Situação"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value as StatusDeTarefa | '');
                  setPagina(1);
                }}
              >
                <option value="">Todas as situações</option>
                {statusDeTarefa.map((s) => (
                  <option key={s} value={s}>
                    {rotuloDoStatus[s]}
                  </option>
                ))}
              </select>
            ) : null}
            <FiltroRapido
              rotulo="Minhas"
              icone={<UserRound size={14} aria-hidden="true" />}
              ativo={minhas}
              aoAlternar={(v) => {
                setMinhas(v);
                setPagina(1);
              }}
            />
            <FiltroRapido
              rotulo="Atrasadas"
              icone={<AlarmClock size={14} aria-hidden="true" />}
              ativo={atrasadas}
              aoAlternar={(v) => {
                setAtrasadas(v);
                setPagina(1);
              }}
            />
          </>
        }
        visao={
          <Abas
            segmentada
            rotulo="Forma de ver as tarefas"
            valor={visao}
            aoMudar={mudarVisao}
            itens={[
              { id: 'quadro', rotulo: 'Quadro', icone: <Kanban size={16} aria-hidden="true" /> },
              { id: 'lista', rotulo: 'Lista', icone: <List size={16} aria-hidden="true" /> },
            ]}
          />
        }
      />

      <AvisoDeErro erro={lista.error ?? doQuadro.error ?? etapas.error} />
      {visao === 'lista' ? (
        lista.isLoading ? (
          <EsqueletoDeTabela colunas={5} />
        ) : lista.data ? (
          <ListaDeTarefas pagina={lista.data} aoAbrir={abrir} aoMudarPagina={setPagina} />
        ) : null
      ) : doQuadro.isLoading || etapas.isLoading ? (
        <EsqueletoDeCartoes quantidade={4} />
      ) : doQuadro.data && etapas.data ? (
        <QuadroDeTarefas
          etapas={etapas.data}
          tarefas={doQuadro.data.itens}
          total={doQuadro.data.total}
          aoAbrir={abrir}
          // Supervisor ou superior, ou o responsável, movem (a mesma regra das ações da ficha).
          podeMover={(t) =>
            nivelDoPerfil[sessao.usuario.perfil] >= 3 || respondePeloItem(t, sessao.usuario.id)
          }
          aoMover={(t, destino) => mover.mutate({ id: t.id, destino })}
        />
      ) : null}

      {aberta ? <FichaDaTarefa id={aberta} sessao={sessao} aoFechar={() => abrir(null)} /> : null}
    </section>
  );
}
