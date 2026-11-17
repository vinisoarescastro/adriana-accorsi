import { deCentavos, formatarReais, paraCentavos } from '@gabinete/compartilhado';
import { Activity, AlarmClock, Banknote, Landmark, Tags, Wallet, Workflow } from 'lucide-react';
import { Link } from 'react-router';
import type { usePainelDeAtendimento } from '../api/atendimento';
import type { usePainelFinanceiro } from '../api/financeiro';
import type { useConsolidadoDeProjetos } from '../api/legislativo';
import type { usePainelDaEquipe, useTendenciaDoAtendimento } from '../api/painel';
import type { usePainelDeTarefas } from '../api/trabalho';
import { Abas } from '../componentes/abas';
import { Cartao } from '../componentes/cartao';
import { usarPreferencia } from '../componentes/usar-preferencia';
import { AvisoDeErro, Carregando } from '../componentes/ui';
import { ColunasMensais } from '../graficos/ColunasMensais';
import { FaixaProporcional } from '../graficos/FaixaProporcional';
import { GraficoDeTendencia } from '../graficos/GraficoDeTendencia';
import { CartaoDaEquipe } from './CartaoDaEquipe';
import { CartaoDeDistribuicao } from './CartaoDeDistribuicao';
import { categoriasDoPainel, linhasDePrazoDoPainel } from './dados-do-painel';

const centavos = (v: string | undefined) => paraCentavos(v ?? '0') ?? 0;
const emReais = (n: number) => formatarReais(deCentavos(n));
const reaisCurtos = (n: number) => compacto.format(n / 100);
const compacto = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
});

function VerTudo({ para, children }: { para: string; children: string }) {
  return (
    <Link className="cartao__ver" to={para}>
      {children}
    </Link>
  );
}

type Periodo = '7' | '14' | '30';

/** O atendimento dia a dia, com o período à escolha (os últimos 7, 14 ou 30 dias). */
function CartaoDeTendencia({
  tendencia,
}: {
  tendencia: ReturnType<typeof useTendenciaDoAtendimento>;
}) {
  const [periodo, mudar] = usarPreferencia<Periodo>('tendencia', '30', ['7', '14', '30']);
  const pontos = (tendencia.data?.pontos ?? []).slice(-Number(periodo));
  const recebidas = pontos.reduce((t, p) => t + p.recebidas, 0);
  const concluidas = pontos.reduce((t, p) => t + p.concluidas, 0);
  return (
    <Cartao
      titulo="Atendimento por dia"
      descricao="Demandas recebidas e concluídas."
      icone={<Activity size={18} />}
      acoes={
        <Abas
          segmentada
          discreta
          rotulo="Período do atendimento"
          valor={periodo}
          aoMudar={mudar}
          itens={[
            { id: '7', rotulo: '7 dias' },
            { id: '14', rotulo: '14 dias' },
            { id: '30', rotulo: '30 dias' },
          ]}
        />
      }
      rodape={
        <>
          <span>
            {recebidas} recebidas e {concluidas} concluídas em {periodo} dias
          </span>
          <VerTudo para="/g/demandas">Ver demandas</VerTudo>
        </>
      }
    >
      <AvisoDeErro erro={tendencia.error} />
      {tendencia.isLoading ? <Carregando /> : null}
      {pontos.length > 0 ? <GraficoDeTendencia pontos={pontos} /> : null}
    </Cartao>
  );
}

