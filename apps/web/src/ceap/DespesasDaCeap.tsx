import {
  formatarReais,
  statusDeDespesa,
  type RespostaDaSessao,
  type StatusDeDespesa,
} from '@gabinete/compartilhado';
import { Plus, UserRound, Wallet } from 'lucide-react';
import { useState } from 'react';
import { useDespesas } from '../api/financeiro';
import { EstadoVazio } from '../componentes/dicas';
import { BarraDeFiltros, FiltroRapido } from '../componentes/filtros';
import { CelulaDoItem } from '../componentes/lista';
import { formatarPrazo } from '../componentes/quadro';
import { EsqueletoDeTabela, Paginacao } from '../componentes/tabela';
import { AvisoDeErro, Botao, Selo } from '../componentes/ui';
import { nomesDosMeses, rotuloDoStatusDaDespesa } from '../rotulos';
import { FichaDaDespesa } from './FichaDaDespesa';
import { NovaDespesa } from './NovaDespesa';

const tomDoStatus: Record<StatusDeDespesa, 'primario' | 'sucesso' | 'perigo' | 'neutro'> = {
  lancada: 'neutro',
  em_analise: 'primario',
  aprovada: 'sucesso',
  apresentada: 'sucesso',
  ressarcida: 'sucesso',
  reprovada: 'perigo',
  glosada: 'perigo',
  arquivada: 'neutro',
  cancelada: 'perigo',
};

/** A lista de despesas do exercício, com filtros e paginação no servidor; a ficha abre numa gaveta (`?despesa=<id>`). */
export function DespesasDaCeap({
  sessao,
  ano,
  statusInicial,
  aberta,
  aoAbrir,
  podeLancar,
}: {
  sessao: RespostaDaSessao;
  ano: number;
  statusInicial: StatusDeDespesa | '';
  aberta: number | null;
  aoAbrir: (id: number | null) => void;
  podeLancar: boolean;
}) {
  const [criando, setCriando] = useState(false);
  const [termo, setTermo] = useState('');
  const [status, setStatus] = useState<StatusDeDespesa | ''>(statusInicial);
  const [mes, setMes] = useState('');
  const [minhas, setMinhas] = useState(false);
  const [pagina, setPagina] = useState(1);
  const lista = useDespesas({
    pagina,
    busca: termo,
    status,
    ano,
    mes: mes ? Number(mes) : undefined,
    minhas,
  });
  const total = lista.data ? Math.max(1, Math.ceil(lista.data.total / lista.data.porPagina)) : 1;

  return (
    <div className="painel">
      {podeLancar ? (
        <div className="acoes">
          <Botao icone={<Plus size={16} aria-hidden="true" />} onClick={() => setCriando(true)}>
            Lançar despesa
          </Botao>
        </div>
      ) : null}
      {criando ? (
        <NovaDespesa
          sessao={sessao}
          aoFechar={() => setCriando(false)}
          aoAbrir={(id) => {
            setCriando(false);
            aoAbrir(id);
          }}
        />
      ) : null}
      <BarraDeFiltros
        rotulo="Filtros das despesas"
        termo={termo}
        aoBuscar={(t) => {
          setTermo(t);
          setPagina(1);
        }}
        placeholder="Buscar por descrição, fornecedor ou número"
        ativos={Boolean(termo || status || mes || minhas)}
        aoLimpar={() => {
          setTermo('');
          setStatus('');
          setMes('');
          setMinhas(false);
          setPagina(1);
        }}
        filtros={
          <>
            <select
              className="filtros__selecao"
              aria-label="Situação"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as StatusDeDespesa | '');
                setPagina(1);
              }}
            >
              <option value="">Todas as situações</option>
              {statusDeDespesa.map((s) => (
                <option key={s} value={s}>
                  {rotuloDoStatusDaDespesa[s]}
                </option>
              ))}
            </select>
            <select
              className="filtros__selecao"
              aria-label="Mês"
              value={mes}
              onChange={(e) => {
                setMes(e.target.value);
                setPagina(1);
              }}
            >
              <option value="">Todos os meses</option>
              {nomesDosMeses.map((n, i) => (
                <option key={n} value={i + 1}>
                  {n}
                </option>
              ))}
            </select>
            <FiltroRapido
              rotulo="Minhas"
              icone={<UserRound size={14} aria-hidden="true" />}
              ativo={minhas}
              aoAlternar={(v) => {
                setMinhas(v);
                setPagina(1);
              }}
            />
          </>
        }
      />
      <AvisoDeErro erro={lista.error} />
      {lista.isLoading ? (
        <EsqueletoDeTabela colunas={5} />
      ) : lista.data ? (
        <div className="cartao cartao--tabela">
          <div className="tabela-rolavel">
            <table className="tabela">
              <caption>
                {lista.data.total} despesa(s) em {ano}, página {lista.data.pagina} de {total}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Despesa</th>
                  <th scope="col">Categoria</th>
                  <th scope="col">Data</th>
                  <th scope="col" className="e-numero">
                    Valor
                  </th>
                  <th scope="col">Situação</th>
                </tr>
              </thead>
              <tbody>
                {lista.data.itens.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <CelulaDoItem
                        titulo={d.descricao}
                        apoio={[
                          d.fornecedor.nome,
                          d.foraDoPrazo ? 'Fora do prazo de apresentação' : null,
                        ]}
                        aoAbrir={() => aoAbrir(d.id)}
                      />
                    </td>
                    <td>{d.categoria.nome}</td>
                    <td>{formatarPrazo(d.dataDocumento)}</td>
                    <td className="e-numero">{formatarReais(d.valor)}</td>
                    <td>
                      <Selo tom={tomDoStatus[d.status]} ponto>
                        {rotuloDoStatusDaDespesa[d.status]}
                      </Selo>
                      {d.decisaoPeloProprioLancador ? (
                        <span className="propriedades__apoio">Decidida por quem lançou</span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {lista.data.itens.length === 0 ? (
            <EstadoVazio
              icone={<Wallet size={24} />}
              titulo="Nenhuma despesa encontrada."
              texto="Ajuste os filtros ou lance uma despesa."
            />
          ) : null}
          <Paginacao pagina={lista.data.pagina} totalDePaginas={total} aoMudar={setPagina} />
        </div>
      ) : null}
      {aberta ? (
        <FichaDaDespesa id={aberta} sessao={sessao} aoFechar={() => aoAbrir(null)} />
      ) : null}
    </div>
  );
}
