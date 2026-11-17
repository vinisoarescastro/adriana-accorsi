import {
  formatarCep,
  formatarCnpj,
  naturezasDeBeneficiario,
  type BeneficiarioDto,
  type NaturezaDeBeneficiarioDto,
  type RespostaDaSessao,
} from '@gabinete/compartilhado';
import { Building2, Plus } from 'lucide-react';
import { useState } from 'react';
import { useBeneficiarios } from '../api/legislativo';
import { CabecalhoDaPagina } from '../componentes/cabecalho';
import { EstadoVazio } from '../componentes/dicas';
import { BarraDeFiltros } from '../componentes/filtros';
import { CelulaDoItem } from '../componentes/lista';
import { EsqueletoDeTabela, Paginacao } from '../componentes/tabela';
import { AvisoDeErro, Botao, Selo } from '../componentes/ui';
import { rotuloDaNaturezaDoBeneficiario } from '../rotulos';
import { FormularioDeBeneficiario } from './FormularioDeBeneficiario';

/**
 * Beneficiários: municípios, órgãos e entidades, por CNPJ. Os mesmos cadastros serão usados pelas
 * emendas. Quem tem a habilitação Legislativo ou Financeiro alcança a página.
 */
export function PaginaBeneficiarios({ sessao }: { sessao: RespostaDaSessao }) {
  const [termo, setTermo] = useState('');
  const [situacao, setSituacao] = useState<'ativo' | 'inativo' | ''>('ativo');
  const [natureza, setNatureza] = useState<NaturezaDeBeneficiarioDto | ''>('');
  const [pagina, setPagina] = useState(1);
  const [aberto, setAberto] = useState<BeneficiarioDto | 'novo' | null>(null);

  const lista = useBeneficiarios({ pagina, busca: termo, situacao, natureza });
  const totalDePaginas = lista.data
    ? Math.max(1, Math.ceil(lista.data.total / lista.data.porPagina))
    : 1;

  return (
    <section>
      <CabecalhoDaPagina
        titulo="Beneficiários"
        descricao="Municípios, órgãos e entidades, identificados pelo CNPJ."
        acoes={
          <Botao icone={<Plus size={16} aria-hidden="true" />} onClick={() => setAberto('novo')}>
            Novo beneficiário
          </Botao>
        }
      />

      <BarraDeFiltros
        rotulo="Filtros dos beneficiários"
        termo={termo}
        aoBuscar={(t) => {
          setTermo(t);
          setPagina(1);
        }}
        placeholder="Buscar por nome, razão social, cidade ou CNPJ"
        ativos={Boolean(termo || natureza || situacao !== 'ativo')}
        aoLimpar={() => {
          setTermo('');
          setNatureza('');
          setSituacao('ativo');
          setPagina(1);
        }}
        filtros={
          <>
            <select
              className="filtros__selecao"
              aria-label="Situação"
              value={situacao}
              onChange={(e) => {
                setSituacao(e.target.value as 'ativo' | 'inativo' | '');
                setPagina(1);
              }}
            >
              <option value="ativo">Ativos</option>
              <option value="inativo">Inativos</option>
              <option value="">Todos</option>
            </select>
            <select
              className="filtros__selecao"
              aria-label="Natureza"
              value={natureza}
              onChange={(e) => {
                setNatureza(e.target.value as NaturezaDeBeneficiarioDto | '');
                setPagina(1);
              }}
            >
              <option value="">Todas as naturezas</option>
              {naturezasDeBeneficiario.map((n) => (
                <option key={n} value={n}>
                  {rotuloDaNaturezaDoBeneficiario[n]}
                </option>
              ))}
            </select>
          </>
        }
      />

      <AvisoDeErro erro={lista.error} />
      {lista.isLoading ? (
        <EsqueletoDeTabela colunas={4} />
      ) : lista.data ? (
        <div className="cartao cartao--tabela">
          <div className="tabela-rolavel">
            <table className="tabela">
              <caption>
                {lista.data.total} beneficiário(s), página {lista.data.pagina} de {totalDePaginas}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Beneficiário</th>
                  <th scope="col">CNPJ</th>
                  <th scope="col">Cidade</th>
                  <th scope="col">Natureza</th>
                </tr>
              </thead>
              <tbody>
                {lista.data.itens.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <CelulaDoItem
                        titulo={b.nomeFantasia}
                        apoio={[b.razaoSocial]}
                        aoAbrir={() => setAberto(b)}
                      />
                    </td>
                    <td>{formatarCnpj(b.cnpj)}</td>
                    <td>
                      {b.cidade}/{b.estado}
                      <span className="tabela__discreto"> · CEP {formatarCep(b.cep)}</span>
                    </td>
                    <td>
                      {rotuloDaNaturezaDoBeneficiario[b.natureza]}
                      {b.situacao === 'inativo' ? (
                        <>
                          {' '}
                          <Selo tom="neutro">Inativo</Selo>
                        </>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {lista.data.itens.length === 0 ? (
            <EstadoVazio
              icone={<Building2 size={24} />}
              titulo="Nenhum beneficiário encontrado."
              texto="Ajuste os filtros ou cadastre um beneficiário novo."
            />
          ) : null}
          <Paginacao
            pagina={lista.data.pagina}
            totalDePaginas={totalDePaginas}
            aoMudar={setPagina}
          />
        </div>
      ) : null}

      {aberto ? (
        <FormularioDeBeneficiario
          key={aberto === 'novo' ? 'novo' : aberto.id}
          sessao={sessao}
          beneficiario={aberto === 'novo' ? undefined : aberto}
          aoFechar={() => setAberto(null)}
        />
      ) : null}
    </section>
  );
}
