import type { ItemDaAgenda } from '@gabinete/compartilhado';
import { describe, expect, it } from 'vitest';
import { intervaloDaVisao, posicionarNoDia, somarMeses, tituloDoPeriodo } from './calendario';

const compromisso = (id: number, inicio: string, fim: string): ItemDaAgenda => ({
  tipo: 'compromisso',
  id,
  titulo: `C${id}`,
  descricao: null,
  local: null,
  inicio,
  fim,
  diaInteiro: false,
  visibilidade: 'aberto',
  envolveParlamentar: false,
  criador: 'X',
  cancelado: false,
  participantesInternos: [],
  participantesExternos: [],
  minhaResposta: null,
});

describe('calendário da agenda', () => {
  it('a semana começa no domingo e termina no sábado', () => {
    // 2026-11-18 é uma quarta-feira.
    expect(intervaloDaVisao('semana', '2026-11-18')).toEqual({
      inicio: '2026-11-15',
      fim: '2026-11-21',
    });
    // Num domingo, a semana começa nele mesmo.
    expect(intervaloDaVisao('semana', '2026-11-15').inicio).toBe('2026-11-15');
  });

  it('o mês cobre as semanas inteiras, de domingo a sábado', () => {
    expect(intervaloDaVisao('mes', '2026-11-18')).toEqual({
      inicio: '2026-11-01',
      fim: '2026-12-05',
    });
  });

  it('navega por meses e mostra o título do período', () => {
    expect(somarMeses('2026-12-20', 1)).toBe('2027-01-01');
    expect(somarMeses('2026-01-31', -1)).toBe('2025-12-01');
    expect(tituloDoPeriodo('mes', '2026-11-18')).toBe('novembro de 2026');
    expect(tituloDoPeriodo('semana', '2026-11-18')).toBe('15 a 21 de novembro de 2026');
  });

  it('compromissos que se sobrepõem ficam lado a lado, e os separados ocupam a largura toda', () => {
    const itens = [
      compromisso(1, '2026-11-18T13:00:00.000Z', '2026-11-18T15:00:00.000Z'),
      compromisso(2, '2026-11-18T14:00:00.000Z', '2026-11-18T16:00:00.000Z'),
      compromisso(3, '2026-11-18T18:00:00.000Z', '2026-11-18T19:00:00.000Z'),
    ];
    const p = posicionarNoDia(itens);
    expect(p.map((x) => [x.coluna, x.colunas])).toEqual([
      [0, 2],
      [1, 2],
      [0, 1],
    ]);
  });
});
