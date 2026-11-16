import { pode } from '@gabinete/autorizacao';
import type { PessoaDto, RespostaDaSessao } from '@gabinete/compartilhado';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { chavesDoAtendimento, usePessoas } from '../api/atendimento';
import { chamar } from '../api/cliente';
import { ConsentimentoDeNotificacao } from '../componentes/ConsentimentoDeNotificacao';
import {
  BellRing,
  ExternalLink,
  Pencil,
  Plus,
  Power,
  Search,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { CabecalhoDaPagina } from '../componentes/cabecalho';
import { EstadoVazio } from '../componentes/dicas';
import { MenuSuspenso, type ItemDeMenu } from '../componentes/menu';
import { iniciais } from '../formatos';
import { Modal, useConfirmacao } from '../componentes/modal';
import { BarraDeFerramentas, EsqueletoDeTabela, Paginacao } from '../componentes/tabela';
import { AvisoDeErro, Botao, Campo, Selo } from '../componentes/ui';
import { FichaDaPessoa } from './FichaDaPessoa';
import { rotuloDaSituacao, rotuloDosAvisos } from './rotulos-da-pessoa';

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
  const { pedir, elemento: confirmacao } = useConfirmacao();
  const cliente = useQueryClient();
  const autoridade = { perfil: sessao.usuario.perfil, habilitacoes: sessao.usuario.habilitacoes };
  const [editando, setEditando] = useState(false);
  const [avisos, setAvisos] = useState(false);
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

  const itens: ItemDeMenu[] = [];
  if (pode('pessoas.manter', autoridade))
    itens.push({
      rotulo: 'Alterar',
      icone: <Pencil size={16} aria-hidden="true" />,
      aoEscolher: () => setEditando(true),
    });
  if (pode('consentimento.registrar', autoridade))
    itens.push({
      rotulo: 'Avisos por e-mail',
      icone: <BellRing size={16} aria-hidden="true" />,
      aoEscolher: () => setAvisos(true),
    });
  if (pode('pessoas.inativar', autoridade))
    itens.push({
      rotulo: pessoa.situacao === 'ativa' ? 'Inativar' : 'Reativar',
      icone: <Power size={16} aria-hidden="true" />,
      desabilitado: situacao.isPending,
      aoEscolher: () => situacao.mutate(),
    });
  if (pode('pessoas.eliminar_dados', autoridade))
    itens.push({
      rotulo: 'Eliminar dados',
      icone: <Trash2 size={16} aria-hidden="true" />,
      perigo: true,
      separadorAntes: true,
      desabilitado: eliminar.isPending,
      aoEscolher: () =>
        pedir({
          titulo: 'Eliminar os dados pessoais desta pessoa?',
          mensagem:
            'Isso não pode ser desfeito. Protocolos e histórico são mantidos, sem identificá-la.',
          rotuloDeConfirmar: 'Eliminar dados',
          perigo: true,
          aoConfirmar: () => eliminar.mutate(),
        }),
    });
  const erro = situacao.error ?? eliminar.error;

  return (
    <div className="acoes acoes--fim">
      {confirmacao}
      <Link
        className="botao botao--fantasma botao--pequeno"
        to={`/g/demandas?solicitante=${pessoa.id}`}
      >
        <ExternalLink size={14} aria-hidden="true" />
        Ver demandas
      </Link>
      {itens.length > 0 ? (
        <MenuSuspenso rotulo={`Mais ações de ${pessoa.nomeCompleto ?? 'pessoa'}`} itens={itens} />
      ) : null}
      {erro ? <AvisoDeErro erro={erro} /> : null}
      {editando ? (
        <Modal titulo="Alterar pessoa" tamanho="lg" aoFechar={() => setEditando(false)}>
          <FormularioDePessoa pessoa={pessoa} aoConcluir={() => setEditando(false)} />
        </Modal>
      ) : null}
      {avisos ? (
        <Modal
          titulo="Avisos por e-mail"
          descricao={pessoa.nomeCompleto ?? undefined}
          tamanho="lg"
          aoFechar={() => setAvisos(false)}
        >
          <ConsentimentoDeNotificacao pessoaId={pessoa.id} sessao={sessao} />
        </Modal>
      ) : null}
    </div>
  );
}

