import type { RespostaDaSessao } from '@gabinete/compartilhado';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  CalendarDays,
  ChevronsLeft,
  ChevronsRight,
  ClipboardCheck,
  FileText,
  GitBranch,
  HandCoins,
  History,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Mail,
  Landmark,
  Menu,
  Moon,
  Settings,
  Sun,
  Users,
  UsersRound,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { chamar } from '../api/cliente';
import { useGabinete } from '../api/consultas';
import { SinoDeAvisos } from '../avisos/SinoDeAvisos';
import { BotaoDeIcone } from '../componentes/dicas';
import { MenuSuspenso } from '../componentes/menu';
import { Botao } from '../componentes/ui';
import { iniciais, nomeCurto } from '../formatos';
import { rotuloDoPerfil } from '../rotulos';
import logo from '../assets/logo-gabinete-digital-branco.png';
import { aplicarTema, temaInicial, type Tema } from './tema';

/** Ícone e grupo de cada página da barra. Página fora desta lista cai em "Sistema", sem ícone próprio. */
const aparenciaDasPaginas: Record<string, { icone: LucideIcon; grupo: string }> = {
  painel: { icone: LayoutDashboard, grupo: 'Principal' },
  demandas: { icone: FileText, grupo: 'Principal' },
  tarefas: { icone: ListChecks, grupo: 'Principal' },
  agenda: { icone: CalendarDays, grupo: 'Principal' },
  eventos: { icone: ClipboardCheck, grupo: 'Principal' },
  projetos: { icone: Landmark, grupo: 'Principal' },
  beneficiarios: { icone: Building2, grupo: 'Principal' },
  emendas: { icone: HandCoins, grupo: 'Principal' },
  ceap: { icone: Wallet, grupo: 'Principal' },
  pessoas: { icone: Users, grupo: 'Principal' },
  emails: { icone: Mail, grupo: 'Principal' },
  equipe: { icone: UsersRound, grupo: 'Sistema' },
  fluxos: { icone: GitBranch, grupo: 'Sistema' },
  auditoria: { icone: History, grupo: 'Sistema' },
  configuracoes: { icone: Settings, grupo: 'Sistema' },
};

const ordemDosGrupos = ['Principal', 'Sistema'];

const chaveDoMenuRecolhido = 'menu-lateral-recolhido';

/** O menu lateral recolhido (só ícones) é uma preferência de quem usa, lembrada neste navegador. */
function menuRecolhidoInicial(): boolean {
  try {
    return localStorage.getItem(chaveDoMenuRecolhido) === '1';
  } catch {
    return false;
  }
}

/**
 * Estrutura da área interna. A barra lateral mostra só as páginas que o servidor diz que a
 * sessão alcança (o mesmo decisor das rotas): página sem permissão não aparece.
 */
export function Layout({ sessao }: { sessao: RespostaDaSessao }) {
  const navegar = useNavigate();
  const local = useLocation();
  const cliente = useQueryClient();
  const [aberta, setAberta] = useState(false);
  const [recolhido, setRecolhido] = useState(menuRecolhidoInicial);
  const [tema, setTema] = useState<Tema>(temaInicial);
  const { data: gabinete } = useGabinete();

  useEffect(() => {
    aplicarTema(tema);
  }, [tema]);
  useEffect(() => {
    try {
      localStorage.setItem(chaveDoMenuRecolhido, recolhido ? '1' : '0');
    } catch {
      // Sem armazenamento (janela privada): a preferência só vale nesta sessão.
    }
  }, [recolhido]);
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
    <div className={`aplicacao${recolhido ? ' aplicacao--recolhida' : ''}`}>
      <a className="pular-para-conteudo" href="#conteudo">
        Pular para o conteúdo
      </a>

      <aside className={`lateral${aberta ? ' lateral--aberta' : ''}`} aria-label="Menu principal">
        <div className="lateral__marca">
          <img className="lateral__logo" src={logo} alt="" />
          <span className="lateral__monograma" aria-hidden="true">
            AA
          </span>
          <span className="somente-leitor">{gabinete?.nome ?? 'Gabinete'}</span>
        </div>
        <button
          type="button"
          className="lateral__alternar"
          aria-expanded={!recolhido}
          aria-label={recolhido ? 'Expandir o menu' : 'Recolher o menu'}
          title={recolhido ? 'Expandir o menu' : 'Recolher o menu'}
          onClick={() => setRecolhido((v) => !v)}
        >
          {recolhido ? (
            <ChevronsRight size={16} aria-hidden="true" />
          ) : (
            <ChevronsLeft size={16} aria-hidden="true" />
          )}
        </button>
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
                    title={recolhido ? pagina.titulo : undefined}
                    onClick={() => setAberta(false)}
                  >
                    <Icone size={18} aria-hidden="true" />
                    <span className="lateral__rotulo">{pagina.titulo}</span>
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>
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
            variante="fantasma"
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
          <BotaoDeIcone
            rotulo={tema === 'dark' ? 'Usar tema claro' : 'Usar tema escuro'}
            variante="fantasma"
            icone={
              tema === 'dark' ? (
                <Sun size={18} aria-hidden="true" />
              ) : (
                <Moon size={18} aria-hidden="true" />
              )
            }
            onClick={() => setTema(tema === 'dark' ? 'light' : 'dark')}
          />
          <SinoDeAvisos />
          <span className="cabecalho__divisor" aria-hidden="true" />
          <div className="cabecalho__usuario">
            <MenuSuspenso
              rotulo="Menu da conta"
              gatilho={
                <>
                  <span className="foto" role="img" aria-label={`Iniciais de ${usuario.nome}`}>
                    {iniciais(usuario.nome)}
                  </span>
                  <span title={`${usuario.nome} · ${rotuloDoPerfil[usuario.perfil]}`}>
                    {nomeCurto(usuario.nome)}
                  </span>
                </>
              }
              itens={[
                {
                  rotulo: 'Configurações de perfil',
                  icone: <Settings size={16} aria-hidden="true" />,
                  aoEscolher: () => void navegar('/g/perfil'),
                },
                {
                  rotulo: 'Sair',
                  icone: <LogOut size={16} aria-hidden="true" />,
                  perigo: true,
                  separadorAntes: true,
                  desabilitado: sair.isPending,
                  aoEscolher: () => sair.mutate(),
                },
              ]}
            />
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
