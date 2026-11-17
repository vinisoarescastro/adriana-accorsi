import { useCallback, useState } from 'react';

/**
 * Uma escolha de interface que o navegador lembra (a visão de um gráfico, por exemplo). Só vale para quem
 * escolheu, neste aparelho; sem armazenamento, vale o padrão a cada visita.
 */
export function usarPreferencia<T extends string>(
  chave: string,
  padrao: T,
  validos: readonly T[],
): [T, (valor: T) => void] {
  const [valor, definir] = useState<T>(() => {
    try {
      const guardado = localStorage.getItem(`preferencia:${chave}`);
      return guardado && (validos as readonly string[]).includes(guardado)
        ? (guardado as T)
        : padrao;
    } catch {
      return padrao;
    }
  });
  const mudar = useCallback(
    (novo: T) => {
      definir(novo);
      try {
        localStorage.setItem(`preferencia:${chave}`, novo);
      } catch {
        /* sem armazenamento: vale só nesta visita */
      }
    },
    [chave],
  );
  return [valor, mudar];
}
