import {
  descricaoDosParametros,
  formatarReais,
  chavesDeParametroDaCeap,
  type CategoriaDaCeapDto,
  type ChaveDeParametroDaCeapDto,
} from '@gabinete/compartilhado';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { chamar } from '../api/cliente';
import { chavesDoFinanceiro, useCategoriasDaCeap, useParametrosDaCeap } from '../api/financeiro';
import {
  CampoDeDinheiro,
  dinheiroValido,
  normalizarDinheiroDigitado,
} from '../componentes/campo-de-dinheiro';
import { formatarPrazo } from '../componentes/quadro';
import { useToast } from '../componentes/toast';
import { Aviso, AvisoDeErro, Botao, Campo, Carregando, Selo } from '../componentes/ui';
import { hojeNoGabinete } from '../formatos';

const exibir = (chave: ChaveDeParametroDaCeapDto, valor: string) => {
  const t = descricaoDosParametros[chave].tipo;
  return t === 'dinheiro'
    ? formatarReais(valor)
    : `${Number(valor)} ${t === 'dias' ? 'dias' : 'anos'}`;
};

function NovaVigencia({ chave }: { chave: ChaveDeParametroDaCeapDto }) {
  const cliente = useQueryClient();
  const avisar = useToast();
  const tipo = descricaoDosParametros[chave].tipo;
  const [valor, setValor] = useState('');
  const [de, setDe] = useState(hojeNoGabinete());
  const salvar = useMutation({
    mutationFn: () =>
      chamar<unknown>('POST', '/api/ceap/parametros', {
        corpo: {
          chave,
          valor: tipo === 'dinheiro' ? normalizarDinheiroDigitado(valor) : valor,
          vigenteDe: de,
        },
      }),
    onSuccess: async () => {
      await cliente.invalidateQueries({ queryKey: chavesDoFinanceiro.tudo });
      setValor('');
      avisar({ tom: 'sucesso', titulo: 'Nova vigência aberta' });
    },
  });
  const ok =
    tipo === 'dinheiro'
      ? chave === 'limite_alerta_saldo'
        ? /^\d+([.,]\d{1,2})?$/.test(valor.trim())
        : dinheiroValido(valor)
      : /^\d{1,4}$/.test(valor) && Number(valor) > 0;
  return (
    <form
      className="ficha-edicao"
      aria-label={`Nova vigência de ${descricaoDosParametros[chave].rotulo}`}
      onSubmit={(e) => {
        e.preventDefault();
        salvar.mutate();
      }}
    >
      <AvisoDeErro erro={salvar.error} />
      {tipo === 'dinheiro' ? (
        <CampoDeDinheiro rotulo="Novo valor" valor={valor} aoMudar={setValor} obrigatorio={false} />
      ) : (
        <Campo rotulo={`Novo valor (${tipo})`}>
          {(p) => (
            <input
              {...p}
              inputMode="numeric"
              value={valor}
              onChange={(e) => setValor(e.target.value.replace(/\D/g, ''))}
            />
          )}
        </Campo>
      )}
      <Campo
        rotulo="Vale a partir de"
        ajuda="A vigência anterior termina no dia anterior; começa depois da última."
      >
        {(p) => (
          <input {...p} type="date" required value={de} onChange={(e) => setDe(e.target.value)} />
        )}
      </Campo>
      <div className="acoes">
        <Botao type="submit" pequeno disabled={!ok || !de} carregando={salvar.isPending}>
          Abrir vigência
        </Botao>
      </div>
    </form>
  );
}

