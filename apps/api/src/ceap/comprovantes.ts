import { createHash, randomUUID } from 'node:crypto';
import { nivelDoPerfil } from '@gabinete/autorizacao';
import { despesa, documento, registrarTrilha, type BancoDeDados } from '@gabinete/banco';
import { tamanhoMaximoDoDocumento, type ComprovanteDto } from '@gabinete/compartilhado';
import { eq } from 'drizzle-orm';
import type { Armazenamento } from '../armazenamento/armazenamento.js';
import type { Antivirus } from '../documentos/antivirus.js';
import type { ConteudoDoDocumento } from '../documentos/servico.js';
import { limparNomeDoArquivo, reconhecerDocumento } from '../documentos/tipos.js';
import type { Ator } from '../equipe/regras.js';
import { erros } from '../erros.js';
import type { ConsultasDaCeap } from './consultas.js';
import { statusDaEtapa } from './saldo.js';
import { etapa } from '@gabinete/banco';

/**
 * Comprovantes da despesa. Os bytes ficam no armazenamento PRIVADO, com antivírus e tipo conferido pelo conteúdo,
 * como os documentos de demanda. Anexar vale até a despesa ser decidida; remover, só enquanto é rascunho; e o
 * comprovante de despesa aprovada nunca sai (prestação de contas, RN-CEAP-03).
 */
export class ServicoDeComprovantes {
  constructor(
    private readonly bd: BancoDeDados,
    private readonly armazenamento: Armazenamento,
    private readonly consultas: ConsultasDaCeap,
    private readonly antivirus: Antivirus | undefined,
    private readonly agora: () => Date,
  ) {}

  private async carregarDespesa(id: number) {
    const [linha] = await this.bd
      .select({
        id: despesa.id,
        lancadoPor: despesa.lancadoPor,
        responsavelId: despesa.responsavelId,
        canceladaEm: despesa.canceladaEm,
        etapaNome: etapa.nomeInterno,
        etapaPapel: etapa.papel,
      })
      .from(despesa)
      .innerJoin(etapa, eq(etapa.id, despesa.etapaAtualId))
      .where(eq(despesa.id, id))
      .limit(1);
    if (!linha) throw erros.naoEncontrado();
    return {
      ...linha,
      status: linha.canceladaEm
        ? ('cancelada' as const)
        : statusDaEtapa(linha.etapaNome, linha.etapaPapel),
    };
  }

  private exigirPodeMexer(ator: Ator, d: { lancadoPor: number; responsavelId: number }) {
    if (
      nivelDoPerfil[ator.perfil] >= 3 ||
      d.lancadoPor === ator.usuarioId ||
      d.responsavelId === ator.usuarioId
    )
      return;
    throw erros.semPermissao(
      'Só quem lançou, o responsável, o Supervisor ou superior mexem nesta despesa.',
    );
  }

