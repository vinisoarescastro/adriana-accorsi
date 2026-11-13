/**
 * Protocolo: 12 caracteres aleatórios de um alfabeto de 31 símbolos, sem `0 O 1 I L` (confundíveis).
 * Mostrado em três grupos de quatro (`K7M2-9PQ4-XA3N`); guardado sem hífens e em maiúsculas.
 * Não é sequencial: não dá para adivinhar o seguinte nem contar quantos existem.
 * As funções puras ficam aqui porque o app público também as usa; a geração e a emissão, que
 * tocam o banco, ficam no pacote do banco.
 */
export const alfabetoDoProtocolo = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export const tamanhoDoProtocolo = 12;

export function formatarProtocolo(protocolo: string): string {
  return `${protocolo.slice(0, 4)}-${protocolo.slice(4, 8)}-${protocolo.slice(8, 12)}`;
}

/**
 * Aceita com ou sem hífens, com espaços e em qualquer caixa. Devolve o protocolo canônico
 * (12 caracteres) ou `null` se não tiver o formato.
 */
export function normalizarProtocolo(entrada: string): string | null {
  const limpo = entrada.replace(/[\s-]/g, '').toUpperCase();
  if (limpo.length !== tamanhoDoProtocolo) return null;
  return [...limpo].every((c) => alfabetoDoProtocolo.includes(c)) ? limpo : null;
}