function Categorias() {
  const cliente = useQueryClient();
  const avisar = useToast();
  const { data } = useCategoriasDaCeap();
  const [nome, setNome] = useState('');
  const [teto, setTeto] = useState('');
  const atualizar = () => cliente.invalidateQueries({ queryKey: chavesDoFinanceiro.tudo });
  const criar = useMutation({
    mutationFn: () =>
      chamar<CategoriaDaCeapDto[]>('POST', '/api/ceap/categorias', {
        corpo: {
          nome: nome.trim(),
          ...(teto.trim() ? { tetoMensal: normalizarDinheiroDigitado(teto) } : {}),
          comprovanteObrigatorio: true,
        },
      }),
    onSuccess: async () => {
      await atualizar();
      setNome('');
      setTeto('');
      avisar({ tom: 'sucesso', titulo: 'Categoria criada' });
    },
  });
  const situacao = useMutation({
    mutationFn: ({ id, nova }: { id: number; nova: 'ativa' | 'inativa' }) =>
      chamar<unknown>('PUT', `/api/ceap/categorias/${id}/situacao`, { corpo: { situacao: nova } }),
    onSuccess: atualizar,
  });
  const comprovante = useMutation({
    mutationFn: ({ id, obrigatorio }: { id: number; obrigatorio: boolean }) =>
      chamar<unknown>('PATCH', `/api/ceap/categorias/${id}`, {
        corpo: { comprovanteObrigatorio: obrigatorio },
      }),
    onSuccess: atualizar,
  });
  return (
    <div className="cartao">
      <h2 className="cartao__titulo">Categorias de despesa</h2>
      <p className="campo__ajuda">
        A lista inicial é uma proposta, sem tetos. Ajuste conforme a norma vigente. Desativar não
        apaga: as despesas antigas mantêm a categoria.
      </p>
      <AvisoDeErro erro={criar.error ?? situacao.error ?? comprovante.error} />
      <div className="tabela-rolavel">
        <table className="tabela">
          <caption className="somente-leitor">Categorias de despesa da CEAP</caption>
          <thead>
            <tr>
              <th scope="col">Categoria</th>
              <th scope="col" className="e-numero">
                Teto mensal
              </th>
              <th scope="col">Comprovante</th>
              <th scope="col">Situação</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((c) => (
              <tr key={c.id}>
                <td>{c.nome}</td>
                <td className="e-numero">
                  {c.tetoMensal ? (
                    formatarReais(c.tetoMensal)
                  ) : (
                    <span className="tabela__discreto">sem teto</span>
                  )}
                </td>
                <td>
                  <label className="opcao">
                    <input
                      type="checkbox"
                      checked={c.comprovanteObrigatorio}
                      onChange={(e) =>
                        comprovante.mutate({ id: c.id, obrigatorio: e.target.checked })
                      }
                    />
                    Obrigatório
                  </label>
                </td>
                <td>
                  {c.situacao === 'ativa' ? (
                    <Selo tom="sucesso">Ativa</Selo>
                  ) : (
                    <Selo tom="neutro">Inativa</Selo>
                  )}{' '}
                  <Botao
                    pequeno
                    variante="fantasma"
                    onClick={() =>
                      situacao.mutate({
                        id: c.id,
                        nova: c.situacao === 'ativa' ? 'inativa' : 'ativa',
                      })
                    }
                  >
                    {c.situacao === 'ativa' ? 'Desativar' : 'Reativar'}
                  </Botao>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form
        className="ficha-edicao"
        aria-label="Nova categoria"
        onSubmit={(e) => {
          e.preventDefault();
          criar.mutate();
        }}
      >
        <Campo rotulo="Nova categoria">
          {(p) => (
            <input
              {...p}
              required
              maxLength={100}
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
          )}
        </Campo>
        <CampoDeDinheiro
          rotulo="Teto mensal (opcional)"
          valor={teto}
          aoMudar={setTeto}
          obrigatorio={false}
        />
        <div className="acoes">
          <Botao
            type="submit"
            pequeno
            disabled={!nome.trim() || (teto.trim() !== '' && !dinheiroValido(teto))}
            carregando={criar.isPending}
          >
            Criar categoria
          </Botao>
        </div>
      </form>
    </div>
  );
}

/** Parâmetros com vigência e categorias (Administrador e Parlamentar). Nenhum valor vem preenchido: vêm da norma vigente. */
export function ParametrosDaCeap() {
  const { data, isLoading, error } = useParametrosDaCeap();
  return (
    <div className="painel">
      <Aviso tipo="info" titulo="Nada da norma fica no código.">
        Cota, prazos e limites são dados com vigência: alterar um valor fecha a vigência anterior e
        abre a nova, e o saldo de períodos passados continua reconstituível. Confira os valores na
        norma vigente da Câmara.
      </Aviso>
      <AvisoDeErro erro={error} />
      {isLoading ? <Carregando /> : null}
      {data
        ? chavesDeParametroDaCeap.map((chave) => {
            const vigente = data.vigentes[chave];
            const historico = data.historico.filter((p) => p.chave === chave);
            return (
              <div className="cartao" key={chave}>
                <h2 className="cartao__titulo">{descricaoDosParametros[chave].rotulo}</h2>
                <p>
                  {vigente ? (
                    <>
                      Vale hoje: <strong>{exibir(chave, vigente.valor)}</strong> desde{' '}
                      {formatarPrazo(vigente.vigenteDe)}.
                    </>
                  ) : (
                    <span className="campo__ajuda">Nenhum valor vigente. Cadastre abaixo.</span>
                  )}
                </p>
                {historico.length > 1 ? (
                  <ul className="lista-simples">
                    {historico.map((p) => (
                      <li key={p.id}>
                        {exibir(chave, p.valor)} · de {formatarPrazo(p.vigenteDe)}{' '}
                        {p.vigenteAte ? `a ${formatarPrazo(p.vigenteAte)}` : 'em diante'}
                        <span className="propriedades__apoio"> {p.definidoPor}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <NovaVigencia chave={chave} />
              </div>
            );
          })
        : null}
      <Categorias />
    </div>
  );
}
