import { pode, podeGerir } from '@gabinete/autorizacao';
import type { RespostaDaSessao } from '@gabinete/compartilhado';
import { Fragment, useState } from 'react';
import { useEquipe } from '../api/consultas';
import { AvisoDeErro, Botao, Carregando, Selo } from '../componentes/ui';
import { iniciais } from '../formatos';
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
      <h1>Equipe</h1>
      {administra && !criando ? (
        <p>
          <Botao onClick={() => setCriando(true)}>Novo usuário</Botao>
        </p>
      ) : null}
      {criando ? <NovoUsuario sessao={sessao} aoFechar={() => setCriando(false)} /> : null}

      <AvisoDeErro erro={error} />
      {isLoading ? <Carregando /> : null}

      {equipe ? (
        <div className="cartao tabela-rolavel">
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
                        {u.temFoto ? (
                          <img
                            className="foto"
                            src={`/api/equipe/${u.id}/foto`}
                            alt=""
                            loading="lazy"
                          />
                        ) : (
                          <span
                            className="foto"
                            aria-hidden="true"
                            style={{
                              display: 'inline-grid',
                              placeItems: 'center',
                              fontWeight: 700,
                            }}
                          >
                            {iniciais(u.nome)}
                          </span>
                        )}{' '}
                        {u.nome}
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
                        <Selo tipo={u.situacao}>
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
      ) : null}
    </section>
  );
}