/** Todos os gráficos do painel; cada um só aparece para quem tem a permissão dele. */
export function GraficosDoPainel({
  veAtendimento,
  veProjetos,
  veFinanceiro,
  veEquipe,
  atendimento,
  tarefas,
  projetos,
  financeiro,
  tendencia,
  equipe,
}: {
  veAtendimento: boolean;
  veProjetos: boolean;
  veFinanceiro: boolean;
  veEquipe: boolean;
  atendimento: ReturnType<typeof usePainelDeAtendimento>;
  tarefas: ReturnType<typeof usePainelDeTarefas>;
  projetos: ReturnType<typeof useConsolidadoDeProjetos>;
  financeiro: ReturnType<typeof usePainelFinanceiro>;
  tendencia: ReturnType<typeof useTendenciaDoAtendimento>;
  equipe: ReturnType<typeof usePainelDaEquipe>;
}) {
  const saldo = financeiro.data?.saldo;
  const emendas = financeiro.data?.emendas ?? null;
  const ate = (saldo?.meses ?? []).filter((m) => m.mes <= (saldo?.mesDeReferencia ?? 0));
  const cota = ate.reduce((t, m) => t + centavos(m.cota ?? '0'), 0);
  const consumido = ate.reduce((t, m) => t + centavos(m.consumido), 0);
  const linhasDePrazo = linhasDePrazoDoPainel({
    atendimento: veAtendimento ? atendimento.data : undefined,
    tarefas: tarefas.data,
    projetos: veProjetos ? projetos.data : undefined,
  });
  const categorias = categoriasDoPainel(saldo);
  const etapasDosProjetos = (projetos.data?.porEtapa ?? []).filter((e) => e.total > 0);

  return (
    <>
      {veAtendimento ? <CartaoDeTendencia tendencia={tendencia} /> : null}

      <div className="painel-duplo">
        {linhasDePrazo.length > 0 ? (
          <Cartao
            titulo="Prazos em dia"
            descricao="No prazo e atrasados, por área."
            icone={<AlarmClock size={18} />}
            rodape={<span>Atrasado é o prazo vencido e ainda em andamento.</span>}
          >
            <FaixaProporcional rotulo="Prazos em dia por área" linhas={linhasDePrazo} />
          </Cartao>
        ) : null}
        {veAtendimento && atendimento.data ? (
          <CartaoDeDistribuicao
            chave="demandas-por-etapa"
            titulo="Demandas por etapa"
            descricao="Onde estão os pedidos hoje."
            icone={<Workflow size={18} />}
            unidade="demandas"
            rodape={
              <>
                <span>{atendimento.data.abertas} em andamento</span>
                <VerTudo para="/g/demandas">Ver quadro</VerTudo>
              </>
            }
            linhas={atendimento.data.porEtapa.map((e) => ({
              id: e.id,
              rotulo: e.nome,
              valor: e.total,
            }))}
          />
        ) : null}
      </div>

      <div className="painel-duplo">
        {veProjetos && projetos.data ? (
          <CartaoDeDistribuicao
            chave="projetos-por-etapa"
            titulo="Projetos por etapa"
            descricao="No fluxo federal; só as etapas com projeto."
            icone={<Landmark size={18} />}
            unidade="projetos"
            vazio="Nenhum projeto cadastrado ainda."
            rodape={
              <>
                <span>{projetos.data.emAndamento} em andamento</span>
                <VerTudo para="/g/projetos">Ver quadro</VerTudo>
              </>
            }
            linhas={etapasDosProjetos.map((e) => ({
              id: e.etapaId,
              rotulo: e.nome,
              valor: e.total,
            }))}
          />
        ) : null}
        {veFinanceiro && emendas ? (
          <CartaoDeDistribuicao
            chave="emendas-execucao"
            titulo="Emendas: execução"
            descricao="Do valor disponibilizado, quanto foi executado."
            icone={<Banknote size={18} />}
            unidade="reais"
            visoes={['rosca', 'barras']}
            padrao="rosca"
            formatar={emReais}
            centro={{
              valor: reaisCurtos(centavos(emendas.disponibilizado)),
              rotulo: 'disponibilizados',
            }}
            rodape={<VerTudo para="/g/emendas">Ver emendas</VerTudo>}
            linhas={[
              { id: 'exec', rotulo: 'Executado', valor: centavos(emendas.utilizado) },
              { id: 'falta', rotulo: 'A executar', valor: centavos(emendas.aExecutar) },
              { id: 'livre', rotulo: 'Ainda a destinar', valor: centavos(emendas.disponivel) },
            ]}
          />
        ) : null}
      </div>

      {veFinanceiro && saldo ? (
        <div className="painel-duplo">
          <Cartao
            titulo="CEAP: cota e consumo"
            descricao={`Mês a mês em ${saldo.ano}.`}
            icone={<Wallet size={18} />}
            rodape={
              <>
                <span>
                  {emReais(consumido)} de {emReais(cota)} até agora
                </span>
                <VerTudo para="/g/ceap">Ver CEAP</VerTudo>
              </>
            }
          >
            <ColunasMensais meses={saldo.meses} mesDeReferencia={saldo.mesDeReferencia} />
          </Cartao>
          {categorias.length > 0 ? (
            <CartaoDeDistribuicao
              chave="ceap-por-categoria"
              titulo="CEAP por categoria"
              descricao="As que mais consumiram no ano."
              icone={<Tags size={18} />}
              unidade="reais"
              padrao="rosca"
              formatar={emReais}
              formatarCentro={reaisCurtos}
              rodape={<VerTudo para="/g/ceap">Ver despesas</VerTudo>}
              linhas={categorias.map((c) => ({ id: c.id, rotulo: c.rotulo, valor: c.valor }))}
            />
          ) : null}
        </div>
      ) : null}

      {veEquipe ? (
        <>
          <AvisoDeErro erro={equipe.error} />
          {equipe.isLoading ? <Carregando /> : null}
          {equipe.data ? <CartaoDaEquipe dados={equipe.data} /> : null}
        </>
      ) : null}
    </>
  );
}
