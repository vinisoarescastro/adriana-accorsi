import { nivelDoPerfil, pode } from '@gabinete/autorizacao';
import {
  formatarReais,
  statusDeEmenda,
  type RespostaDaSessao,
  type StatusDeEmenda,
} from '@gabinete/compartilhado';
import {
  AlarmClock,
  Banknote,
  Coins,
  History,
  Kanban,
  List,
  Plus,
  UserRound,
  Wallet,
} from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { useConsolidadoDeEmendas, useEmendas, useEtapasDeEmenda } from '../api/financeiro';
import { Abas } from '../componentes/abas';
import { CabecalhoDaPagina } from '../componentes/cabecalho';
import { BarraDeFiltros, FiltroRapido } from '../componentes/filtros';
import { CartaoDeIndicador, GradeDeIndicadores } from '../componentes/indicador';
import { EsqueletoDeCartoes, EsqueletoDeTabela } from '../componentes/tabela';
import { AvisoDeErro, Botao } from '../componentes/ui';
import { rotuloDoStatusDaEmenda } from '../rotulos';
import { FichaDaEmenda } from './FichaDaEmenda';
import { ListaDeEmendas, QuadroDeEmendas } from './ListaEQuadroDeEmendas';
import { NovaEmenda } from './NovaEmenda';
import { ReconstituirEmendas } from './ReconstituirEmendas';
import { useMoverEmenda } from './useAcaoDaEmenda';

const maximoNoQuadro = 100;

/**
 * Emendas parlamentares: o consolidado (situação e valores) no alto, e abaixo o quadro por etapa ou a lista. A ficha
 * abre numa gaveta (`?emenda=<id>`). Só o valor disponibilizado se cadastra; o resto é conta.
 */
export function PaginaEmendas({ sessao }: { sessao: RespostaDaSessao }) {
  const autoridade = { perfil: sessao.usuario.perfil, habilitacoes: sessao.usuario.habilitacoes };
  const [parametros, definirParametros] = useSearchParams();
  const aberta = Number(parametros.get('emenda')) || null;
  const visaoDoEndereco = parametros.get('visao');
  const visao: 'lista' | 'quadro' =
    visaoDoEndereco === 'lista' ||
    (visaoDoEndereco === null && (parametros.get('status') || parametros.get('atrasadas')))
      ? 'lista'
      : 'quadro';
  const [criando, setCriando] = useState(parametros.get('novo') === '1');
  const [reconstituindo, setReconstituindo] = useState(false);
  const [termo, setTermo] = useState('');
  const [status, setStatus] = useState<StatusDeEmenda | ''>(
    (parametros.get('status') as StatusDeEmenda) || '',
  );
  const [atrasadas, setAtrasadas] = useState(parametros.get('atrasadas') === 'true');
  const [minhas, setMinhas] = useState(parametros.get('minhas') === 'true');
  const [pagina, setPagina] = useState(1);

  const lista = useEmendas({ pagina, busca: termo, status, atrasadas, minhas }, visao === 'lista');
  const doQuadro = useEmendas(
    { pagina: 1, porPagina: maximoNoQuadro, busca: termo, status: '', atrasadas, minhas },
    visao === 'quadro',
  );
  const etapas = useEtapasDeEmenda();
  const consolidado = useConsolidadoDeEmendas();
  const mover = useMoverEmenda();
  const podeCadastrar = pode('emendas.registrar', autoridade);

  const abrir = (id: number | null) => {
    const novos = new URLSearchParams(parametros);
    if (id === null) novos.delete('emenda');
    else novos.set('emenda', String(id));
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
        titulo="Emendas parlamentares"
        descricao="Valores disponibilizados, destinados a beneficiários e executados."
        acoes={
          <>
            {pode('emendas.reconstituir', autoridade) ? (
              <Botao
                variante="secundario"
                icone={<History size={16} aria-hidden="true" />}
                onClick={() => setReconstituindo(true)}
              >
                Valores em uma data
              </Botao>
            ) : null}
            {podeCadastrar ? (
              <Botao icone={<Plus size={16} aria-hidden="true" />} onClick={() => setCriando(true)}>
                Nova emenda
              </Botao>
            ) : null}
          </>
        }
      />

      {consolidado.data ? (
        <GradeDeIndicadores rotulo="Consolidado das emendas">
          <CartaoDeIndicador
            rotulo="Em andamento"
            valor={consolidado.data.emAndamento}
            icone={<Coins size={16} />}
            apoio={`${consolidado.data.minhasEmAndamento} sob a sua responsabilidade`}
            para="/g/emendas?status=em_andamento"
          />
          <CartaoDeIndicador
            rotulo="Atrasadas"
            valor={consolidado.data.atrasadas}
            icone={<AlarmClock size={16} />}
            alerta={consolidado.data.atrasadas > 0}
            apoio="Algum prazo vencido"
            para="/g/emendas?atrasadas=true"
          />
          <CartaoDeIndicador
            rotulo="Disponibilizado"
            valor={formatarReais(consolidado.data.valores.disponibilizado)}
            icone={<Banknote size={16} />}
            apoio={`${formatarReais(consolidado.data.valores.comprometido)} destinados`}
          />
          <CartaoDeIndicador
            rotulo="Ainda disponível"
            valor={formatarReais(consolidado.data.valores.disponivel)}
            icone={<Wallet size={16} />}
            apoio={`${formatarReais(consolidado.data.valores.aExecutar)} a executar`}
          />
        </GradeDeIndicadores>
      ) : null}

      {criando ? (
        <NovaEmenda
          sessao={sessao}
          aoFechar={() => setCriando(false)}
          aoAbrir={(id) => {
            setCriando(false);
            abrir(id);
          }}
        />
      ) : null}
      {reconstituindo ? <ReconstituirEmendas aoFechar={() => setReconstituindo(false)} /> : null}

      <BarraDeFiltros
        rotulo="Filtros das emendas"
        termo={termo}
        aoBuscar={(t) => {
          setTermo(t);
          setPagina(1);
        }}
        placeholder="Buscar por identificação ou finalidade"
        ativos={Boolean(termo || status || atrasadas || minhas)}
        aoLimpar={() => {
          setTermo('');
          setStatus('');
          setAtrasadas(false);
          setMinhas(false);
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
                  setStatus(e.target.value as StatusDeEmenda | '');
                  setPagina(1);
                }}
              >
                <option value="">Todas as situações</option>
                {statusDeEmenda.map((s) => (
                  <option key={s} value={s}>
                    {rotuloDoStatusDaEmenda[s]}
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
            rotulo="Forma de ver as emendas"
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
          <EsqueletoDeTabela colunas={6} />
        ) : lista.data ? (
          <ListaDeEmendas pagina={lista.data} aoAbrir={abrir} aoMudarPagina={setPagina} />
        ) : null
      ) : doQuadro.isLoading || etapas.isLoading ? (
        <EsqueletoDeCartoes quantidade={4} />
      ) : doQuadro.data && etapas.data ? (
        <QuadroDeEmendas
          etapas={etapas.data}
          emendas={doQuadro.data.itens}
          total={doQuadro.data.total}
          aoAbrir={abrir}
          podeMover={(e) =>
            podeCadastrar &&
            (nivelDoPerfil[sessao.usuario.perfil] >= 3 || e.responsavel.id === sessao.usuario.id)
          }
          aoMover={(e, destino) => mover.mutate({ id: e.id, destino })}
        />
      ) : null}

      {aberta ? <FichaDaEmenda id={aberta} sessao={sessao} aoFechar={() => abrir(null)} /> : null}
    </section>
  );
}
