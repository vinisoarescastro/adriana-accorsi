import { documento, type BancoDeDados } from '@gabinete/banco';
import {
  deCentavos,
  paraCentavos,
  type DespesaResumo,
  type RelatorioDaCeap,
  type StatusDeDespesa,
} from '@gabinete/compartilhado';
import { and, eq, inArray } from 'drizzle-orm';
import type { Armazenamento } from '../armazenamento/armazenamento.js';
import { erros } from '../erros.js';
import type { ConsultasDaCeap } from './consultas.js';
import { montarZip, type ArquivoParaOZip } from './zip.js';

const soma = (itens: readonly DespesaResumo[]) =>
  deCentavos(itens.reduce((s, d) => s + (paraCentavos(d.valor) ?? 0), 0));
const competencia = (texto: string): [number, number] => {
  const m = /^(\d{4})-(\d{2})$/.exec(texto);
  if (!m || Number(m[2]) < 1 || Number(m[2]) > 12) throw erros.requisicaoInvalida();
  return [Number(m[1]), Number(m[2])];
};
const campoDoCsv = (v: string) => `"${v.replace(/"/g, '""')}"`;

/** Relatório de prestação de contas e pacote de comprovantes de um período de competências (AAAA-MM a AAAA-MM). */
export class ServicoDoRelatorioDaCeap {
  constructor(
    private readonly bd: BancoDeDados,
    private readonly consultas: ConsultasDaCeap,
    private readonly armazenamento: Armazenamento,
    private readonly agora: () => Date,
  ) {}

  private async doPeriodo(de: string, ate: string) {
    const [deAno, deMes] = competencia(de);
    const [ateAno, ateMes] = competencia(ate);
    if (deAno * 100 + deMes > ateAno * 100 + ateMes) throw erros.requisicaoInvalida();
    if ((ateAno - deAno) * 12 + (ateMes - deMes) > 24)
      throw erros.conflito('O período é de no máximo 25 meses.');
    return this.consultas.doPeriodo(deAno, deMes, ateAno, ateMes);
  }

  async relatorio(de: string, ate: string): Promise<RelatorioDaCeap> {
    const todas = await this.doPeriodo(de, ate);
    const validas = todas.filter((d) => d.status !== 'cancelada');
    const porCategoria = [...new Set(validas.map((d) => d.categoria.nome))].sort().map((nome) => {
      const itens = validas.filter((d) => d.categoria.nome === nome && d.consomeSaldo);
      return { nome, quantidade: itens.length, valor: soma(itens) };
    });
    const porStatus = [...new Set(todas.map((d) => d.status))].map((status: StatusDeDespesa) => {
      const itens = todas.filter((d) => d.status === status);
      return { status, quantidade: itens.length, valor: soma(itens) };
    });
    return {
      de,
      ate,
      geradoEm: this.agora().toISOString(),
      total: soma(validas.filter((d) => d.consomeSaldo)),
      porCategoria: porCategoria.filter((c) => c.quantidade > 0),
      porStatus,
      despesas: todas,
      decididasPeloLancador: validas.filter((d) => d.decisaoPeloProprioLancador),
      foraDoPrazo: validas.filter((d) => d.foraDoPrazo),
      semComprovante: validas.filter((d) => d.quantidadeDeComprovantes === 0 && d.consomeSaldo),
    };
  }

  /** O ZIP: a relação em CSV (com a marca de decisão pelo próprio lançador) e os comprovantes, por despesa. */
  async pacote(de: string, ate: string): Promise<{ bytes: Buffer; nome: string }> {
    const despesas = (await this.doPeriodo(de, ate)).filter((d) => d.status !== 'cancelada');
    const documentos = despesas.length
      ? await this.bd
          .select()
          .from(documento)
          .where(
            and(
              eq(documento.registroTipo, 'despesa'),
              eq(documento.situacao, 'ativo'),
              inArray(
                documento.registroId,
                despesas.map((d) => d.id),
              ),
            ),
          )
      : [];

    const cabecalho = [
      'Despesa',
      'Competência',
      'Data do documento',
      'Categoria',
      'Descrição',
      'Fornecedor',
      'Documento do fornecedor',
      'Número',
      'Valor (R$)',
      'Situação',
      'Decidida por',
      'Decisão pelo próprio lançador',
      'Comprovantes',
    ];
    const linhas = despesas.map((d) =>
      [
        String(d.id),
        `${String(d.competencia.mes).padStart(2, '0')}/${d.competencia.ano}`,
        d.dataDocumento,
        d.categoria.nome,
        d.descricao,
        d.fornecedor.nome,
        d.fornecedor.documento,
        d.numeroDocumento,
        d.valor.replace('.', ','),
        d.etapa.nome,
        d.decididaPor ?? '',
        d.decisaoPeloProprioLancador ? 'sim' : 'não',
        String(d.quantidadeDeComprovantes),
      ]
        .map(campoDoCsv)
        .join(';'),
    );
    const csv = `\uFEFF${cabecalho.map(campoDoCsv).join(';')}\r\n${linhas.join('\r\n')}\r\n`;

    const arquivos: ArquivoParaOZip[] = [
      { nome: 'relacao.csv', bytes: Buffer.from(csv, 'utf8'), data: this.agora() },
    ];
    for (const doc of documentos) {
      const objeto = await this.armazenamento.ler(doc.chaveArmazenamento);
      if (!objeto) continue;
      arquivos.push({
        nome: `comprovantes/despesa-${doc.registroId}/${doc.id}-${doc.nome}`,
        bytes: objeto.bytes,
        data: doc.enviadoEm,
      });
    }
    return { bytes: montarZip(arquivos), nome: `ceap-${de}-a-${ate}.zip` };
  }
}
