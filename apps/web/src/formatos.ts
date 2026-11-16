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

const formatadorDeData = new Intl.DateTimeFormat('pt-BR', {
  timeZone: fusoDoGabinete,
  dateStyle: 'full',
});
const formatadorDeHora = new Intl.DateTimeFormat('pt-BR', {
  timeZone: fusoDoGabinete,
  hour: '2-digit',
  minute: '2-digit',
});

export const formatarDataExtensa = (iso: string): string => formatadorDeData.format(new Date(iso));
export const formatarHora = (iso: string): string => formatadorDeHora.format(new Date(iso));

/** A data de hoje (AAAA-MM-DD) no fuso do gabinete. */
export function hojeNoGabinete(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: fusoDoGabinete,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(agora);
}

/** Soma dias a uma data AAAA-MM-DD (sem depender do fuso do navegador). */
export function somarDias(data: string, dias: number): string {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** O instante (ISO, com o fuso do gabinete) do começo ou do fim de uma data AAAA-MM-DD. */
export const inicioDoDia = (data: string): string => `${data}T00:00:00-03:00`;
export const fimDoDia = (data: string): string => `${data}T23:59:59-03:00`;

/** De um campo datetime-local (AAAA-MM-DDTHH:MM) para ISO no fuso do gabinete, e de volta. */
export const deCampoDeDataHora = (valor: string): string => `${valor}:00-03:00`;
export function paraCampoDeDataHora(iso: string): string {
  const partes = new Intl.DateTimeFormat('sv-SE', {
    timeZone: fusoDoGabinete,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
  return partes.replace(' ', 'T');
}
