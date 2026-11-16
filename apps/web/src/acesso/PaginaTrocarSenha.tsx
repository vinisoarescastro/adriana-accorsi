import { Landmark } from 'lucide-react';
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
        <div className="entrada__marca" aria-hidden="true">
          <span className="entrada__logo">
            <Landmark size={22} />
          </span>
          <span>Gabinete parlamentar</span>
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
