import { antecedenciaPadraoDoAvisoDePrazo } from '@gabinete/compartilhado';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { chamar } from '../api/cliente';
import { chavesDoTrabalho, useConfiguracaoDeAvisos } from '../api/trabalho';
import { Cartao } from '../componentes/cartao';
import { useToast } from '../componentes/toast';
import { AvisoDeErro, Botao, Campo, Carregando } from '../componentes/ui';

/** Antecedência do aviso de prazo, em dias corridos (de 1 a 30; o padrão é 3). Do Chefe em diante. */
export function AvisosDePrazo() {
  const cliente = useQueryClient();
  const avisar = useToast();
  const { data, isLoading, error } = useConfiguracaoDeAvisos(true);
  const [dias, setDias] = useState<string | null>(null);
  const valor = dias ?? String(data?.antecedenciaDias ?? antecedenciaPadraoDoAvisoDePrazo);
  const valido = /^\d+$/.test(valor) && Number(valor) >= 1 && Number(valor) <= 30;

  const salvar = useMutation({
    mutationFn: () =>
      chamar('PUT', '/api/avisos/configuracao', { corpo: { antecedenciaDias: Number(valor) } }),
    onSuccess: async () => {
      await cliente.invalidateQueries({ queryKey: chavesDoTrabalho.configuracaoDeAvisos });
      avisar({ tom: 'sucesso', titulo: 'Antecedência salva' });
    },
  });

  return (
    <form
      aria-label="Avisos de prazo"
      onSubmit={(e) => {
        e.preventDefault();
        salvar.mutate();
      }}
    >
      <Cartao
        titulo="Avisos de prazo"
        descricao="O sistema avisa o responsável quando o prazo de uma tarefa ou demanda está chegando e quando vence, uma vez por dia."
        rodape={
          <Botao type="submit" disabled={!valido} carregando={salvar.isPending}>
            Salvar
          </Botao>
        }
      >
        {isLoading ? <Carregando /> : null}
        <AvisoDeErro erro={error ?? salvar.error} />
        <Campo
          rotulo="Antecedência do aviso (dias)"
          ajuda="De 1 a 30 dias corridos antes do prazo."
          {...(valido ? {} : { erro: 'Informe um número de 1 a 30.' })}
        >
          {(p) => (
            <input
              {...p}
              inputMode="numeric"
              value={valor}
              onChange={(e) => setDias(e.target.value)}
            />
          )}
        </Campo>
      </Cartao>
    </form>
  );
}
