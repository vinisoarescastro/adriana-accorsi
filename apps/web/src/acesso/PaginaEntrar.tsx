import type { RespostaDaSessao } from '@gabinete/compartilhado';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import logo from '../assets/logo-gabinete-digital-branco.png';
import { Navigate, useNavigate } from 'react-router';
import { chamar } from '../api/cliente';
import { chaves, useSessao } from '../api/consultas';
import { Botao, Campo, AvisoDeErro, Carregando } from '../componentes/ui';

export function PaginaEntrar() {
  const navegar = useNavigate();
  const cliente = useQueryClient();
  const { data: sessaoAtual, isLoading } = useSessao();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');

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
    <main className="pagina-centralizada">
      <div className="entrada">
        <div className="entrada__marca">
          <img className="entrada__logo" src={logo} alt="Gabinete Digital" />
        </div>
        <form className="cartao" onSubmit={enviar} noValidate>
          <h1>Entrar</h1>
          <p>Use o e-mail e a senha cadastrados pelo gabinete.</p>
          <AvisoDeErro erro={entrar.error} />
          <Campo rotulo="E-mail">
            {(p) => (
              <input
                {...p}
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            )}
          </Campo>
          <Campo rotulo="Senha">
            {(p) => (
              <input
                {...p}
                type="password"
                autoComplete="current-password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
              />
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
        </form>
      </div>
    </main>
  );
}
