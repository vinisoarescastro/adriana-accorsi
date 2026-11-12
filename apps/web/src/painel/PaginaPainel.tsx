import { pode } from '@gabinete/autorizacao';
import type { RespostaDaSessao } from '@gabinete/compartilhado';
import { Link } from 'react-router';
import { usePainelDeAtendimento } from '../api/atendimento';
import { AvisoDeErro, Aviso, Carregando } from '../componentes/ui';
import { rotuloDoPerfil } from '../rotulos';

/**
 * Painel. Hoje só há o bloco de ATENDIMENTO (os de tarefas, agenda, legislativo, emendas e CEAP
 * chegam com os módulos). Os números vêm das mesmas consultas das listagens, e cada um leva à
 * lista correspondente. Há sempre a tabela com os mesmos números: nada depende só de cor.
 */
export function PaginaPainel({ sessao }: { sessao: RespostaDaSessao }) {
  const autoridade = { perfil: sessao.usuario.perfil, habilitacoes: sessao.usuario.habilitacoes };
  const veAtendimento = pode('painel.atendimento', autoridade);
  const { data, isLoading, error } = usePainelDeAtendimento(veAtendimento);

  return (
    <section>
      <h1>Painel</h1>
      <p>
        Olá, {sessao.usuario.nome}. Seu perfil:{' '}
        <strong>{rotuloDoPerfil[sessao.usuario.perfil]}</strong>.
      </p>

      {veAtendimento ? (
        <>
          <h2>Atendimento</h2>
          <AvisoDeErro erro={error} />
          {isLoading ? <Carregando /> : null}
          {data ? (
            <>
              <div className="cartoes-do-painel">
                <Link className="cartao-numero" to="/g/demandas?status=em_andamento">
                  <span className="cartao-numero__valor">{data.abertas}</span>
                  <span>Em andamento</span>
                </Link>
                <Link className="cartao-numero" to="/g/demandas?atrasadas=true">
                  <span className="cartao-numero__valor">{data.atrasadas}</span>
                  <span>Atrasadas</span>
                </Link>
                <Link className="cartao-numero" to="/g/demandas?status=em_andamento">
                  <span className="cartao-numero__valor">{data.paradas}</span>
                  <span>Paradas há mais de {data.limiteParadoDias} dias</span>
                </Link>
                <Link className="cartao-numero" to="/g/demandas">
                  <span className="cartao-numero__valor">{data.novasNaSemana}</span>
                  <span>Novas na semana</span>
                </Link>
                <Link className="cartao-numero" to="/g/demandas?status=concluido">
                  <span className="cartao-numero__valor">{data.concluidasNoMes}</span>
                  <span>Concluídas no mês</span>
                </Link>
                <div className="cartao-numero">
                  <span className="cartao-numero__valor">{data.minhasAbertas}</span>
                  <span>Minhas em andamento</span>
                </div>
              </div>

              <div className="cartao tabela-rolavel">
                <table className="tabela">
                  <caption>Demandas por etapa</caption>
                  <thead>
                    <tr>
                      <th scope="col">Etapa</th>
                      <th scope="col">Demandas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.porEtapa.map((e) => (
                      <tr key={e.id}>
                        <td>{e.nome}</td>
                        <td>{e.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </>
      ) : (
        <Aviso tipo="atencao" titulo="Sem blocos disponíveis ainda.">
          Os blocos do painel aparecem conforme as suas habilitações e os módulos já construídos.
        </Aviso>
      )}
    </section>
  );
}
