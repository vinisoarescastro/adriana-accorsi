import { Navigate, Route, Routes } from 'react-router';
import { ExigePagina, ExigeSessao, NaoEncontrada } from './acesso/guardas';
import { PaginaEntrar } from './acesso/PaginaEntrar';
import { PaginaTrocarSenha } from './acesso/PaginaTrocarSenha';
import { PaginaAuditoria } from './auditoria/PaginaAuditoria';
import { PaginaConfiguracoes } from './configuracoes/PaginaConfiguracoes';
import { PaginaEquipe } from './equipe/PaginaEquipe';
import { PaginaFluxos } from './fluxos/PaginaFluxos';
import { Layout } from './layout/Layout';
import { PaginaPainel } from './painel/PaginaPainel';
import { PaginaPerfil } from './perfil/PaginaPerfil';
import { PaginaSistema } from './sistema/PaginaSistema';

/** Rotas da aplicação. O roteador e o cliente de consultas são fornecidos por quem monta (main.tsx). */
export function App() {
  return (
    <Routes>
      <Route path="/entrar" element={<PaginaEntrar />} />
      <Route path="/trocar-senha" element={<PaginaTrocarSenha />} />
      <Route path="/sistema" element={<PaginaSistema />} />
      <Route
        path="/g"
        element={<ExigeSessao>{(sessao) => <Layout sessao={sessao} />}</ExigeSessao>}
      >
        <Route index element={<Navigate to="painel" replace />} />
        <Route path="*" element={<RotasDaArea />} />
      </Route>
      <Route path="*" element={<Navigate to="/g/painel" replace />} />
    </Routes>
  );
}

/** Páginas da área interna. Cada uma só existe para quem o servidor diz que alcança. */
function RotasDaArea() {
  return (
    <ExigeSessao>
      {(sessao) => (
        <Routes>
          <Route
            path="painel"
            element={
              <ExigePagina id="painel" sessao={sessao}>
                <PaginaPainel sessao={sessao} />
              </ExigePagina>
            }
          />
          <Route
            path="equipe"
            element={
              <ExigePagina id="equipe" sessao={sessao}>
                <PaginaEquipe sessao={sessao} />
              </ExigePagina>
            }
          />
          <Route
            path="fluxos"
            element={
              <ExigePagina id="fluxos" sessao={sessao}>
                <PaginaFluxos sessao={sessao} />
              </ExigePagina>
            }
          />
          <Route
            path="auditoria"
            element={
              <ExigePagina id="auditoria" sessao={sessao}>
                <PaginaAuditoria />
              </ExigePagina>
            }
          />
          <Route
            path="configuracoes"
            element={
              <ExigePagina id="configuracoes" sessao={sessao}>
                <PaginaConfiguracoes sessao={sessao} />
              </ExigePagina>
            }
          />
          <Route path="perfil" element={<PaginaPerfil sessao={sessao} />} />
          <Route path="*" element={<NaoEncontrada />} />
        </Routes>
      )}
    </ExigeSessao>
  );
}
