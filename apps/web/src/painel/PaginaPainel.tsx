import { pode } from '@gabinete/autorizacao';
import type { RespostaDaSessao } from '@gabinete/compartilhado';
import { Bell, History, CalendarDays, ListChecks, ChevronRight } from 'lucide-react';
import { Link } from 'react-router';
import { usePainelDeAtendimento } from '../api/atendimento';
import { usePainelFinanceiro } from '../api/financeiro';
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
import { AvisoDeErro, Carregando } from '../componentes/ui';
import { AtividadeDoPainel, AvisosDoPainel, ProximosCompromissos } from './BlocosLaterais';
import {
  BlocoDeAtendimento,
  BlocoDeProjetos,
  BlocoDeTarefas,
  BlocoFinanceiro,
} from './BlocosDeIndicadores';
import { GraficosDoPainel } from './GraficosDoPainel';
import { MinhasPendencias } from './MinhasPendencias';
import { Saudacao } from './Saudacao';

/** O link do rodapé de um cartão: leva à página que tem o detalhe do que o cartão resume. */
function VerTudo({ para, children }: { para: string; children: string }) {
  return (
    <Link className="cartao__ver" to={para}>
      {children}
      <ChevronRight size={14} aria-hidden="true" />
    </Link>
  );
}

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
  const veFinanceiro = pode('painel.financeiro', autoridade);
  const externo = sessao.usuario.perfil === 'assessor_externo';

  const atendimento = usePainelDeAtendimento(veAtendimento);
  const tarefas = usePainelDeTarefas();
  const projetos = useConsolidadoDeProjetos(veProjetos);
  const financeiro = usePainelFinanceiro(veFinanceiro);
  const tendencia = useTendenciaDoAtendimento(veAtendimento);
  const pendencias = usePendenciasDoUsuario();
  const atividade = useAtividadeRecente();
  const equipe = usePainelDaEquipe(veEquipe);
  const proximos = useProximosCompromissos(veAgenda);
  const avisos = useAvisos();

  return (
    <div className="painel painel--inicio">
      <Saudacao sessao={sessao} />

      <div className="painel-grade">
        <div className="painel-principal">
          {externo ? (
            <>
              <BlocoDeTarefas tarefas={tarefas} />
              {veAtendimento ? <BlocoDeAtendimento atendimento={atendimento} /> : null}
              {veFinanceiro ? <BlocoFinanceiro financeiro={financeiro} /> : null}
            </>
          ) : (
            <>
              {veAtendimento ? <BlocoDeAtendimento atendimento={atendimento} /> : null}
              <BlocoDeTarefas tarefas={tarefas} />
              {veProjetos ? <BlocoDeProjetos projetos={projetos} /> : null}
              {veFinanceiro ? <BlocoFinanceiro financeiro={financeiro} /> : null}
            </>
          )}

          <GraficosDoPainel
            veAtendimento={veAtendimento}
            veProjetos={veProjetos}
            veFinanceiro={veFinanceiro}
            veEquipe={veEquipe}
            atendimento={atendimento}
            tarefas={tarefas}
            projetos={projetos}
            financeiro={financeiro}
            tendencia={tendencia}
            equipe={equipe}
          />
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
              <Cartao
                titulo="Próximos compromissos"
                descricao="Os próximos da agenda."
                icone={<CalendarDays size={18} />}
                rodape={<VerTudo para="/g/agenda">Ver agenda</VerTudo>}
              >
                <AvisoDeErro erro={proximos.error} />
                {proximos.isLoading ? <Carregando /> : null}
                {proximos.data ? <ProximosCompromissos itens={proximos.data.itens} /> : null}
              </Cartao>
            </div>
          ) : null}

          <div className="painel-bloco painel-bloco--avisos">
            <Cartao
              titulo="Avisos"
              descricao="As notificações do seu sino."
              icone={<Bell size={18} />}
              rodape={
                <span>
                  {avisos.data
                    ? `${avisos.data.naoLidos} não ${avisos.data.naoLidos === 1 ? 'lido' : 'lidos'}`
                    : null}
                </span>
              }
            >
              {avisos.isLoading ? <Carregando /> : null}
              {avisos.data ? (
                <AvisosDoPainel itens={avisos.data.itens} naoLidos={avisos.data.naoLidos} />
              ) : null}
            </Cartao>
          </div>

          <div className="painel-bloco painel-bloco--atividade">
            <Cartao
              titulo="Atividade recente"
              icone={<History size={18} />}
              descricao="O que andou nos registros que você acompanha."
              rodape={<span>Os registros mais recentes.</span>}
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
