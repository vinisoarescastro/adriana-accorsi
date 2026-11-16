import { describe, expect, it } from 'vitest';
import { reconhecerDocumento } from '../documentos/tipos.js';
import { gerarPdf, gerarPng, gerarZip } from './arquivos.js';
import { Aleatorio } from './aleatorio.js';

describe('arquivos de demonstração', () => {
  it('o PDF, o PNG e o ZIP gerados são reconhecidos pelo sistema de documentos', () => {
    expect(reconhecerDocumento(gerarPdf('Ofício', ['Linha um']))?.tipo).toBe('application/pdf');
    expect(reconhecerDocumento(gerarPng(64, 40, 3))?.tipo).toBe('image/png');
    expect(reconhecerDocumento(gerarZip([{ nome: 'a.txt', texto: 'oi' }]))?.tipo).toBe(
      'application/zip',
    );
  });

  it('o PDF é válido: cabeçalho, objetos e fim do arquivo', () => {
    const texto = gerarPdf('Título', ['a', 'b']).toString('latin1');
    expect(texto.startsWith('%PDF-1.4')).toBe(true);
    expect(texto).toContain('startxref');
    expect(texto.trimEnd().endsWith('%%EOF')).toBe(true);
  });

  it('o sorteio com a mesma semente repete a sequência (a demonstração sai igual)', () => {
    const a = new Aleatorio(7);
    const b = new Aleatorio(7);
    expect([a.proximo(), a.proximo(), a.inteiro(1, 100)]).toEqual([
      b.proximo(),
      b.proximo(),
      b.inteiro(1, 100),
    ]);
  });
});
