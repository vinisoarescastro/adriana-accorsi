import { pode } from '@gabinete/autorizacao';
import type { RespostaDaSessao } from '@gabinete/compartilhado';
import {
  Activity,
  AlarmClock,
  CheckCircle2,
  Hourglass,
  Inbox,
  ListChecks,
  UserRound,
} from 'lucide-react';
import { usePainelDeAtendimento } from '../api/atendimento';
import { usePainelDeTarefas } from '../api/trabalho';
import { CabecalhoDaPagina } from '../componentes/cabecalho';
import { CartaoDeIndicador, GradeDeIndicadores } from '../componentes/indicador';
import { EsqueletoDeCartoes } from '../componentes/tabela';
import { Aviso, AvisoDeErro } from '../componentes/ui';
import { rotuloDoPerfil } from '../rotulos';

/**
 * Painel. Há os blocos de ATENDIMENTO e de TAREFAS (agenda, legislativo, emendas e CEAP chegam com
 * os módulos). Os números vêm das mesmas consultas das listagens, e cada um leva à
 * lista correspondente. Há sempre a tabela com os mesmos números: nada depende só de cor.
 */
export function PaginaPainel({ sessao }: { sessao: RespostaDaSessao }) {
  const autoridade = { perfil: sessao.usuario.perfil, habilitacoes: sessao.usuario.habilitacoes };
  const veAtendimento = pode('painel.atendimento', autoridade);
  const { data, isLoading, error } = usePainelDeAtendimento(veAtendimento);
  const veTarefas = pode('painel.tarefas', autoridade);
  const tarefas = usePainelDeTarefas();

  return (
    <section>
      <CabecalhoDaPagina
        titulo="Painel"
        descricao={`Olá, ${sessao.usuario.nome}. Seu perfil: ${rotuloDoPerfil[sessao.usuario.perfil]}.`}
      />

      {veTarefas ? (
        <>
          <h2>Tarefas</h2>
          <AvisoDeErro erro={tarefas.error} />
          {tarefas.isLoading ? <EsqueletoDeCartoes quantidade={4} /> : null}
          {tarefas.data ? (
            <GradeDeIndicadores>
              <CartaoDeIndicador
                rotulo="Tarefas em andamento"
                valor={tarefas.data.abertas}
                icone={<ListChecks size={18} />}
                para="/g/tarefas?status=em_andamento"
              />
              <CartaoDeIndicador
                rotulo="Tarefas atrasadas"
                valor={tarefas.data.atrasadas}
                icone={<AlarmClock size={18} />}
                para="/g/tarefas?atrasadas=true"
              />
              <CartaoDeIndicador
                rotulo="Minhas tarefas em andamento"
                valor={tarefas.data.minhasAbertas}
                icone={<UserRound size={18} />}
                para="/g/tarefas?status=em_andamento&minhas=true"
              />
              <CartaoDeIndicador
                rotulo="Minhas tarefas atrasadas"
                valor={tarefas.data.minhasAtrasadas}
                icone={<Hourglass size={18} />}
                para="/g/tarefas?atrasadas=true&minhas=true"
              />
            </GradeDeIndicadores>
          ) : null}
        </>
      ) : null}

      {veAtendimento ? (
        <>
          <h2>Atendimento</h2>
          <AvisoDeErro erro={error} />
          {isLoading ? <EsqueletoDeCartoes quantidade={6} /> : null}
          {data ? (
            <>
              <GradeDeIndicadores>
                <CartaoDeIndicador
                  rotulo="Em andamento"
                  valor={data.abertas}
                  icone={<Activity size={18} />}
                  para="/g/demandas?status=em_andamento"
                />
                <CartaoDeIndicador
                  rotulo="Atrasadas"
                  valor={data.atrasadas}
                  icone={<AlarmClock size={18} />}
                  para="/g/demandas?atrasadas=true"
                />
                <CartaoDeIndicador
                  rotulo={`Paradas há mais de ${data.limiteParadoDias} dias`}
                  valor={data.paradas}
                  icone={<Hourglass size={18} />}
                  para="/g/demandas?status=em_andamento"
                />
                <CartaoDeIndicador
                  rotulo="Novas na semana"
                  valor={data.novasNaSemana}
                  icone={<Inbox size={18} />}
                  para="/g/demandas"
                />
                <CartaoDeIndicador
                  rotulo="Concluídas no mês"
                  valor={data.concluidasNoMes}
                  icone={<CheckCircle2 size={18} />}
                  para="/g/demandas?status=concluido"
                />
                <CartaoDeIndicador
                  rotulo="Minhas em andamento"
                  valor={data.minhasAbertas}
                  icone={<UserRound size={18} />}
                />
              </GradeDeIndicadores>

              <div className="cartao cartao--tabela">
                <div className="tabela-rolavel">
                  <table className="tabela">
                    <caption>Demandas por etapa</caption>
                    <thead>
                      <tr>
                        <th scope="col">Etapa</th>
                        <th scope="col" className="e-numero">
                          Demandas
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.porEtapa.map((e) => (
                        <tr key={e.id}>
                          <td>{e.nome}</td>
                          <td className="e-numero">{e.total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : null}
        </>
      ) : !veTarefas ? (
        <Aviso tipo="atencao" titulo="Sem blocos disponíveis ainda.">
          Os blocos do painel aparecem conforme as suas habilitações e os módulos já construídos.
        </Aviso>
      ) : null}
    </section>
  );
}
