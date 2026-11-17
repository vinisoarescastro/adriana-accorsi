import { pode } from '@gabinete/autorizacao';
import type { RespostaDaSessao } from '@gabinete/compartilhado';
import {
  Activity,
  AlarmClock,
  Archive,
  Bell,
  CalendarDays,
  CheckCircle2,
  Hourglass,
  Landmark,
  ListChecks,
  UserRound,
  UsersRound,
} from 'lucide-react';
import { usePainelDeAtendimento } from '../api/atendimento';
import { useConsolidadoDeProjetos } from '../api/legislativo';
import {
  useAtividadeRecente,
  usePainelDaEquipe,
  usePendenciasDoUsuario,
  useProximosCompromissos,
  useTendenciaDoAtendimento,
} from '../api/painel';
import { useAvisos, usePainelDeTarefas } from '../api/trabalho';
import { Cartao } from '../componentes/cartao';
import { CartaoDeIndicador, GradeDeIndicadores } from '../componentes/indicador';
import { EsqueletoDeCartoes } from '../componentes/tabela';
import { AvisoDeErro, Carregando } from '../componentes/ui';
import { BarrasHorizontais } from '../graficos/BarrasHorizontais';
import { CargaDaEquipe } from '../graficos/CargaDaEquipe';
import { GraficoDeTendencia } from '../graficos/GraficoDeTendencia';
import { AtividadeDoPainel, AvisosDoPainel, ProximosCompromissos } from './BlocosLaterais';
import { MinhasPendencias } from './MinhasPendencias';
import { Saudacao } from './Saudacao';

/**
 * Painel: a página inicial. Cada bloco só existe para quem tem a permissão e a habilitação dele (o mesmo
 * decisor das rotas), e todo número vem das mesmas consultas das listagens. Na ordem de importância: o que
 * está com a pessoa agora, os números do que ela acompanha, as tendências e, por último, o que andou.
 */
