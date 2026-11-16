import logo from '../assets/logo-gabinete-digital-branco.png';
import { Navigate, useNavigate } from 'react-router';
import { useSessao } from '../api/consultas';
import { Aviso, Carregando } from '../componentes/ui';
import { FormularioDeTrocaDeSenha } from './FormularioDeTrocaDeSenha';

/** Primeiro acesso: nenhuma outra tela funciona até a senha inicial ser trocada. */
export function PaginaTrocarSenha() {
  const navegar = useNavigate();
  const { data: sessao, isLoading } = useSessao();

  if (isLoading) return <Carregando />;
  if (!sessao) return <Navigate to="/entrar" replace />;
  if (!sessao.senhaTrocaObrigatoria) return <Navigate to="/g/painel" replace />;

  return (
    <main className="pagina-centralizada">
      <div className="entrada">
        <div className="entrada__marca">
          <img className="entrada__logo" src={logo} alt="Gabinete Digital" />
        </div>
        <div className="cartao">
          <h1>Troque a senha inicial</h1>
          <Aviso tipo="atencao" titulo="Primeiro acesso.">
            Por segurança, escolha uma senha só sua antes de continuar.
          </Aviso>
          <FormularioDeTrocaDeSenha
            aoConcluir={() => void navegar('/g/painel', { replace: true })}
          />
        </div>
      </div>
    </main>
  );
}
