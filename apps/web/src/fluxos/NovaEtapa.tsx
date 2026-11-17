import type { FluxoDeTrabalho } from '@gabinete/compartilhado';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { chamar } from '../api/cliente';
import { chaves } from '../api/consultas';
import { AvisoDeErro, Botao, Campo } from '../componentes/ui';

/** Acrescenta uma etapa intermediária ou de conclusão ao fluxo (só o Administrador). */
export function NovaEtapa({ fluxo }: { fluxo: FluxoDeTrabalho }) {
  const cliente = useQueryClient();
  const [nome, setNome] = useState('');
  const [papel, setPapel] = useState<'intermediaria' | 'conclusao'>('intermediaria');
  const criar = useMutation({
    mutationFn: () =>
      chamar('POST', `/api/fluxos/${fluxo.tipo}/etapas`, { corpo: { nomeInterno: nome, papel } }),
    onSuccess: async () => {
      setNome('');
      await cliente.invalidateQueries({ queryKey: chaves.fluxos });
    },
  });
  const enviar = (e: FormEvent) => {
    e.preventDefault();
    criar.mutate();
  };
  return (
    <form onSubmit={enviar} className="fluxo-nova" aria-label="Nova etapa">
      <AvisoDeErro erro={criar.error} />
      <div className="grade-formulario">
        <Campo rotulo="Nome interno">
          {(p) => <input {...p} value={nome} onChange={(e) => setNome(e.target.value)} required />}
        </Campo>
        <Campo rotulo="Papel" ajuda="Entrada e Arquivamento são únicos e fixos em cada fluxo.">
          {(p) => (
            <select
              {...p}
              value={papel}
              onChange={(e) => setPapel(e.target.value as 'intermediaria' | 'conclusao')}
            >
              <option value="intermediaria">Intermediária</option>
              <option value="conclusao">Conclusão</option>
            </select>
          )}
        </Campo>
      </div>
      <Botao type="submit" pequeno disabled={criar.isPending || !nome}>
        Adicionar etapa
      </Botao>
    </form>
  );
}
