import type { ConflitoDeAgenda } from '@gabinete/compartilhado';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { chamar } from '../api/cliente';
import { chavesDoTrabalho } from '../api/trabalho';
import { Modal } from '../componentes/modal';
import { AvisoDeErro, Botao, Campo } from '../componentes/ui';
import { deCampoDeDataHora, hojeNoGabinete } from '../formatos';

export function BloquearHorario({
  aoConcluir,
  aoFechar,
}: {
  aoConcluir: (conflitos: readonly ConflitoDeAgenda[]) => void;
  aoFechar: () => void;
}) {
  const cliente = useQueryClient();
  const dia = hojeNoGabinete();
  const [inicio, setInicio] = useState(`${dia}T09:00`);
  const [fim, setFim] = useState(`${dia}T12:00`);
  const bloquear = useMutation({
    mutationFn: () =>
      chamar<{ conflitos: ConflitoDeAgenda[] }>('POST', '/api/agenda/bloqueios', {
        corpo: { inicio: deCampoDeDataHora(inicio), fim: deCampoDeDataHora(fim) },
      }),
    onSuccess: async (r) => {
      await cliente.invalidateQueries({ queryKey: chavesDoTrabalho.tudo });
      aoConcluir(r.conflitos);
    },
  });
  return (
    <Modal titulo="Bloquear horário" tamanho="md" aoFechar={aoFechar}>
      <form
        className="formulario-do-modal"
        aria-label="Bloquear horário"
        onSubmit={(e) => {
          e.preventDefault();
          bloquear.mutate();
        }}
      >
        <p className="campo__ajuda">
          O bloqueio aparece na agenda e nos conflitos, sem dizer o motivo.
        </p>
        <AvisoDeErro erro={bloquear.error} />
        <div className="grade-formulario">
          <Campo rotulo="Início">
            {(p) => (
              <input
                {...p}
                type="datetime-local"
                required
                value={inicio}
                onChange={(e) => setInicio(e.target.value)}
              />
            )}
          </Campo>
          <Campo rotulo="Fim">
            {(p) => (
              <input
                {...p}
                type="datetime-local"
                required
                value={fim}
                onChange={(e) => setFim(e.target.value)}
              />
            )}
          </Campo>
        </div>
        <div className="acoes">
          <Botao type="submit" carregando={bloquear.isPending}>
            Bloquear
          </Botao>
          <Botao variante="secundario" onClick={aoFechar}>
            Cancelar
          </Botao>
        </div>
      </form>
    </Modal>
  );
}
