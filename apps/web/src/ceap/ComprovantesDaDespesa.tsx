import type { DespesaFicha } from '@gabinete/compartilhado';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Paperclip, Trash2 } from 'lucide-react';
import { useRef } from 'react';
import { chamar, ErroDaApi } from '../api/cliente';
import { chavesDoFinanceiro } from '../api/financeiro';
import { BotaoDeIcone } from '../componentes/dicas';
import { useToast } from '../componentes/toast';
import { AvisoDeErro, Botao } from '../componentes/ui';
import { formatarDataHora } from '../formatos';
import { useAcaoDaDespesa } from './useAcaoDaDespesa';

const tamanhoEmTexto = (b: number) =>
  b >= 1_048_576 ? `${(b / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;

/** Anexar comprovante: o arquivo vai no corpo (PDF, PNG, JPEG ou ZIP, até 25 MB); o servidor confere o tipo pelo conteúdo e passa o antivírus. */
export function Comprovantes({ ficha, podeMexer }: { ficha: DespesaFicha; podeMexer: boolean }) {
  const cliente = useQueryClient();
  const avisar = useToast();
  const entrada = useRef<HTMLInputElement>(null);
  const rascunho = ficha.status === 'lancada';
  const enviar = useMutation({
    mutationFn: (arquivo: File) =>
      chamar<unknown>(
        'POST',
        `/api/ceap/despesas/${ficha.id}/comprovantes?nome=${encodeURIComponent(arquivo.name)}`,
        { bytes: arquivo },
      ),
    onSuccess: async () => {
      await cliente.invalidateQueries({ queryKey: chavesDoFinanceiro.tudo });
      avisar({ tom: 'sucesso', titulo: 'Comprovante anexado' });
    },
    onError: (erro) =>
      avisar({
        tom: 'erro',
        titulo: 'Não foi possível anexar',
        texto: erro instanceof ErroDaApi ? erro.message : 'Tente de novo.',
      }),
  });
  const remover = useAcaoDaDespesa(ficha.id, 'Comprovante removido');
  return (
    <section aria-label="Comprovantes">
      <h4 className="ficha-acoes__titulo">Comprovantes</h4>
      {ficha.comprovantes.length === 0 ? (
        <p className="campo__ajuda">
          Nenhum comprovante anexado. A categoria pode exigi-lo antes de enviar para análise.
        </p>
      ) : (
        <ul className="lista-simples">
          {ficha.comprovantes.map((c) => (
            <li key={c.id}>
              <a href={`/api/ceap/despesas/${ficha.id}/comprovantes/${c.id}`}>{c.nome}</a>
              <span className="propriedades__apoio">
                {tamanhoEmTexto(c.tamanho)} · {c.enviadoPor}, {formatarDataHora(c.enviadoEm)}
              </span>
              {podeMexer && rascunho ? (
                <BotaoDeIcone
                  rotulo={`Remover o comprovante ${c.nome}`}
                  icone={<Trash2 size={14} aria-hidden="true" />}
                  onClick={() =>
                    remover.mutate({ metodo: 'DELETE', caminho: `/comprovantes/${c.id}` })
                  }
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {podeMexer && (rascunho || ficha.status === 'em_analise') ? (
        <>
          <input
            ref={entrada}
            type="file"
            accept="application/pdf,image/png,image/jpeg,application/zip"
            className="somente-leitor"
            aria-label="Escolher o comprovante"
            onChange={(e) => {
              const arquivo = e.target.files?.[0];
              if (arquivo) enviar.mutate(arquivo);
              e.target.value = '';
            }}
          />
          <Botao
            pequeno
            variante="secundario"
            icone={<Paperclip size={14} aria-hidden="true" />}
            carregando={enviar.isPending}
            onClick={() => entrada.current?.click()}
          >
            Anexar comprovante
          </Botao>
        </>
      ) : null}
      <AvisoDeErro erro={remover.error} />
    </section>
  );
}