export function PaginaPessoas({ sessao }: { sessao: RespostaDaSessao }) {
  const [parametros, definirParametros] = useSearchParams();
  const pessoaAberta = Number(parametros.get('pessoa')) || null;
  const abrirPessoa = (id: number | null) => {
    const novos = new URLSearchParams(parametros);
    if (id === null) novos.delete('pessoa');
    else novos.set('pessoa', String(id));
    definirParametros(novos);
  };
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
      <CabecalhoDaPagina
        titulo="Pessoas"
        descricao="O cidadão atendido. O telefone identifica a pessoa; não há duas pessoas ativas com o mesmo número."
        acoes={
          pode('pessoas.manter', autoridade) ? (
            <Botao icone={<Plus size={16} aria-hidden="true" />} onClick={() => setCriando(true)}>
              Nova pessoa
            </Botao>
          ) : null
        }
      />
      {criando ? (
        <Modal titulo="Nova pessoa" tamanho="lg" aoFechar={() => setCriando(false)}>
          <FormularioDePessoa aoConcluir={() => setCriando(false)} />
        </Modal>
      ) : null}

      <BarraDeFerramentas
        rotulo="Filtros das pessoas"
        aoBuscar={() => {
          setTermo(busca.trim());
          setPagina(1);
        }}
        acoes={
          <>
            {termo || situacao ? (
              <Botao
                variante="fantasma"
                icone={<X size={16} aria-hidden="true" />}
                onClick={() => {
                  setBusca('');
                  setTermo('');
                  setSituacao('');
                  setPagina(1);
                }}
              >
                Limpar
              </Botao>
            ) : null}
            <Botao
              type="submit"
              variante="secundario"
              icone={<Search size={16} aria-hidden="true" />}
            >
              Buscar
            </Botao>
          </>
        }
      >
        <Campo rotulo="Buscar">
          {(p) => (
            <input
              {...p}
              type="search"
              placeholder="Nome ou parte do telefone"
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
      </BarraDeFerramentas>

      <AvisoDeErro erro={error} />
      {isLoading ? <EsqueletoDeTabela colunas={5} /> : null}
      {data ? (
        <div className="cartao cartao--tabela">
          <div className="tabela-rolavel">
            <table className="tabela tabela--pessoas">
              <caption>
                {data.total} pessoa(s), página {data.pagina} de {totalDePaginas}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Pessoa</th>
                  <th scope="col">Telefone</th>
                  <th scope="col">Situação</th>
                  <th scope="col">Avisos por e-mail</th>
                  <th scope="col">
                    <span className="somente-leitor">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.itens.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div className="pessoa-celula">
                        <span className="foto foto--pequena" aria-hidden="true">
                          {p.nomeCompleto ? iniciais(p.nomeCompleto) : '–'}
                        </span>
                        <div className="pessoa-celula__texto">
                          {p.nomeCompleto ? (
                            <button
                              type="button"
                              className="link-botao pessoa-celula__nome"
                              onClick={() => abrirPessoa(p.id)}
                            >
                              {p.nomeCompleto}
                            </button>
                          ) : (
                            <span className="pessoa-celula__nome">Dados eliminados</span>
                          )}
                          {p.email ? <span className="pessoa-celula__apoio">{p.email}</span> : null}
                        </div>
                      </div>
                    </td>
                    <td className="tabela__discreto">{p.telefone ?? '-'}</td>
                    <td>
                      <Selo tom={p.situacao === 'ativa' ? 'sucesso' : 'neutro'} ponto>
                        {rotuloDaSituacao[p.situacao]}
                      </Selo>
                    </td>
                    <td className="tabela__discreto">{rotuloDosAvisos(p)}</td>
                    <td className="e-acoes">
                      <AcoesDaPessoa pessoa={p} sessao={sessao} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.itens.length === 0 ? (
            <EstadoVazio icone={<Users size={24} />} titulo="Nenhuma pessoa encontrada." />
          ) : null}
          <Paginacao pagina={pagina} totalDePaginas={totalDePaginas} aoMudar={setPagina} />
        </div>
      ) : null}
      {pessoaAberta ? (
        <FichaDaPessoa id={pessoaAberta} sessao={sessao} aoFechar={() => abrirPessoa(null)} />
      ) : null}
    </section>
  );
}