  async anexar(
    ator: Ator,
    despesaId: number,
    dados: { nome: string; bytes: Buffer },
  ): Promise<ComprovanteDto[]> {
    const d = await this.carregarDespesa(despesaId);
    this.exigirPodeMexer(ator, d);
    if (d.status !== 'lancada' && d.status !== 'em_analise') {
      throw erros.conflito('Só se anexa comprovante a despesa ainda não decidida.');
    }
    if (dados.bytes.length === 0) throw erros.arquivoInvalido('O arquivo está vazio.');
    if (dados.bytes.length > tamanhoMaximoDoDocumento)
      throw erros.arquivoInvalido('O arquivo deve ter no máximo 25 MB.');
    const reconhecido = reconhecerDocumento(dados.bytes);
    if (!reconhecido) throw erros.arquivoInvalido('Envie um arquivo PDF, PNG, JPEG ou ZIP válido.');
    const nome = limparNomeDoArquivo(dados.nome);

    let varredura: 'limpo' | 'nao_verificado' = 'nao_verificado';
    if (this.antivirus) {
      let resultado;
      try {
        resultado = await this.antivirus.verificar(dados.bytes);
      } catch {
        throw erros.verificacaoIndisponivel();
      }
      if (!resultado.limpo) {
        await registrarTrilha(this.bd, {
          origem: 'usuario',
          autorId: ator.usuarioId,
          operacao: 'ceap.comprovante_recusado',
          entidade: 'despesa',
          registroId: despesaId,
          valorNovo: { nome, motivo: 'antivirus' },
        });
        throw erros.arquivoInvalido('O arquivo foi recusado pela verificação de segurança.');
      }
      varredura = 'limpo';
    }

    const chave = `documentos/despesas/${despesaId}/${randomUUID()}.${reconhecido.extensao}`;
    await this.armazenamento.guardar(chave, dados.bytes, reconhecido.tipo);
    try {
      await this.bd.transaction(async (tx) => {
        const [criado] = await tx
          .insert(documento)
          .values({
            registroTipo: 'despesa',
            registroId: despesaId,
            natureza: 'comprovante',
            nome,
            tipoReal: reconhecido.tipo,
            tamanho: dados.bytes.length,
            chaveArmazenamento: chave,
            hashSha256: createHash('sha256').update(dados.bytes).digest('hex'),
            varredura,
            autorEnvio: ator.usuarioId,
            enviadoEm: this.agora(),
          })
          .returning({ id: documento.id });
        await registrarTrilha(tx, {
          origem: 'usuario',
          autorId: ator.usuarioId,
          operacao: 'ceap.comprovante_anexar',
          entidade: 'despesa',
          registroId: despesaId,
          valorNovo: {
            documentoId: (criado as { id: number }).id,
            nome,
            tipo: reconhecido.tipo,
            tamanho: dados.bytes.length,
          },
        });
      });
    } catch (erro) {
      await this.armazenamento.remover(chave).catch(() => undefined);
      throw erro;
    }
    return this.consultas.comprovantes(despesaId);
  }

  private async carregarDocumento(id: number) {
    const [doc] = await this.bd.select().from(documento).where(eq(documento.id, id)).limit(1);
    if (!doc || doc.registroTipo !== 'despesa') throw erros.naoEncontrado();
    return doc;
  }

  async baixar(documentoId: number): Promise<ConteudoDoDocumento> {
    const doc = await this.carregarDocumento(documentoId);
    if (doc.situacao === 'removido') throw erros.naoEncontrado();
    const objeto = await this.armazenamento.ler(doc.chaveArmazenamento);
    if (!objeto) throw erros.naoEncontrado();
    return { bytes: objeto.bytes, tipo: doc.tipoReal, nome: doc.nome };
  }

  /** Remover MARCA como removido (o arquivo fica, para a prestação de contas); só com a despesa ainda em rascunho. */
  async remover(ator: Ator, documentoId: number): Promise<ComprovanteDto[]> {
    const doc = await this.carregarDocumento(documentoId);
    const d = await this.carregarDespesa(doc.registroId);
    this.exigirPodeMexer(ator, d);
    if (d.status !== 'lancada')
      throw erros.conflito('O comprovante de uma despesa enviada para análise não sai.');
    if (doc.situacao === 'removido') throw erros.conflito('O comprovante já foi removido.');
    await this.bd.transaction(async (tx) => {
      await tx
        .update(documento)
        .set({ situacao: 'removido', removidoPor: ator.usuarioId, removidoEm: this.agora() })
        .where(eq(documento.id, documentoId));
      await registrarTrilha(tx, {
        origem: 'usuario',
        autorId: ator.usuarioId,
        operacao: 'ceap.comprovante_remover',
        entidade: 'despesa',
        registroId: doc.registroId,
        valorNovo: { documentoId, nome: doc.nome },
      });
    });
    return this.consultas.comprovantes(doc.registroId);
  }
}
