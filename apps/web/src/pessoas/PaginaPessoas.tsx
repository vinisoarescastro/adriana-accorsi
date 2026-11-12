import { pode } from '@gabinete/autorizacao';
import type { PessoaDto, RespostaDaSessao } from '@gabinete/compartilhado';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Fragment, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { chavesDoAtendimento, usePessoas } from '../api/atendimento';
import { chamar } from '../api/cliente';
import { Aviso, AvisoDeErro, Botao, Campo, Carregando, Selo } from '../componentes/ui';

const rotuloDaSituacao = {
  ativa: 'Ativa',
  inativa: 'Inativa',
  dados_eliminados: 'Dados eliminados',
} as const;

function FormularioDePessoa({
  pessoa,
  aoConcluir,
}: {
  pessoa?: PessoaDto;
  aoConcluir: () => void;
}) {
  const cliente = useQueryClient();
  const [nome, setNome] = useState(pessoa?.nomeCompleto ?? '');
  const [telefone, setTelefone] = useState(pessoa?.telefone ?? '');
  const [email, setEmail] = useState(pessoa?.email ?? '');
  const [contatos, setContatos] = useState(pessoa?.contatos ?? '');
  const [endereco, setEndereco] = useState(pessoa?.endereco ?? '');

  const salvar = useMutation({
    mutationFn: () =>
      pessoa
        ? chamar<PessoaDto>('PATCH', `/api/pessoas/${pessoa.id}`, {
            corpo: {
              nome,
              telefone,
              email: email || null,
              contatos: contatos || null,
              endereco: endereco || null,
            },
          })
        : chamar<PessoaDto>('POST', '/api/pessoas', {
            corpo: {
              nome,
              telefone,
              ...(email ? { email } : {}),
              ...(contatos ? { contatos } : {}),
              ...(endereco ? { endereco } : {}),
            },
          }),
    onSuccess: async () => {
      await cliente.invalidateQueries({ queryKey: chavesDoAtendimento.tudo });
      aoConcluir();
    },
  });

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    salvar.mutate();
  };

  return (
    <form className="painel-do-usuario" onSubmit={enviar} noValidate>
      <h3>{pessoa ? 'Alterar pessoa' : 'Nova pessoa'}</h3>
      <AvisoDeErro erro={salvar.error} />
      <div className="grade-formulario">
        <Campo rotulo="Nome completo">
          {(p) => (
            <input
              {...p}
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
              maxLength={160}
            />
          )}
        </Campo>
        <Campo rotulo="Telefone" ajuda="Com DDD. Identifica a pessoa: não pode repetir.">
          {(p) => (
            <input
              {...p}
              type="tel"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              required
            />
          )}
        </Campo>
        <Campo rotulo="E-mail (opcional)">
          {(p) => (
            <input {...p} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          )}
        </Campo>
        <Campo rotulo="Outros contatos (opcional)">
          {(p) => (
            <input
              {...p}
              value={contatos}
              onChange={(e) => setContatos(e.target.value)}
              maxLength={500}
            />
          )}
        </Campo>
        <Campo rotulo="Endereço (opcional)">
          {(p) => (
            <input
              {...p}
              value={endereco}
              onChange={(e) => setEndereco(e.target.value)}
              maxLength={300}
            />
          )}
        </Campo>
      </div>
      <div className="acoes">
        <Botao
          type="submit"
          pequeno
          disabled={salvar.isPending || !nome.trim() || !telefone.trim()}
        >
          Salvar
        </Botao>
        <Botao pequeno variante="secundario" onClick={aoConcluir}>
          Cancelar
        </Botao>
      </div>
    </form>
  );
}

function AcoesDaPessoa({ pessoa, sessao }: { pessoa: PessoaDto; sessao: RespostaDaSessao }) {
  const cliente = useQueryClient();
  const autoridade = { perfil: sessao.usuario.perfil, habilitacoes: sessao.usuario.habilitacoes };
  const [editando, setEditando] = useState(false);
  const atualizar = () => cliente.invalidateQueries({ queryKey: chavesDoAtendimento.tudo });

  const situacao = useMutation({
    mutationFn: () =>
      chamar('PUT', `/api/pessoas/${pessoa.id}/situacao`, {
        corpo: { situacao: pessoa.situacao === 'ativa' ? 'inativa' : 'ativa' },
      }),
    onSuccess: atualizar,
  });
  const eliminar = useMutation({
    mutationFn: () =>
      chamar('POST', `/api/pessoas/${pessoa.id}/eliminar-dados`, { corpo: { confirmo: true } }),
    onSuccess: atualizar,
  });

  if (pessoa.situacao === 'dados_eliminados')
    return <span className="campo__ajuda">Sem ações</span>;

  return (
    <div>
      <AvisoDeErro erro={situacao.error ?? eliminar.error} />
      <div className="acoes">
        {pode('pessoas.manter', autoridade) ? (
          <Botao
            pequeno
            variante="secundario"
            onClick={() => setEditando((v) => !v)}
            aria-expanded={editando}
          >
            {editando ? 'Fechar' : 'Alterar'}
          </Botao>
        ) : null}
        {pode('pessoas.inativar', autoridade) ? (
          <Botao
            pequeno
            variante="secundario"
            onClick={() => situacao.mutate()}
            disabled={situacao.isPending}
          >
            {pessoa.situacao === 'ativa' ? 'Inativar' : 'Reativar'}
          </Botao>
        ) : null}
        {pode('pessoas.eliminar_dados', autoridade) ? (
          <Botao
            pequeno
            variante="perigo"
            disabled={eliminar.isPending}
            onClick={() => {
              if (
                window.confirm(
                  'Eliminar os dados pessoais desta pessoa? Isso NÃO pode ser desfeito. Protocolos e histórico são mantidos, sem identificá-la.',
                )
              ) {
                eliminar.mutate();
              }
            }}
          >
            Eliminar dados
          </Botao>
        ) : null}
        <Link
          className="botao botao--secundario botao--pequeno"
          to={`/g/demandas?solicitante=${pessoa.id}`}
        >
          Ver demandas
        </Link>
      </div>
      {editando ? (
        <FormularioDePessoa pessoa={pessoa} aoConcluir={() => setEditando(false)} />
      ) : null}
    </div>
  );
}

