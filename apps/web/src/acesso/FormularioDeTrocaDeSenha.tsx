import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Circle, Eye, EyeOff } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { chamar } from '../api/cliente';
import { chaves } from '../api/consultas';
import { useToast } from '../componentes/toast';
import { AvisoDeErro, Botao, Campo } from '../componentes/ui';

/**
 * Troca da própria senha. Usada no primeiro acesso (obrigatória) e no perfil.
 * Regras: ao menos 10 caracteres, sem exigência de composição, diferente do e-mail e da atual.
 */
export function FormularioDeTrocaDeSenha({ aoConcluir }: { aoConcluir?: () => void }) {
  const cliente = useQueryClient();
  const avisar = useToast();
  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [visivel, setVisivel] = useState(false);
  const tipo = visivel ? 'text' : 'password';

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
      avisar({
        tom: 'sucesso',
        titulo: 'Senha trocada',
        texto: 'As suas outras sessões foram encerradas.',
      });
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
      <Campo rotulo="Senha atual">
        {(p) => (
          <input
            {...p}
            type={tipo}
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
            type={tipo}
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
            type={tipo}
            autoComplete="new-password"
            value={confirmacao}
            onChange={(e) => setConfirmacao(e.target.value)}
            required
          />
        )}
      </Campo>
      <ul className="requisitos" aria-label="Requisitos da nova senha">
        <Requisito atendido={nova.length >= 10}>Ao menos 10 caracteres</Requisito>
        <Requisito atendido={confirmacao.length > 0 && !divergente}>
          As duas senhas são iguais
        </Requisito>
      </ul>
      <div className="acoes acoes--entre">
        <Botao
          variante="fantasma"
          pequeno
          aria-pressed={visivel}
          onClick={() => setVisivel((v) => !v)}
        >
          {visivel ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
          {visivel ? 'Ocultar senhas' : 'Mostrar senhas'}
        </Botao>
        <Botao
          type="submit"
          disabled={
            trocar.isPending ||
            !atual ||
            nova.length === 0 ||
            divergente ||
            confirmacao.length === 0
          }
        >
          {trocar.isPending ? 'Trocando…' : 'Trocar senha'}
        </Botao>
      </div>
    </form>
  );
}

function Requisito({ atendido, children }: { atendido: boolean; children: string }) {
  return (
    <li className={atendido ? 'requisito requisito--ok' : 'requisito'}>
      {atendido ? <Check size={14} aria-hidden="true" /> : <Circle size={14} aria-hidden="true" />}
      <span>{children}</span>
      <span className="somente-leitor">{atendido ? ' (atendido)' : ' (pendente)'}</span>
    </li>
  );
}
