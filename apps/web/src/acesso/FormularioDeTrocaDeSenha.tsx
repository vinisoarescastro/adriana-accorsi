import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { chamar } from '../api/cliente';
import { chaves } from '../api/consultas';
import { Aviso, AvisoDeErro, Botao, Campo } from '../componentes/ui';

/**
 * Troca da própria senha. Usada no primeiro acesso (obrigatória) e no perfil.
 * Regras: ao menos 10 caracteres, sem exigência de composição, diferente do e-mail e da atual.
 */
export function FormularioDeTrocaDeSenha({ aoConcluir }: { aoConcluir?: () => void }) {
  const cliente = useQueryClient();
  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [confirmacao, setConfirmacao] = useState('');

  const trocar = useMutation({
    mutationFn: () =>
      chamar<void>('POST', '/api/acesso/trocar-senha', {
        corpo: { senhaAtual: atual, novaSenha: nova },
      }),
    onSuccess: async () => {
      setAtual('');
      setNova('');
      setConfirmacao('');
      await cliente.invalidateQueries({ queryKey: chaves.sessao });
      aoConcluir?.();
    },
  });

  const divergente = confirmacao.length > 0 && confirmacao !== nova;

  const enviar = (evento: FormEvent) => {
    evento.preventDefault();
    if (!divergente) trocar.mutate();
  };

  return (
    <form onSubmit={enviar} noValidate>
      <AvisoDeErro erro={trocar.error} />
      {trocar.isSuccess ? <Aviso tipo="sucesso" titulo="Senha trocada." /> : null}
      <Campo rotulo="Senha atual">
        {(p) => (
          <input
            {...p}
            type="password"
            autoComplete="current-password"
            value={atual}
            onChange={(e) => setAtual(e.target.value)}
            required
          />
        )}
      </Campo>
      <Campo
        rotulo="Nova senha"
        ajuda="Ao menos 10 caracteres. Uma frase longa é melhor que uma senha complicada."
      >
        {(p) => (
          <input
            {...p}
            type="password"
            autoComplete="new-password"
            value={nova}
            onChange={(e) => setNova(e.target.value)}
            required
          />
        )}
      </Campo>
      <Campo
        rotulo="Repita a nova senha"
        {...(divergente ? { erro: 'As senhas não são iguais.' } : {})}
      >
        {(p) => (
          <input
            {...p}
            type="password"
            autoComplete="new-password"
            value={confirmacao}
            onChange={(e) => setConfirmacao(e.target.value)}
            required
          />
        )}
      </Campo>
      <Botao
        type="submit"
        disabled={
          trocar.isPending || !atual || nova.length === 0 || divergente || confirmacao.length === 0
        }
      >
        {trocar.isPending ? 'Trocando…' : 'Trocar senha'}
      </Botao>
    </form>
  );
}