export function PaginaPessoas({ sessao }: { sessao: RespostaDaSessao }) {
  const [busca, setBusca] = useState('');
  const [termo, setTermo] = useState('');
  const [situacao, setSituacao] = useState('');
  const [pagina, setPagina] = useState(1);
  const [criando, setCriando] = useState(false);
  const { data, isLoading, error } = usePessoas({ pagina, busca: termo, situacao });
  const autoridade = { perfil: sessao.usuario.perfil, habilitacoes: sessao.usuario.habilitacoes };
  const totalDePaginas = data ? Math.max(1, Math.ceil(data.total / data.porPagina)) : 1;

  return (
    <section>
      <h1>Pessoas</h1>
      <p>
        O cidadão atendido. O telefone identifica a pessoa; não há duas pessoas ativas com o mesmo
        número.
      </p>
      {pode('pessoas.manter', autoridade) && !criando ? (
        <p>
          <Botao onClick={() => setCriando(true)}>Nova pessoa</Botao>
        </p>
      ) : null}
      {criando ? (
        <div className="cartao">
          <FormularioDePessoa aoConcluir={() => setCriando(false)} />
        </div>
      ) : null}

      <form
        className="cartao"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          setTermo(busca.trim());
          setPagina(1);
        }}
      >
        <div className="grade-formulario">
          <Campo rotulo="Buscar" ajuda="Nome ou parte do telefone.">
            {(p) => (
              <input
                {...p}
                type="search"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            )}
          </Campo>
          <Campo rotulo="Situação">
            {(p) => (
              <select
                {...p}
                value={situacao}
                onChange={(e) => {
                  setSituacao(e.target.value);
                  setPagina(1);
                }}
              >
                <option value="">Todas</option>
                <option value="ativa">Ativas</option>
                <option value="inativa">Inativas</option>
                <option value="dados_eliminados">Dados eliminados</option>
              </select>
            )}
          </Campo>
        </div>
        <Botao type="submit" pequeno>
          Buscar
        </Botao>
      </form>

      <AvisoDeErro erro={error} />
      {isLoading ? <Carregando /> : null}
      {data ? (
        <div className="cartao tabela-rolavel">
          <table className="tabela">
            <caption>
              {data.total} pessoa(s), página {data.pagina} de {totalDePaginas}
            </caption>
            <thead>
              <tr>
                <th scope="col">Nome</th>
                <th scope="col">Telefone</th>
                <th scope="col">E-mail</th>
                <th scope="col">Situação</th>
                <th scope="col">Ações</th>
              </tr>
            </thead>
            <tbody>
              {data.itens.map((p) => (
                <Fragment key={p.id}>
                  <tr>
                    <td>{p.nomeCompleto ?? 'Dados eliminados'}</td>
                    <td>{p.telefone ?? '-'}</td>
                    <td>{p.email ?? '-'}</td>
                    <td>
                      <Selo tipo={p.situacao === 'ativa' ? 'ativo' : 'inativo'}>
                        {rotuloDaSituacao[p.situacao]}
                      </Selo>
                    </td>
                    <td>
                      <AcoesDaPessoa pessoa={p} sessao={sessao} />
                    </td>
                  </tr>
                </Fragment>
              ))}
            </tbody>
          </table>
          {data.itens.length === 0 ? (
            <Aviso tipo="atencao" titulo="Nenhuma pessoa encontrada." />
          ) : null}
          <div className="acoes" style={{ marginTop: 'var(--espaco-4)' }}>
            <Botao
              variante="secundario"
              onClick={() => setPagina((p) => p - 1)}
              disabled={pagina <= 1}
            >
              Anterior
            </Botao>
            <Botao
              variante="secundario"
              onClick={() => setPagina((p) => p + 1)}
              disabled={pagina >= totalDePaginas}
            >
              Próxima
            </Botao>
          </div>
        </div>
      ) : null}
    </section>
  );
}
