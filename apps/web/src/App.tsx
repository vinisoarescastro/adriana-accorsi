import { Navigate, Route, Routes } from 'react-router';
import { ExigePagina, ExigeSessao, NaoEncontrada } from './acesso/guardas';
import { PaginaEntrar } from './acesso/PaginaEntrar';
import { PaginaTrocarSenha } from './acesso/PaginaTrocarSenha';
import { PaginaBeneficiarios } from './beneficiarios/PaginaBeneficiarios';
import { PaginaAuditoria } from './auditoria/PaginaAuditoria';
import { PaginaConfiguracoes } from './configuracoes/PaginaConfiguracoes';
import { PaginaAgenda } from './agenda/PaginaAgenda';
import { PaginaDemandas } from './demandas/PaginaDemandas';
import { PaginaEmails } from './emails/PaginaEmails';
import { PaginaEquipe } from './equipe/PaginaEquipe';
import { PaginaEventos } from './eventos/PaginaEventos';
import { PaginaFluxos } from './fluxos/PaginaFluxos';
import { Layout } from './layout/Layout';
import { PaginaProjetos } from './projetos/PaginaProjetos';
import { PaginaPainel } from './painel/PaginaPainel';
import { PaginaPessoas } from './pessoas/PaginaPessoas';
import { PaginaPerfil } from './perfil/PaginaPerfil';
import { PaginaSistema } from './sistema/PaginaSistema';
import { PaginaTarefas } from './tarefas/PaginaTarefas';

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
            path="demandas"
            element={
              <ExigePagina id="demandas" sessao={sessao}>
                <PaginaDemandas sessao={sessao} />
              </ExigePagina>
            }
          />
          <Route
            path="tarefas"
            element={
              <ExigePagina id="tarefas" sessao={sessao}>
                <PaginaTarefas sessao={sessao} />
              </ExigePagina>
            }
          />
          <Route
            path="agenda"
            element={
              <ExigePagina id="agenda" sessao={sessao}>
                <PaginaAgenda sessao={sessao} />
              </ExigePagina>
            }
          />
          <Route
            path="eventos"
            element={
              <ExigePagina id="eventos" sessao={sessao}>
                <PaginaEventos sessao={sessao} />
              </ExigePagina>
            }
          />
          <Route
            path="projetos"
            element={
              <ExigePagina id="projetos" sessao={sessao}>
                <PaginaProjetos sessao={sessao} />
              </ExigePagina>
            }
          />
          <Route
            path="beneficiarios"
            element={
              <ExigePagina id="beneficiarios" sessao={sessao}>
                <PaginaBeneficiarios sessao={sessao} />
              </ExigePagina>
            }
          />
          <Route
            path="pessoas"
            element={
              <ExigePagina id="pessoas" sessao={sessao}>
                <PaginaPessoas sessao={sessao} />
              </ExigePagina>
            }
          />
          <Route
            path="emails"
            element={
              <ExigePagina id="emails" sessao={sessao}>
                <PaginaEmails />
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
