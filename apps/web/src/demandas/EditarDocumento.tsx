import {
  naturezasDeDocumento,
  type DocumentoDto,
  type NaturezaDeDocumento,
} from '@gabinete/compartilhado';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { chavesDoAtendimento } from '../api/atendimento';
import { chamar } from '../api/cliente';
import { Modal } from '../componentes/modal';
import { useToast } from '../componentes/toast';
import { AvisoDeErro, Botao, Campo } from '../componentes/ui';
import { rotuloDaNatureza } from '../rotulos';

/** Corrige o nome e a natureza de um documento já anexado. O arquivo em si não muda. */
export function EditarDocumento({
  documento,
  aoFechar,
}: {
  documento: DocumentoDto;
  aoFechar: () => void;
}) {
  const cliente = useQueryClient();
  const avisar = useToast();
  const [nome, setNome] = useState(documento.nome);
  const [natureza, setNatureza] = useState<NaturezaDeDocumento>(documento.natureza);

  const salvar = useMutation({
    mutationFn: () =>
      chamar<DocumentoDto[]>('PATCH', `/api/documentos/${documento.id}`, {
        corpo: { nome: nome.trim(), natureza },
      }),
    onSuccess: async () => {
      await cliente.invalidateQueries({ queryKey: chavesDoAtendimento.tudo });
      avisar({ tom: 'sucesso', titulo: 'Documento atualizado' });
      aoFechar();
    },
  });
  const mudou = nome.trim() !== documento.nome || natureza !== documento.natureza;

  return (
    <Modal
      titulo="Editar documento"
      descricao="Só o nome e a natureza mudam; o arquivo continua o mesmo."
      tamanho="sm"
      aoFechar={aoFechar}
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao
            carregando={salvar.isPending}
            disabled={!nome.trim() || !mudou}
            onClick={() => salvar.mutate()}
          >
            Salvar
          </Botao>
        </>
      }
    >
      <form
        className="formulario-do-modal"
        onSubmit={(e) => {
          e.preventDefault();
          if (nome.trim() && mudou) salvar.mutate();
        }}
      >
        <AvisoDeErro erro={salvar.error} />
        <Campo rotulo="Nome do documento">
          {(p) => (
            <input
              {...p}
              required
              maxLength={200}
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
          )}
        </Campo>
        <Campo rotulo="Natureza">
          {(p) => (
            <select
              {...p}
              value={natureza}
              onChange={(e) => setNatureza(e.target.value as NaturezaDeDocumento)}
            >
              {naturezasDeDocumento.map((n) => (
                <option key={n} value={n}>
                  {rotuloDaNatureza[n]}
                </option>
              ))}
            </select>
          )}
        </Campo>
      </form>
    </Modal>
  );
}
