import { pode } from '@gabinete/autorizacao';
import type { RespostaDaSessao, StatusDeDespesa } from '@gabinete/compartilhado';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { useSaldoDaCeap } from '../api/financeiro';
import { Abas } from '../componentes/abas';
import { CabecalhoDaPagina } from '../componentes/cabecalho';
import { AvisoDeErro, Carregando } from '../componentes/ui';
import { hojeNoGabinete } from '../formatos';
import { DespesasDaCeap } from './DespesasDaCeap';
import { ParametrosDaCeap } from './ParametrosDaCeap';
import { RelatorioDaCeap } from './RelatorioDaCeap';
import { VisaoGeralDaCeap } from './VisaoGeralDaCeap';

type Aba = 'visao' | 'despesas' | 'parametros' | 'relatorio';

/**
 * CEAP: controle interno e preparação da prestação de contas (não substitui o sistema da Câmara). O saldo é
 * derivado; os parâmetros têm vigência. A ficha da despesa abre pelo endereço (`?despesa=<id>`).
 */
export function PaginaCeap({ sessao }: { sessao: RespostaDaSessao }) {
  const autoridade = { perfil: sessao.usuario.perfil, habilitacoes: sessao.usuario.habilitacoes };
  const [parametros, definirParametros] = useSearchParams();
  const aberta = Number(parametros.get('despesa')) || null;
  const [aba, setAba] = useState<Aba>(aberta ? 'despesas' : 'visao');
  const [ano, setAno] = useState(Number(hojeNoGabinete().slice(0, 4)));
  const [statusInicial, setStatusInicial] = useState<StatusDeDespesa | ''>('');
  const saldo = useSaldoDaCeap(ano);
  const anoAtual = Number(hojeNoGabinete().slice(0, 4));
  const anosDisponiveis = [
    ...new Set([anoAtual - 3, anoAtual - 2, anoAtual - 1, anoAtual, anoAtual + 1, ano]),
  ].sort((x, y) => y - x);

  const abrir = (id: number | null) => {
    const novos = new URLSearchParams(parametros);
    if (id === null) novos.delete('despesa');
    else novos.set('despesa', String(id));
    definirParametros(novos);
  };
  const itens: { id: Aba; rotulo: string }[] = [
    { id: 'visao', rotulo: 'Saldo' },
    { id: 'despesas', rotulo: 'Despesas' },
    ...(pode('ceap.parametros', autoridade)
      ? [{ id: 'parametros' as const, rotulo: 'Parâmetros' }]
      : []),
    ...(pode('ceap.pacote', autoridade) ? [{ id: 'relatorio' as const, rotulo: 'Relatório' }] : []),
  ];

  return (
    <section>
      <CabecalhoDaPagina
        titulo="CEAP"
        descricao="Cota para o Exercício da Atividade Parlamentar: controle interno e preparação da prestação de contas."
      />
      <div className="ceap-barra">
        <Abas segmentada rotulo="Seções da CEAP" valor={aba} aoMudar={setAba} itens={itens} />
        {aba === 'visao' || aba === 'despesas' ? (
          <label className="ceap-barra__exercicio">
            <span>Exercício</span>
            <select
              className="filtros__selecao"
              value={ano}
              onChange={(e) => setAno(Number(e.target.value))}
            >
              {anosDisponiveis.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {aba === 'visao' ? (
        <>
          <AvisoDeErro erro={saldo.error} />
          {saldo.isLoading ? <Carregando /> : null}
          {saldo.data ? (
            <VisaoGeralDaCeap
              saldo={saldo.data}
              sessao={sessao}
              aoVerAguardando={() => {
                setStatusInicial('em_analise');
                setAba('despesas');
              }}
            />
          ) : null}
        </>
      ) : null}
      {aba === 'despesas' ? (
        <DespesasDaCeap
          key={statusInicial}
          sessao={sessao}
          ano={ano}
          statusInicial={statusInicial}
          aberta={aberta}
          aoAbrir={abrir}
          podeLancar={pode('ceap.lancar', autoridade)}
        />
      ) : null}
      {aba === 'parametros' ? <ParametrosDaCeap /> : null}
      {aba === 'relatorio' ? <RelatorioDaCeap sessao={sessao} /> : null}
    </section>
  );
}
