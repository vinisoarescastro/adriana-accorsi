/** Datas sempre no fuso do gabinete, nunca no do navegador (RNF-DAD-04). */
export const fusoDoGabinete = 'America/Sao_Paulo';

const formatadorDeDataHora = new Intl.DateTimeFormat('pt-BR', {
  timeZone: fusoDoGabinete,
  dateStyle: 'short',
  timeStyle: 'short',
});

export function formatarDataHora(iso: string): string {
  return formatadorDeDataHora.format(new Date(iso));
}

export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  const primeira = partes[0]?.[0] ?? '?';
  const ultima = partes.length > 1 ? (partes[partes.length - 1]?.[0] ?? '') : '';
  return `${primeira}${ultima}`.toUpperCase();
}