export function PaginaPainel({ sessao }: { sessao: RespostaDaSessao }) {
  const autoridade = { perfil: sessao.usuario.perfil, habilitacoes: sessao.usuario.habilitacoes };
  const veAtendimento = pode('painel.atendimento', autoridade);
  const veProjetos = pode('projetos.consultar', autoridade);
  const veAgenda = pode('agenda.consultar', autoridade);
  const veEquipe = pode('painel.equipe', autoridade);
  const externo = sessao.usuario.perfil === 'assessor_externo';

  const atendimento = usePainelDeAtendimento(veAtendimento);
  const tarefas = usePainelDeTarefas();
  const projetos = useConsolidadoDeProjetos(veProjetos);
  const tendencia = useTendenciaDoAtendimento(veAtendimento);
  const pendencias = usePendenciasDoUsuario();
  const atividade = useAtividadeRecente();
  const equipe = usePainelDaEquipe(veEquipe);
  const proximos = useProximosCompromissos(veAgenda);
  const avisos = useAvisos();

  const blocoDeAtendimento = veAtendimento ? (
    <section aria-labelledby="painel-atendimento" className="painel-secao">
      <h2 id="painel-atendimento">Atendimento</h2>
      <AvisoDeErro erro={atendimento.error} />
      {atendimento.isLoading ? <EsqueletoDeCartoes quantidade={4} /> : null}
      {atendimento.data ? (
        <GradeDeIndicadores>
          <CartaoDeIndicador
            rotulo="Demandas em andamento"
            valor={atendimento.data.abertas}
            icone={<Activity size={18} />}
            apoio={`${atendimento.data.minhasAbertas} com você`}
            para="/g/demandas?status=em_andamento"
          />
          <CartaoDeIndicador
            rotulo="Atrasadas"
            valor={atendimento.data.atrasadas}
            icone={<AlarmClock size={18} />}
            alerta={atendimento.data.atrasadas > 0}
            apoio="Prazo vencido"
            para="/g/demandas?atrasadas=true"
          />
          <CartaoDeIndicador
            rotulo="Paradas"
            valor={atendimento.data.paradas}
            icone={<Hourglass size={18} />}
            alerta={atendimento.data.paradas > 0}
            apoio={`Sem movimento há mais de ${atendimento.data.limiteParadoDias} dias`}
            para="/g/demandas?status=em_andamento"
          />
          <CartaoDeIndicador
            rotulo="Concluídas no mês"
            valor={atendimento.data.concluidasNoMes}
            icone={<CheckCircle2 size={18} />}
            apoio={`${atendimento.data.novasNaSemana} novas nesta semana`}
            para="/g/demandas?status=concluido"
          />
        </GradeDeIndicadores>
      ) : null}
    </section>
  ) : null;

  const blocoDeTarefas = (
    <section aria-labelledby="painel-tarefas" className="painel-secao">
      <h2 id="painel-tarefas">Tarefas</h2>
      <AvisoDeErro erro={tarefas.error} />
      {tarefas.isLoading ? <EsqueletoDeCartoes quantidade={4} /> : null}
      {tarefas.data ? (
        <GradeDeIndicadores>
          <CartaoDeIndicador
            rotulo="Em andamento"
            valor={tarefas.data.abertas}
            icone={<ListChecks size={18} />}
            apoio={`${tarefas.data.minhasAbertas} com você`}
            para="/g/tarefas?status=em_andamento"
          />
          <CartaoDeIndicador
            rotulo="Atrasadas"
            valor={tarefas.data.atrasadas}
            icone={<AlarmClock size={18} />}
            alerta={tarefas.data.atrasadas > 0}
            apoio={`${tarefas.data.minhasAtrasadas} com você`}
            para="/g/tarefas?atrasadas=true"
          />
          <CartaoDeIndicador
            rotulo="Minhas em andamento"
            valor={tarefas.data.minhasAbertas}
            apoio="Tarefas com você"
            icone={<UserRound size={18} />}
            para="/g/tarefas?status=em_andamento&minhas=true"
          />
          <CartaoDeIndicador
            rotulo="Minhas atrasadas"
            valor={tarefas.data.minhasAtrasadas}
            icone={<Hourglass size={18} />}
            alerta={tarefas.data.minhasAtrasadas > 0}
            apoio="Prazo vencido, com você"
            para="/g/tarefas?atrasadas=true&minhas=true"
          />
        </GradeDeIndicadores>
      ) : null}
    </section>
  );

  const blocoDeProjetos = veProjetos ? (
    <section aria-labelledby="painel-projetos" className="painel-secao">
      <h2 id="painel-projetos">Projetos de lei</h2>
      <AvisoDeErro erro={projetos.error} />
      {projetos.data ? (
        <GradeDeIndicadores>
          <CartaoDeIndicador
            rotulo="Em andamento"
            valor={projetos.data.emAndamento}
            icone={<Landmark size={18} />}
            apoio={`${projetos.data.minhasEmAndamento} sob a sua responsabilidade`}
            para="/g/projetos?status=em_andamento"
          />
          <CartaoDeIndicador
            rotulo="Atrasados"
            valor={projetos.data.atrasados}
            icone={<AlarmClock size={18} />}
            alerta={projetos.data.atrasados > 0}
            apoio="Prazo vencido"
            para="/g/projetos?atrasados=true"
          />
          <CartaoDeIndicador
            rotulo="Concluídos"
            valor={projetos.data.concluidos}
            icone={<CheckCircle2 size={18} />}
            apoio="Sancionados, vetados ou rejeitados"
            para="/g/projetos?status=concluido"
          />
          <CartaoDeIndicador
            rotulo="Arquivados"
            valor={projetos.data.arquivados}
            icone={<Archive size={18} />}
            apoio={`${projetos.data.cancelados} cancelados`}
            para="/g/projetos?status=arquivado"
          />
        </GradeDeIndicadores>
      ) : null}
    </section>
  ) : null;

  const etapasDosProjetos = (projetos.data?.porEtapa ?? []).filter((e) => e.total > 0);

  return (
    <div className="painel">
      <Saudacao sessao={sessao} />

      <div className="painel-grade">
        <div className="painel-principal">
          {externo ? (
            <>
              {blocoDeTarefas}
              {blocoDeAtendimento}
            </>
          ) : (
            <>
              {blocoDeAtendimento}
              {blocoDeTarefas}
              {blocoDeProjetos}
            </>
          )}

          {veAtendimento ? (
            <Cartao
              titulo="Atendimento nos últimos 30 dias"
              descricao="Demandas recebidas e concluídas por dia."
              icone={<Activity size={18} />}
            >
              <AvisoDeErro erro={tendencia.error} />
              {tendencia.isLoading ? <Carregando /> : null}
              {tendencia.data ? <GraficoDeTendencia pontos={tendencia.data.pontos} /> : null}
            </Cartao>
          ) : null}

          <div className="painel-duplo">
            {veAtendimento && atendimento.data ? (
              <Cartao titulo="Demandas por etapa" descricao="Onde estão os pedidos hoje.">
                <BarrasHorizontais
                  rotulo="Demandas por etapa"
                  unidade="demandas"
                  linhas={atendimento.data.porEtapa.map((e) => ({
                    id: e.id,
                    rotulo: e.nome,
                    valor: e.total,
                  }))}
                />
              </Cartao>
            ) : null}
            {veProjetos && projetos.data ? (
              <Cartao
                titulo="Projetos por etapa"
                descricao="Do fluxo federal; só as etapas com projeto."
              >
                {etapasDosProjetos.length === 0 ? (
                  <p className="campo__ajuda">Nenhum projeto cadastrado ainda.</p>
                ) : (
                  <BarrasHorizontais
                    rotulo="Projetos de lei por etapa"
                    unidade="projetos"
                    linhas={etapasDosProjetos.map((e) => ({
                      id: e.etapaId,
                      rotulo: e.nome,
                      valor: e.total,
                    }))}
                  />
                )}
              </Cartao>
            ) : null}
          </div>

          {veEquipe ? (
            <Cartao
              titulo="Carga da equipe"
              descricao="Demandas e tarefas em andamento por pessoa."
              icone={<UsersRound size={18} />}
            >
              <AvisoDeErro erro={equipe.error} />
              {equipe.isLoading ? <Carregando /> : null}
              {equipe.data ? (
                <CargaDaEquipe
                  pessoas={equipe.data.pessoas}
                  periodoDias={equipe.data.periodoDias}
                />
              ) : null}
            </Cartao>
          ) : null}
        </div>

        <aside className="painel-lateral" aria-label="O que pede a sua atenção">
          <div className="painel-bloco painel-bloco--pendencias">
            <Cartao
              titulo="Com você agora"
              descricao="As atrasadas primeiro."
              icone={<ListChecks size={18} />}
            >
              <AvisoDeErro erro={pendencias.error} />
              {pendencias.isLoading ? <Carregando /> : null}
              {pendencias.data ? <MinhasPendencias dados={pendencias.data} /> : null}
            </Cartao>
          </div>

          {veAgenda ? (
            <div className="painel-bloco painel-bloco--agenda">
              <Cartao titulo="Próximos compromissos" icone={<CalendarDays size={18} />}>
                <AvisoDeErro erro={proximos.error} />
                {proximos.isLoading ? <Carregando /> : null}
                {proximos.data ? <ProximosCompromissos itens={proximos.data.itens} /> : null}
              </Cartao>
            </div>
          ) : null}

          <div className="painel-bloco painel-bloco--avisos">
            <Cartao titulo="Avisos" icone={<Bell size={18} />}>
              {avisos.isLoading ? <Carregando /> : null}
              {avisos.data ? (
                <AvisosDoPainel itens={avisos.data.itens} naoLidos={avisos.data.naoLidos} />
              ) : null}
            </Cartao>
          </div>

          <div className="painel-bloco painel-bloco--atividade">
            <Cartao
              titulo="Atividade recente"
              descricao="O que andou nos registros que você acompanha."
            >
              <AvisoDeErro erro={atividade.error} />
              {atividade.isLoading ? <Carregando /> : null}
              {atividade.data ? <AtividadeDoPainel itens={atividade.data} /> : null}
            </Cartao>
          </div>
        </aside>
      </div>
    </div>
  );
}
