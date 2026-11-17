import { formatarReais, paraCentavos } from '@gabinete/compartilhado';
import {
  Activity,
  AlarmClock,
  Archive,
  Banknote,
  CheckCircle2,
  HandCoins,
  Hourglass,
  Landmark,
  ListChecks,
  UserRound,
  Wallet,
} from 'lucide-react';
import type { usePainelDeAtendimento } from '../api/atendimento';
import type { usePainelFinanceiro } from '../api/financeiro';
import type { useConsolidadoDeProjetos } from '../api/legislativo';
import type { usePainelDeTarefas } from '../api/trabalho';
import { CartaoDeIndicador, GradeDeIndicadores } from '../componentes/indicador';
import { EsqueletoDeCartoes } from '../componentes/tabela';
import { AvisoDeErro } from '../componentes/ui';

const centavos = (v: string | undefined) => paraCentavos(v ?? '0') ?? 0;

/** Indicadores de atendimento: demandas em andamento, atrasadas, paradas e concluídas. */
export function BlocoDeAtendimento({
  atendimento,
}: {
  atendimento: ReturnType<typeof usePainelDeAtendimento>;
}) {
  return (
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
            verRotulo="Ver demandas"
          />
          <CartaoDeIndicador
            rotulo="Atrasadas"
            valor={atendimento.data.atrasadas}
            icone={<AlarmClock size={18} />}
            alerta={atendimento.data.atrasadas > 0}
            apoio="Prazo vencido"
            para="/g/demandas?atrasadas=true"
            verRotulo="Ver atrasadas"
          />
          <CartaoDeIndicador
            rotulo="Paradas"
            valor={atendimento.data.paradas}
            icone={<Hourglass size={18} />}
            alerta={atendimento.data.paradas > 0}
            apoio={`Sem movimento há mais de ${atendimento.data.limiteParadoDias} dias`}
            para="/g/demandas?status=em_andamento"
            verRotulo="Ver demandas"
          />
          <CartaoDeIndicador
            rotulo="Concluídas no mês"
            valor={atendimento.data.concluidasNoMes}
            icone={<CheckCircle2 size={18} />}
            apoio={`${atendimento.data.novasNaSemana} novas nesta semana`}
            para="/g/demandas?status=concluido"
            verRotulo="Ver concluídas"
          />
        </GradeDeIndicadores>
      ) : null}
    </section>
  );
}

/** Indicadores das tarefas da equipe e as suas. */
export function BlocoDeTarefas({ tarefas }: { tarefas: ReturnType<typeof usePainelDeTarefas> }) {
  return (
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
            verRotulo="Ver tarefas"
          />
          <CartaoDeIndicador
            rotulo="Atrasadas"
            valor={tarefas.data.atrasadas}
            icone={<AlarmClock size={18} />}
            alerta={tarefas.data.atrasadas > 0}
            apoio={`${tarefas.data.minhasAtrasadas} com você`}
            para="/g/tarefas?atrasadas=true"
            verRotulo="Ver atrasadas"
          />
          <CartaoDeIndicador
            rotulo="Minhas em andamento"
            valor={tarefas.data.minhasAbertas}
            apoio="Tarefas com você"
            icone={<UserRound size={18} />}
            para="/g/tarefas?status=em_andamento&minhas=true"
            verRotulo="Ver as minhas"
          />
          <CartaoDeIndicador
            rotulo="Minhas atrasadas"
            valor={tarefas.data.minhasAtrasadas}
            icone={<Hourglass size={18} />}
            alerta={tarefas.data.minhasAtrasadas > 0}
            apoio="Prazo vencido, com você"
            para="/g/tarefas?atrasadas=true&minhas=true"
            verRotulo="Ver as minhas"
          />
        </GradeDeIndicadores>
      ) : null}
    </section>
  );
}

