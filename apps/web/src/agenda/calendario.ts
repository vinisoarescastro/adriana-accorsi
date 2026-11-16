import type { ItemDaAgenda } from '@gabinete/compartilhado';
import { formatarHora, hojeNoGabinete, somarDias } from '../formatos';

export type VisaoDaAgenda = 'semana' | 'mes';

/** A semana da agenda começa no domingo. */
export const primeiroDiaDaSemana = 0;

export const horasDoDia = 24;

const noMeioDoDia = (data: string) => new Date(`${data}T12:00:00Z`);

/** Dia da semana de uma data AAAA-MM-DD: 0 é domingo. */
export const diaDaSemana = (data: string): number => noMeioDoDia(data).getUTCDay();

export function domingoDaSemana(data: string): string {
  return somarDias(data, -diaDaSemana(data));
}

export function sabadoDaSemana(data: string): string {
  return somarDias(domingoDaSemana(data), 6);
}

export const primeiroDiaDoMes = (data: string): string => `${data.slice(0, 8)}01`;

export function ultimoDiaDoMes(data: string): string {
  const d = noMeioDoDia(primeiroDiaDoMes(data));
  d.setUTCMonth(d.getUTCMonth() + 1, 0);
  return d.toISOString().slice(0, 10);
}

/** Soma meses à data, parando no primeiro dia do mês resultante. */
export function somarMeses(data: string, meses: number): string {
  const d = noMeioDoDia(primeiroDiaDoMes(data));
  d.setUTCMonth(d.getUTCMonth() + meses, 1);
  return d.toISOString().slice(0, 10);
}

/** O intervalo de dias mostrado: a semana (dom a sáb) ou as semanas inteiras que cobrem o mês. */
export function intervaloDaVisao(
  visao: VisaoDaAgenda,
  referencia: string,
): { inicio: string; fim: string } {
  if (visao === 'semana')
    return { inicio: domingoDaSemana(referencia), fim: sabadoDaSemana(referencia) };
  return {
    inicio: domingoDaSemana(primeiroDiaDoMes(referencia)),
    fim: sabadoDaSemana(ultimoDiaDoMes(referencia)),
  };
}

export function diasDoIntervalo(inicio: string, fim: string): string[] {
  const dias: string[] = [];
  for (let d = inicio; d <= fim; d = somarDias(d, 1)) dias.push(d);
  return dias;
}

const formatadorDoDia = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', timeZone: 'UTC' });
const formatadorDoDiaDaSemana = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'short',
  timeZone: 'UTC',
});
const formatadorDoMesLongo = new Intl.DateTimeFormat('pt-BR', { month: 'long', timeZone: 'UTC' });
const formatadorDoMesCurto = new Intl.DateTimeFormat('pt-BR', { month: 'short', timeZone: 'UTC' });

export const numeroDoDia = (data: string): string => formatadorDoDia.format(noMeioDoDia(data));
export const nomeCurtoDoDiaDaSemana = (data: string): string =>
  formatadorDoDiaDaSemana.format(noMeioDoDia(data)).replace('.', '');

export function tituloDoPeriodo(visao: VisaoDaAgenda, referencia: string): string {
  const ano = referencia.slice(0, 4);
  if (visao === 'mes') return `${formatadorDoMesLongo.format(noMeioDoDia(referencia))} de ${ano}`;
  const { inicio, fim } = intervaloDaVisao('semana', referencia);
  const mesmoMes = inicio.slice(0, 7) === fim.slice(0, 7);
  if (mesmoMes)
    return `${numeroDoDia(inicio)} a ${numeroDoDia(fim)} de ${formatadorDoMesLongo.format(noMeioDoDia(fim))} de ${fim.slice(0, 4)}`;
  const mes = (d: string) => formatadorDoMesCurto.format(noMeioDoDia(d)).replace('.', '');
  return `${numeroDoDia(inicio)} ${mes(inicio)} a ${numeroDoDia(fim)} ${mes(fim)} de ${fim.slice(0, 4)}`;
}

export function agruparPorDia(itens: readonly ItemDaAgenda[]): Map<string, ItemDaAgenda[]> {
  const grupos = new Map<string, ItemDaAgenda[]>();
  for (const item of itens) {
    const dia = hojeNoGabinete(new Date(item.inicio));
    grupos.set(dia, [...(grupos.get(dia) ?? []), item]);
  }
  return grupos;
}

export const eDiaInteiro = (item: ItemDaAgenda): boolean =>
  item.tipo !== 'bloqueio' && item.diaInteiro;

export function minutosDoDia(iso: string): number {
  const [h, m] = formatarHora(iso).split(':').map(Number);
  return ((h ?? 0) % 24) * 60 + (m ?? 0);
}

export interface ItemPosicionado {
  readonly item: ItemDaAgenda;
  readonly inicio: number;
  readonly fim: number;
  readonly coluna: number;
  readonly colunas: number;
}

/**
 * Posiciona os itens de UM dia na grade de horas: o horário de começo e fim em minutos e, quando se
 * sobrepõem, a coluna de cada um (lado a lado), para que todos continuem visíveis.
 */
export function posicionarNoDia(itens: readonly ItemDaAgenda[]): ItemPosicionado[] {
  const base = itens
    .filter((i) => !eDiaInteiro(i))
    .map((item) => {
      const inicio = minutosDoDia(item.inicio);
      const mesmoDia = hojeNoGabinete(new Date(item.fim)) === hojeNoGabinete(new Date(item.inicio));
      const fimBruto = mesmoDia ? minutosDoDia(item.fim) : horasDoDia * 60;
      return { item, inicio, fim: Math.max(fimBruto, inicio + 30) };
    })
    .sort((a, b) => a.inicio - b.inicio || b.fim - a.fim);

  const resultado: ItemPosicionado[] = [];
  let grupo: typeof base = [];
  let fimDoGrupo = -1;
  const fechar = () => {
    const ultimos: number[] = [];
    const colunas = grupo.map((g) => {
      let c = ultimos.findIndex((fim) => fim <= g.inicio);
      if (c === -1) c = ultimos.length;
      ultimos[c] = g.fim;
      return c;
    });
    grupo.forEach((g, i) =>
      resultado.push({ ...g, coluna: colunas[i] ?? 0, colunas: ultimos.length }),
    );
    grupo = [];
  };
  for (const e of base) {
    if (grupo.length > 0 && e.inicio >= fimDoGrupo) {
      fechar();
      fimDoGrupo = -1;
    }
    grupo.push(e);
    fimDoGrupo = Math.max(fimDoGrupo, e.fim);
  }
  if (grupo.length > 0) fechar();
  return resultado;
}

const formatadorDoMesCompleto = new Intl.DateTimeFormat('pt-BR', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
const formatadorDoDiaCompleto = new Intl.DateTimeFormat('pt-BR', {
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
});

export const nomeDoMesComAno = (data: string): string =>
  formatadorDoMesCompleto.format(noMeioDoDia(data));
export const nomeCurtoDoMes = (data: string): string =>
  formatadorDoMesCurto.format(noMeioDoDia(data)).replace('.', '');
export const diaPorExtenso = (data: string): string =>
  formatadorDoDiaCompleto.format(noMeioDoDia(data));
export const inicialDoDiaDaSemana = (data: string): string =>
  nomeCurtoDoDiaDaSemana(data).charAt(0).toUpperCase();
