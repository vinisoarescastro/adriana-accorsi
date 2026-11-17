import { nivelDoPerfil, pode } from '@gabinete/autorizacao';
import {
  deCentavos,
  formatarReais,
  paraCentavos,
  type RespostaDaSessao,
  type SaldoDaCeap,
} from '@gabinete/compartilhado';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlarmClock, CalendarCheck, Gauge, Wallet } from 'lucide-react';
import { chamar } from '../api/cliente';
import { chavesDoFinanceiro } from '../api/financeiro';
import { CartaoDeIndicador, GradeDeIndicadores } from '../componentes/indicador';
import { useToast } from '../componentes/toast';
import { Aviso, AvisoDeErro } from '../componentes/ui';
import { BarrasHorizontais } from '../graficos/BarrasHorizontais';
import { ColunasMensais } from '../graficos/ColunasMensais';
import { nomesDosMeses } from '../rotulos';
import { TabelaMesAMes } from './TabelaMesAMes';

/** O saldo do exercício: indicadores, o quadro mês a mês (o saldo acumula dentro do exercício) e o consumo por categoria. */
export function VisaoGeralDaCeap({
  saldo,
  sessao,
  aoVerAguardando,
}: {
  saldo: SaldoDaCeap;
  sessao: RespostaDaSessao;
  aoVerAguardando: () => void;
}) {
  const cliente = useQueryClient();
  const avisar = useToast();
  const autoridade = { perfil: sessao.usuario.perfil, habilitacoes: sessao.usuario.habilitacoes };
  const supervisiona =
    pode('ceap.supervisionar', autoridade) && nivelDoPerfil[sessao.usuario.perfil] >= 3;
  const referencia = saldo.meses[saldo.mesDeReferencia - 1];
  const porCategoria = saldo.porCategoria
    .map((c) => ({ ...c, centavos: paraCentavos(c.consumido) ?? 0 }))
    .filter((c) => c.centavos > 0)
    .sort((x, y) => y.centavos - x.centavos);
  const totalPorCategoria = porCategoria.reduce((t, c) => t + c.centavos, 0);
  const maiores = porCategoria.slice(0, 8);
  const demais = porCategoria.slice(8);
  const demaisEmCentavos = demais.reduce((t, c) => t + c.centavos, 0);
  const categorias = [
    ...maiores,
    ...(demais.length > 0
      ? [
          {
            categoriaId: -1,
            nome: `Demais (${demais.length})`,
            tetoMensal: null,
            consumido: deCentavos(demaisEmCentavos),
            centavos: demaisEmCentavos,
          },
        ]
      : []),
  ].map((c) => ({
    ...c,
    parte: Math.round((c.centavos / totalPorCategoria) * 100),
  }));
  const cotaDoMes = paraCentavos(referencia?.cota ?? '0') ?? 0;
  const consumidoNoMes = paraCentavos(referencia?.consumido ?? '0') ?? 0;

  const alterar = useMutation({
    mutationFn: ({ mes, acao }: { mes: number; acao: 'encerrar' | 'reabrir' }) =>
      chamar<SaldoDaCeap>('POST', `/api/ceap/competencias/${saldo.ano}/${mes}/${acao}`),
    onSuccess: async (_r, { acao }) => {
      await cliente.invalidateQueries({ queryKey: chavesDoFinanceiro.tudo });
      avisar({
        tom: 'sucesso',
        titulo: acao === 'encerrar' ? 'Competência encerrada' : 'Competência reaberta',
      });
    },
  });

  return (
    <div className="painel">
      {saldo.mesesSemCota.length > 0 ? (
        <Aviso tipo="atencao" titulo="A cota mensal não cobre todo o exercício.">
          Meses sem cota vigente: {saldo.mesesSemCota.map((m) => nomesDosMeses[m - 1]).join(', ')}.
          Sem cota, o saldo não cresce e a despesa é recusada. O Chefe, o Administrador ou a
          Parlamentar cadastra a cota em &quot;Parâmetros&quot;.
        </Aviso>
      ) : null}
      {saldo.abaixoDoLimite && saldo.limiteDeAlerta ? (
        <Aviso tipo="atencao" titulo="Saldo abaixo do limite de alerta.">
          O saldo é {formatarReais(saldo.saldoAtual)} e o limite é{' '}
          {formatarReais(saldo.limiteDeAlerta)}.
        </Aviso>
      ) : null}
      <AvisoDeErro erro={alterar.error} />

      <GradeDeIndicadores rotulo="Saldo da CEAP">
        <CartaoDeIndicador
          rotulo="Saldo atual"
          valor={formatarReais(saldo.saldoAtual)}
          icone={<Wallet size={16} />}
          alerta={saldo.abaixoDoLimite}
          apoio={`Até ${nomesDosMeses[saldo.mesDeReferencia - 1]} de ${saldo.ano}`}
        />
        <CartaoDeIndicador
          rotulo="Cota do mês"
          valor={referencia?.cota ? formatarReais(referencia.cota) : 'Sem cota'}
          icone={<Gauge size={16} />}
          apoio="Do parâmetro vigente"
        />
        <CartaoDeIndicador
          rotulo="Consumido no mês"
          valor={formatarReais(referencia?.consumido ?? '0')}
          icone={<CalendarCheck size={16} />}
          apoio={
            cotaDoMes > 0
              ? `${Math.round((consumidoNoMes / cotaDoMes) * 100)}% da cota do mês`
              : 'Em análise ou adiante'
          }
        />
        <CartaoDeIndicador
          rotulo="Aguardando análise"
          valor={saldo.aguardandoAnalise}
          icone={<AlarmClock size={16} />}
          alerta={saldo.aguardandoAnalise > 0}
          apoio="Despesas em análise"
          aoClicar={aoVerAguardando}
        />
      </GradeDeIndicadores>

      <TabelaMesAMes
        saldo={saldo}
        podeEncerrar={supervisiona}
        ocupado={alterar.isPending}
        aoAlterar={(mes, acao) => alterar.mutate({ mes, acao })}
      />

      <div className="ceap-graficos">
        <section className="cartao" aria-labelledby="ceap-grafico-mensal">
          <h2 className="cartao__titulo" id="ceap-grafico-mensal">
            Cota e consumo por mês
          </h2>
          <ColunasMensais meses={saldo.meses} mesDeReferencia={saldo.mesDeReferencia} />
        </section>
        <section className="cartao" aria-labelledby="ceap-grafico-categoria">
          <h2 className="cartao__titulo" id="ceap-grafico-categoria">
            Consumo por categoria em {saldo.ano}
          </h2>
          {categorias.length > 0 ? (
            <>
              <BarrasHorizontais
                largo
                rotulo="Consumo por categoria"
                unidade="reais"
                linhas={categorias.map((c) => ({
                  id: c.categoriaId,
                  rotulo: c.nome,
                  valor: c.centavos,
                  texto: `${formatarReais(c.consumido)} · ${c.parte}%`,
                }))}
              />
              <p className="campo__ajuda">
                Despesas em análise ou adiante. A porcentagem é a parte de cada categoria no total
                consumido ({formatarReais(deCentavos(totalPorCategoria))}).
              </p>
            </>
          ) : (
            <p className="campo__ajuda">Ainda não há consumo em {saldo.ano}.</p>
          )}
        </section>
      </div>
    </div>
  );
}
