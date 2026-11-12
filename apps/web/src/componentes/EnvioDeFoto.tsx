import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { chamar } from '../api/cliente';
import { AvisoDeErro, Aviso, Campo } from './ui';

export const tamanhoMaximoDaFotoEmBytes = 2 * 1024 * 1024;
const tiposAceitos = ['image/png', 'image/jpeg'];

/** Confere no navegador só para avisar cedo; quem decide de verdade é a API, pelo conteúdo do arquivo. */
export function validarFoto(arquivo: { type: string; size: number }): string | null {
  if (!tiposAceitos.includes(arquivo.type)) return 'Envie uma imagem PNG ou JPEG.';
  if (arquivo.size > tamanhoMaximoDaFotoEmBytes) return 'A foto deve ter no máximo 2 MB.';
  return null;
}

export function EnvioDeFoto({
  rotulo,
  endereco,
  aoEnviar,
}: {
  rotulo: string;
  endereco: string;
  aoEnviar: () => void;
}) {
  const [problema, setProblema] = useState<string | null>(null);
  const enviar = useMutation({
    mutationFn: (arquivo: File) => chamar<void>('POST', endereco, { bytes: arquivo }),
    onSuccess: aoEnviar,
  });

  return (
    <div>
      {problema ? <Aviso tipo="erro" titulo={problema} /> : null}
      <AvisoDeErro erro={enviar.error} />
      <Campo rotulo={rotulo} ajuda="PNG ou JPEG, até 2 MB.">
        {(p) => (
          <input
            {...p}
            type="file"
            accept="image/png,image/jpeg"
            disabled={enviar.isPending}
            onChange={(e) => {
              const arquivo = e.target.files?.[0];
              if (!arquivo) return;
              const erro = validarFoto(arquivo);
              setProblema(erro);
              if (!erro) enviar.mutate(arquivo);
              e.target.value = '';
            }}
          />
        )}
      </Campo>
    </div>
  );
}
