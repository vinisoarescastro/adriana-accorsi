import type { RespostaDaSessao } from '@gabinete/compartilhado';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Eye, EyeOff, Moon, Sun } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import logo from '../assets/logo-gabinete-digital-branco.png';
import { Navigate, useNavigate } from 'react-router';
import { chamar } from '../api/cliente';
import { chaves, useSessao } from '../api/consultas';
import { Botao, Campo, AvisoDeErro, Carregando } from '../componentes/ui';
import { aplicarTema, temaInicial, type Tema } from '../layout/tema';

export function PaginaEntrar() {
  const navegar = useNavigate();
  const cliente = useQueryClient();
  const { data: sessaoAtual, isLoading } = useSessao();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrar, setMostrar] = useState(false);
  const [tema, setTema] = useState<Tema>(temaInicial);
  useEffect(() => aplicarTema(tema), [tema]);

  const entrar = useMutation({
    mutationFn: () =>
      chamar<RespostaDaSessao>('POST', '/api/acesso/entrar', { corpo: { email, senha } }),
    onSuccess: (sessao) => {
      cliente.setQueryData(chaves.sessao, sessao);
      void navegar(sessao.senhaTrocaObrigatoria ? '/trocar-senha' : '/g/painel', { replace: true });
    },
  });

  if (isLoading) return <Carregando />;
  if (sessaoAtual)
    return (
      <Navigate to={sessaoAtual.senhaTrocaObrigatoria ? '/trocar-senha' : '/g/painel'} replace />
    );

  const enviar = (evento: FormEvent) => {
    evento.preventDefault();
    entrar.mutate();
  };

  return (
    <div className="login">
      <div className="login__fundo" aria-hidden="true" />
      <div className="login__tema">
        <button
          type="button"
          className="login__icone"
          aria-label={tema === 'dark' ? 'Usar o tema claro' : 'Usar o tema escuro'}
          onClick={() => setTema(tema === 'dark' ? 'light' : 'dark')}
        >
          {tema === 'dark' ? (
            <Sun size={18} aria-hidden="true" />
          ) : (
            <Moon size={18} aria-hidden="true" />
          )}
        </button>
      </div>
      <main className="login__principal">
        <div className="login__cartao">
          <aside className="login__lateral">
            <img className="login__logo" src={logo} alt="Gabinete Digital" />
            <div>
              <h2 className="login__chamada">O mandato inteiro em um só lugar.</h2>
              <ul className="login__pontos">
                <li>
                  <Check size={16} aria-hidden="true" />
                  Demandas, tarefas e agenda da equipe
                </li>
                <li>
                  <Check size={16} aria-hidden="true" />
                  Emendas e CEAP sempre à mão
                </li>
                <li>
                  <Check size={16} aria-hidden="true" />
                  Acesso seguro, com registro de tudo o que se faz
                </li>
              </ul>
            </div>
          </aside>
          <form
            className="login__formulario"
            onSubmit={enviar}
            noValidate
            aria-busy={entrar.isPending}
          >
            <div>
              <h1 className="login__titulo">Entrar</h1>
              <p className="login__subtitulo">Use o e-mail e a senha cadastrados pelo gabinete.</p>
            </div>
            <AvisoDeErro erro={entrar.error} />
            <Campo rotulo="E-mail">
              {(p) => (
                <input
                  {...p}
                  type="email"
                  autoComplete="username"
                  placeholder="voce@gabinete.gov.br"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              )}
            </Campo>
            <Campo rotulo="Senha">
              {(p) => (
                <span className="login__senha">
                  <input
                    {...p}
                    type={mostrar ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="login__olho"
                    aria-label={mostrar ? 'Ocultar a senha' : 'Mostrar a senha'}
                    aria-pressed={mostrar}
                    onClick={() => setMostrar((v) => !v)}
                  >
                    {mostrar ? (
                      <EyeOff size={16} aria-hidden="true" />
                    ) : (
                      <Eye size={16} aria-hidden="true" />
                    )}
                  </button>
                </span>
              )}
            </Campo>
            <Botao
              type="submit"
              className="botao--largo"
              carregando={entrar.isPending}
              disabled={!email || !senha}
            >
              {entrar.isPending ? 'Entrando…' : 'Entrar'}
            </Botao>
            <p className="login__rodape">
              Esqueceu a senha? Peça ao Administrador do gabinete para redefini-la.
            </p>
          </form>
        </div>
      </main>
    </div>
  );
}