/** Indicadores dos projetos de lei. */
export function BlocoDeProjetos({
  projetos,
}: {
  projetos: ReturnType<typeof useConsolidadoDeProjetos>;
}) {
  return (
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
            verRotulo="Ver projetos"
          />
          <CartaoDeIndicador
            rotulo="Atrasados"
            valor={projetos.data.atrasados}
            icone={<AlarmClock size={18} />}
            alerta={projetos.data.atrasados > 0}
            apoio="Prazo vencido"
            para="/g/projetos?atrasados=true"
            verRotulo="Ver atrasados"
          />
          <CartaoDeIndicador
            rotulo="Concluídos"
            valor={projetos.data.concluidos}
            icone={<CheckCircle2 size={18} />}
            apoio="Sancionados, vetados ou rejeitados"
            para="/g/projetos?status=concluido"
            verRotulo="Ver concluídos"
          />
          <CartaoDeIndicador
            rotulo="Arquivados"
            valor={projetos.data.arquivados}
            icone={<Archive size={18} />}
            apoio={`${projetos.data.cancelados} cancelados`}
            para="/g/projetos?status=arquivado"
            verRotulo="Ver arquivados"
          />
        </GradeDeIndicadores>
      ) : null}
    </section>
  );
}

/** Indicadores do financeiro: saldo da CEAP, despesas em análise e emendas. */
export function BlocoFinanceiro({
  financeiro,
}: {
  financeiro: ReturnType<typeof usePainelFinanceiro>;
}) {
  const saldoDaCeap = financeiro.data?.saldo;
  const ateAgora = (saldoDaCeap?.meses ?? []).filter(
    (m) => m.mes <= (saldoDaCeap?.mesDeReferencia ?? 0),
  );
  const cotaAteAgora = ateAgora.reduce((t, m) => t + centavos(m.cota ?? '0'), 0);
  const consumidoAteAgora = ateAgora.reduce((t, m) => t + centavos(m.consumido), 0);
  return (
    <section aria-labelledby="painel-financeiro" className="painel-secao">
      <h2 id="painel-financeiro">Financeiro</h2>
      <AvisoDeErro erro={financeiro.error} />
      {financeiro.data ? (
        <GradeDeIndicadores>
          <CartaoDeIndicador
            rotulo="Saldo da CEAP"
            valor={formatarReais(financeiro.data.saldo.saldoAtual)}
            icone={<Wallet size={18} />}
            alerta={financeiro.data.saldo.abaixoDoLimite}
            apoio={
              financeiro.data.saldo.abaixoDoLimite
                ? 'Abaixo do limite de alerta'
                : 'Acumulado no exercício'
            }
            progresso={{
              parte: consumidoAteAgora,
              total: cotaAteAgora,
              texto: 'da cota até agora',
            }}
            para="/g/ceap"
            verRotulo="Ver CEAP"
          />
          <CartaoDeIndicador
            rotulo="Despesas em análise"
            valor={financeiro.data.saldo.aguardandoAnalise}
            icone={<Hourglass size={18} />}
            alerta={financeiro.data.saldo.aguardandoAnalise > 0}
            apoio={`${formatarReais(
              financeiro.data.saldo.porStatus.find((s) => s.status === 'em_analise')?.valor ?? '0',
            )} aguardando`}
            para="/g/ceap"
            verRotulo="Ver CEAP"
          />
          {financeiro.data.emendas ? (
            <>
              <CartaoDeIndicador
                rotulo="Emendas disponibilizadas"
                valor={formatarReais(financeiro.data.emendas.disponibilizado)}
                icone={<Banknote size={18} />}
                apoio={`${formatarReais(financeiro.data.emendas.comprometido)} destinados`}
                progresso={{
                  parte: centavos(financeiro.data.emendas.comprometido),
                  total: centavos(financeiro.data.emendas.disponibilizado),
                  texto: 'já destinado',
                }}
                para="/g/emendas"
                verRotulo="Ver emendas"
              />
              <CartaoDeIndicador
                rotulo="Emendas ainda disponíveis"
                valor={formatarReais(financeiro.data.emendas.disponivel)}
                icone={<HandCoins size={18} />}
                apoio="Para destinar"
                progresso={{
                  parte: centavos(financeiro.data.emendas.disponivel),
                  total: centavos(financeiro.data.emendas.disponibilizado),
                  texto: 'do valor disponibilizado',
                }}
                para="/g/emendas"
                verRotulo="Ver emendas"
              />
            </>
          ) : null}
        </GradeDeIndicadores>
      ) : null}
    </section>
  );
}
