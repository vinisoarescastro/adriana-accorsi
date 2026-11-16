import { pode, podeGerir } from '@gabinete/autorizacao';
import type { RespostaDaSessao } from '@gabinete/compartilhado';
import { Avatar } from '../componentes/avatar';
import { Fragment, useState } from 'react';
import { useEquipe } from '../api/consultas';
import { Plus } from 'lucide-react';
import { CabecalhoDaPagina } from '../componentes/cabecalho';
import { EsqueletoDeTabela } from '../componentes/tabela';
import { AvisoDeErro, Botao, Selo } from '../componentes/ui';
import { rotuloDaArea, rotuloDoPerfil } from '../rotulos';
import { NovoUsuario } from './NovoUsuario';
import { PainelDoUsuario } from './PainelDoUsuario';

export function PaginaEquipe({ sessao }: { sessao: RespostaDaSessao }) {
  const { data: equipe, isLoading, error } = useEquipe();
  const [criando, setCriando] = useState(false);
  const [aberto, setAberto] = useState<number | null>(null);

  const autoridade = { perfil: sessao.usuario.perfil, habilitacoes: sessao.usuario.habilitacoes };
  const administra = pode('equipe.administrar', autoridade);

  return (
    <section>
      <CabecalhoDaPagina
        titulo="Equipe"
        descricao="As pessoas do gabinete, com perfil e habilitações."
        acoes={
          administra ? (
            <Botao icone={<Plus size={16} aria-hidden="true" />} onClick={() => setCriando(true)}>
              Novo usuário
            </Botao>
          ) : null
        }
      />
      {criando ? <NovoUsuario sessao={sessao} aoFechar={() => setCriando(false)} /> : null}

      <AvisoDeErro erro={error} />
      {isLoading ? <EsqueletoDeTabela colunas={5} /> : null}

      {equipe ? (
        <div className="cartao cartao--tabela">
          <div className="tabela-rolavel">
            <table className="tabela">
              <caption>Usuários do gabinete</caption>
              <thead>
                <tr>
                  <th scope="col">Nome</th>
                  <th scope="col">E-mail</th>
                  <th scope="col">Perfil</th>
                  <th scope="col">Habilitações</th>
                  <th scope="col">Situação</th>
                  {administra ? <th scope="col">Ações</th> : null}
                </tr>
              </thead>
              <tbody>
                {equipe.map((u) => {
                  const gerencia =
                    administra &&
                    u.id !== sessao.usuario.id &&
                    podeGerir(sessao.usuario.perfil, u.perfil);
                  return (
                    <Fragment key={u.id}>
                      <tr>
                        <td>
                          <Avatar nome={u.nome} id={u.id} temFoto={u.temFoto} /> {u.nome}
                          {u.id === sessao.usuario.id ? ' (você)' : ''}
                        </td>
                        <td>{u.email}</td>
                        <td>{rotuloDoPerfil[u.perfil]}</td>
                        <td>
                          {u.habilitacoes.length > 0
                            ? u.habilitacoes.map((a) => rotuloDaArea[a]).join(', ')
                            : 'Nenhuma'}
                        </td>
                        <td>
                          <Selo tom={u.situacao === 'ativo' ? 'sucesso' : 'neutro'} ponto>
                            {u.situacao === 'ativo' ? 'Ativo' : 'Inativo'}
                          </Selo>
                        </td>
                        {administra ? (
                          <td>
                            {gerencia ? (
                              <Botao
                                pequeno
                                variante="secundario"
                                aria-expanded={aberto === u.id}
                                onClick={() => setAberto(aberto === u.id ? null : u.id)}
                              >
                                {aberto === u.id ? 'Fechar' : 'Gerenciar'}
                              </Botao>
                            ) : null}
                          </td>
                        ) : null}
                      </tr>
                      {gerencia && aberto === u.id ? (
                        <tr>
                          <td colSpan={6}>
                            <PainelDoUsuario usuario={u} sessao={sessao} />
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}
