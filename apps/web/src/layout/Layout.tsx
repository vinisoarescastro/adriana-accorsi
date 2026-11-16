import type { RespostaDaSessao } from '@gabinete/compartilhado';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CalendarDays,
  ClipboardCheck,
  FileText,
  GitBranch,
  History,
  Landmark,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Mail,
  Menu,
  Moon,
  Settings,
  Sun,
  UserCircle,
  Users,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { chamar } from '../api/cliente';
import { useGabinete } from '../api/consultas';
import { SinoDeAvisos } from '../avisos/SinoDeAvisos';
import { Botao } from '../componentes/ui';
import { iniciais } from '../formatos';
import { rotuloDoPerfil } from '../rotulos';
import { aplicarTema, temaInicial, type Tema } from './tema';

/** Ícone e grupo de cada página da barra. Página fora desta lista cai em "Sistema", sem ícone próprio. */
const aparenciaDasPaginas: Record<string, { icone: LucideIcon; grupo: string }> = {
  painel: { icone: LayoutDashboard, grupo: 'Principal' },
  demandas: { icone: FileText, grupo: 'Principal' },
  tarefas: { icone: ListChecks, grupo: 'Principal' },
  agenda: { icone: CalendarDays, grupo: 'Principal' },
  eventos: { icone: ClipboardCheck, grupo: 'Principal' },
  pessoas: { icone: Users, grupo: 'Principal' },
  emails: { icone: Mail, grupo: 'Principal' },
  equipe: { icone: UsersRound, grupo: 'Sistema' },
  fluxos: { icone: GitBranch, grupo: 'Sistema' },
  auditoria: { icone: History, grupo: 'Sistema' },
  configuracoes: { icone: Settings, grupo: 'Sistema' },
};

const ordemDosGrupos = ['Principal', 'Sistema'];

/**
 * Estrutura da área interna. A barra lateral mostra só as páginas que o servidor diz que a
 * sessão alcança (o mesmo decisor das rotas): página sem permissão não aparece.
 */
export function Layout({ sessao }: { sessao: RespostaDaSessao }) {
  const navegar = useNavigate();
  const local = useLocation();
  const cliente = useQueryClient();
  const [aberta, setAberta] = useState(false);
  const [tema, setTema] = useState<Tema>(temaInicial);
  const { data: gabinete } = useGabinete();

  useEffect(() => {
    aplicarTema(tema);
  }, [tema]);
  // A gaveta do menu fecha ao trocar de página.
  useEffect(() => setAberta(false), [local.pathname]);

  const sair = useMutation({
    mutationFn: () => chamar<void>('POST', '/api/acesso/sair'),
    onSettled: () => {
      cliente.clear();
      void navegar('/entrar', { replace: true });
    },
  });

  const usuario = sessao.usuario;
  const grupos = ordemDosGrupos
    .map((nome) => ({
      nome,
      paginas: sessao.paginasAlcancaveis.filter(
        (p) => (aparenciaDasPaginas[p.id]?.grupo ?? 'Sistema') === nome,
      ),
    }))
    .filter((g) => g.paginas.length > 0);

  return (
    <div className="aplicacao">
      <a className="pular-para-conteudo" href="#conteudo">
        Pular para o conteúdo
      </a>

      <aside className={`lateral${aberta ? ' lateral--aberta' : ''}`} aria-label="Menu principal">
        <div className="lateral__marca">
          <span className="lateral__logo" aria-hidden="true">
            <Landmark size={18} />
          </span>
          <span className="lateral__nome">{gabinete?.nome ?? 'Gabinete'}</span>
        </div>
        <nav className="lateral__nav">
          {grupos.map((grupo) => (
            <div className="lateral__secao" key={grupo.nome}>
              <span className="lateral__grupo">{grupo.nome}</span>
              {grupo.paginas.map((pagina) => {
                const Icone = aparenciaDasPaginas[pagina.id]?.icone ?? FileText;
                return (
                  <NavLink
                    key={pagina.id}
                    to={pagina.caminho}
                    className="lateral__link"
                    onClick={() => setAberta(false)}
                  >
                    <Icone size={18} aria-hidden="true" />
                    {pagina.titulo}
                  </NavLink>
                );
              })}
            </div>
          ))}
          <div className="lateral__secao">
            <span className="lateral__grupo">Conta</span>
            <NavLink to="/g/perfil" className="lateral__link" onClick={() => setAberta(false)}>
              <UserCircle size={18} aria-hidden="true" />
              Meu perfil
            </NavLink>
          </div>
        </nav>
        <div className="lateral__rodape">
          <button
            type="button"
            className="lateral__sair"
            onClick={() => sair.mutate()}
            disabled={sair.isPending}
          >
            <LogOut size={18} aria-hidden="true" />
            Sair
          </button>
        </div>
      </aside>
      {aberta ? (
        <button
          type="button"
          className="lateral__cortina"
          aria-label="Fechar o menu"
          onClick={() => setAberta(false)}
        />
      ) : null}

      <div className="principal">
        <header className="cabecalho">
          <Botao
            className="botao-menu botao--icone"
            variante="secundario"
            aria-expanded={aberta}
            aria-label={aberta ? 'Fechar o menu' : 'Abrir o menu'}
            onClick={() => setAberta((v) => !v)}
          >
            <Menu size={18} aria-hidden="true" />
          </Botao>
          <div className="cabecalho__titulo">
            <div className="cabecalho__nome">
              {gabinete?.parlamentarNome ?? 'Gabinete parlamentar'}
            </div>
            {gabinete ? <div className="cabecalho__subtitulo">{gabinete.cargo}</div> : null}
          </div>
          <Botao
            variante="secundario"
            className="botao--icone"
            aria-label={tema === 'dark' ? 'Usar tema claro' : 'Usar tema escuro'}
            onClick={() => setTema(tema === 'dark' ? 'light' : 'dark')}
          >
            {tema === 'dark' ? (
              <Sun size={18} aria-hidden="true" />
            ) : (
              <Moon size={18} aria-hidden="true" />
            )}
          </Botao>
          <SinoDeAvisos />
          <span className="cabecalho__divisor" aria-hidden="true" />
          <div className="cabecalho__usuario">
            {usuario.perfil ? (
              <span>
                {usuario.nome} ({rotuloDoPerfil[usuario.perfil]})
              </span>
            ) : null}
            <span className="foto" role="img" aria-label={`Iniciais de ${usuario.nome}`}>
              {iniciais(usuario.nome)}
            </span>
          </div>
        </header>
        <main id="conteudo" className="conteudo" tabIndex={-1}>
          <div className="pagina">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
