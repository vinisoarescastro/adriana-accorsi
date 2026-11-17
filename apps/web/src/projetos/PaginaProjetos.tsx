import { nivelDoPerfil } from '@gabinete/autorizacao';
import {
  statusDeProjeto,
  type RespostaDaSessao,
  type StatusDeProjeto,
} from '@gabinete/compartilhado';
import { AlarmClock, CheckCircle2, Kanban, List, Plus, UserRound } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { useConsolidadoDeProjetos, useEtapasDeProjeto, useProjetos } from '../api/legislativo';
import { Abas } from '../componentes/abas';
import { CabecalhoDaPagina } from '../componentes/cabecalho';
import { BarraDeFiltros, FiltroRapido } from '../componentes/filtros';
import { CartaoDeIndicador, GradeDeIndicadores } from '../componentes/indicador';
import { EsqueletoDeCartoes, EsqueletoDeTabela } from '../componentes/tabela';
import { AvisoDeErro, Botao } from '../componentes/ui';
import { rotuloDoStatusDoProjeto } from '../rotulos';
import { FichaDoProjeto } from './FichaDoProjeto';
import { ListaDeProjetos, QuadroDeProjetos } from './ListaEQuadroDeProjetos';
import { NovoProjeto } from './NovoProjeto';
import { useMoverProjeto } from './useMoverProjeto';

const maximoNoQuadro = 100;

/**
 * Projetos de lei: o consolidado no alto (em andamento, atrasados, concluídos), e abaixo o quadro por
 * etapa do fluxo federal (a visão padrão) ou a lista, com busca, filtros e paginação no servidor. A
 * ficha abre numa gaveta, e o endereço guarda o projeto aberto (`?projeto=<id>`).
 */
export function PaginaProjetos({ sessao }: { sessao: RespostaDaSessao }) {
  const [parametros, definirParametros] = useSearchParams();
  const aberto = Number(parametros.get('projeto')) || null;
  const visaoDoEndereco = parametros.get('visao');
  const visao: 'lista' | 'quadro' =
    visaoDoEndereco === 'lista' ||
    (visaoDoEndereco === null && (parametros.get('status') || parametros.get('atrasados')))
      ? 'lista'
      : 'quadro';
  const [criando, setCriando] = useState(false);
  const [termo, setTermo] = useState('');
  const [status, setStatus] = useState<StatusDeProjeto | ''>(
    (parametros.get('status') as StatusDeProjeto) || '',
  );
  const [atrasados, setAtrasados] = useState(parametros.get('atrasados') === 'true');
  const [meus, setMeus] = useState(parametros.get('meus') === 'true');
  const [pagina, setPagina] = useState(1);

  const lista = useProjetos({ pagina, busca: termo, status, atrasados, meus }, visao === 'lista');
  const doQuadro = useProjetos(
    { pagina: 1, porPagina: maximoNoQuadro, busca: termo, status: '', atrasados, meus },
    visao === 'quadro',
  );
  const etapas = useEtapasDeProjeto();
  const consolidado = useConsolidadoDeProjetos();
  const mover = useMoverProjeto();

  const abrir = (id: number | null) => {
    const novos = new URLSearchParams(parametros);
    if (id === null) novos.delete('projeto');
    else novos.set('projeto', String(id));
    definirParametros(novos);
  };
  const mudarVisao = (nova: 'lista' | 'quadro') => {
    const novos = new URLSearchParams(parametros);
    novos.set('visao', nova);
    definirParametros(novos, { replace: true });
  };

  return (
    <section>
      <CabecalhoDaPagina
        titulo="Projetos de lei"
        descricao="O acompanhamento dos projetos, da redação até a sanção."
        acoes={
          <Botao icone={<Plus size={16} aria-hidden="true" />} onClick={() => setCriando(true)}>
            Novo projeto
          </Botao>
        }
      />

      {consolidado.data ? (
        <GradeDeIndicadores rotulo="Consolidado dos projetos">
          <CartaoDeIndicador
            rotulo="Em andamento"
            valor={consolidado.data.emAndamento}
            icone={<Kanban size={16} />}
            apoio={`${consolidado.data.minhasEmAndamento} sob a sua responsabilidade`}
            para="/g/projetos?status=em_andamento"
          />
          <CartaoDeIndicador
            rotulo="Atrasados"
            valor={consolidado.data.atrasados}
            icone={<AlarmClock size={16} />}
            apoio="Prazo vencido e ainda em andamento"
            para="/g/projetos?atrasados=true"
          />
          <CartaoDeIndicador
            rotulo="Concluídos"
            valor={consolidado.data.concluidos}
            icone={<CheckCircle2 size={16} />}
            apoio={`${consolidado.data.arquivados} arquivados · ${consolidado.data.cancelados} cancelados`}
            para="/g/projetos?status=concluido"
          />
        </GradeDeIndicadores>
      ) : null}

      {criando ? (
        <NovoProjeto
          sessao={sessao}
          aoFechar={() => setCriando(false)}
          aoAbrir={(id) => {
            setCriando(false);
            abrir(id);
          }}
        />
      ) : null}

      <BarraDeFiltros
        rotulo="Filtros dos projetos"
        termo={termo}
        aoBuscar={(t) => {
          setTermo(t);
          setPagina(1);
        }}
        placeholder="Buscar por título, número ou autoria"
        ativos={Boolean(termo || status || atrasados || meus)}
        aoLimpar={() => {
          setTermo('');
          setStatus('');
          setAtrasados(false);
          setMeus(false);
          setPagina(1);
        }}
        filtros={
          <>
            {visao === 'lista' ? (
              <select
                className="filtros__selecao"
                aria-label="Situação"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value as StatusDeProjeto | '');
                  setPagina(1);
                }}
              >
                <option value="">Todas as situações</option>
                {statusDeProjeto.map((s) => (
                  <option key={s} value={s}>
                    {rotuloDoStatusDoProjeto[s]}
                  </option>
                ))}
              </select>
            ) : null}
            <FiltroRapido
              rotulo="Meus"
              icone={<UserRound size={14} aria-hidden="true" />}
              ativo={meus}
              aoAlternar={(v) => {
                setMeus(v);
                setPagina(1);
              }}
            />
            <FiltroRapido
              rotulo="Atrasados"
              icone={<AlarmClock size={14} aria-hidden="true" />}
              ativo={atrasados}
              aoAlternar={(v) => {
                setAtrasados(v);
                setPagina(1);
              }}
            />
          </>
        }
        visao={
          <Abas
            segmentada
            rotulo="Forma de ver os projetos"
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
          <ListaDeProjetos pagina={lista.data} aoAbrir={abrir} aoMudarPagina={setPagina} />
        ) : null
      ) : doQuadro.isLoading || etapas.isLoading ? (
        <EsqueletoDeCartoes quantidade={4} />
      ) : doQuadro.data && etapas.data ? (
        <QuadroDeProjetos
          etapas={etapas.data}
          projetos={doQuadro.data.itens}
          total={doQuadro.data.total}
          aoAbrir={abrir}
          // O responsável, o Supervisor ou superior movem (a mesma regra das ações da ficha).
          podeMover={(p) =>
            nivelDoPerfil[sessao.usuario.perfil] >= 3 || p.responsavel.id === sessao.usuario.id
          }
          aoMover={(p, destino) => mover.mutate({ id: p.id, destino })}
        />
      ) : null}

      {aberto ? <FichaDoProjeto id={aberto} sessao={sessao} aoFechar={() => abrir(null)} /> : null}
    </section>
  );
}
