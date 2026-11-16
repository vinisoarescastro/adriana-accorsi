import type { RespostaDaSessao } from '@gabinete/compartilhado';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router';
import { chamar } from '../api/cliente';
import { useGabinete } from '../api/consultas';
import { SinoDeAvisos } from '../avisos/SinoDeAvisos';
import { Botao } from '../componentes/ui';
import { iniciais } from '../formatos';
import { rotuloDoPerfil } from '../rotulos';

/**
 * Estrutura da área interna. A barra lateral mostra só as páginas que o servidor diz que a
 * sessão alcança (o mesmo decisor das rotas): página sem permissão não aparece.
 */
export function Layout({ sessao }: { sessao: RespostaDaSessao }) {
  const navegar = useNavigate();
  const cliente = useQueryClient();
  const [aberta, setAberta] = useState(false);
  const { data: gabinete } = useGabinete();

  const sair = useMutation({
    mutationFn: () => chamar<void>('POST', '/api/acesso/sair'),
    onSettled: () => {
      cliente.clear();
      void navegar('/entrar', { replace: true });
    },
  });

  const usuario = sessao.usuario;

  return (
    <div className="aplicacao">
      <a className="pular-para-conteudo" href="#conteudo">
        Pular para o conteúdo
      </a>

      <aside className={`lateral${aberta ? ' lateral--aberta' : ''}`} aria-label="Menu principal">
        <div className="lateral__marca">{gabinete?.nome ?? 'Gabinete'}</div>
        <nav className="lateral__nav">
          {sessao.paginasAlcancaveis.map((pagina) => (
            <NavLink
              key={pagina.id}
              to={pagina.caminho}
              className="lateral__link"
              onClick={() => setAberta(false)}
            >
              {pagina.titulo}
            </NavLink>
          ))}
          <NavLink to="/g/perfil" className="lateral__link" onClick={() => setAberta(false)}>
            Meu perfil
          </NavLink>
        </nav>
        <div className="lateral__rodape">
          <Botao variante="secundario" onClick={() => sair.mutate()} disabled={sair.isPending}>
            Sair
          </Botao>
        </div>
      </aside>

      <div className="principal">
        <header className="cabecalho">
          <Botao
            className="botao-menu"
            variante="secundario"
            aria-expanded={aberta}
            aria-label={aberta ? 'Fechar o menu' : 'Abrir o menu'}
            onClick={() => setAberta((v) => !v)}
          >
            Menu
          </Botao>
          <div className="cabecalho__titulo">
            <div className="cabecalho__nome">
              {gabinete?.parlamentarNome ?? 'Gabinete parlamentar'}
            </div>
            {gabinete ? <div className="cabecalho__subtitulo">{gabinete.cargo}</div> : null}
          </div>
          <SinoDeAvisos />
          <div className="cabecalho__usuario">
            {usuario.perfil ? (
              <span>
                {usuario.nome} ({rotuloDoPerfil[usuario.perfil]})
              </span>
            ) : null}
            <span
              className="foto"
              role="img"
              aria-label={`Iniciais de ${usuario.nome}`}
              style={{ display: 'grid', placeItems: 'center', fontWeight: 700 }}
            >
              {iniciais(usuario.nome)}
            </span>
          </div>
        </header>
        <main id="conteudo" className="conteudo" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
