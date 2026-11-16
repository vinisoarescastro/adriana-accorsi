import { createHash, randomUUID } from 'node:crypto';
import { documento, registrarTrilha, type BancoDeDados } from '@gabinete/banco';
import {
  tamanhoMaximoDoDocumento,
  type DocumentoDto,
  type NaturezaDeDocumento,
} from '@gabinete/compartilhado';
import { eq } from 'drizzle-orm';
import { carregarDemandaAlcancavel, exigirDemandaAberta } from '../atendimento/comum.js';
import type { Armazenamento } from '../armazenamento/armazenamento.js';
import type { ConsultasDeDemandas } from '../demandas/consultas.js';
import type { Ator } from '../equipe/regras.js';
import { erros } from '../erros.js';
import type { Antivirus } from './antivirus.js';
import { limparNomeDoArquivo, reconhecerDocumento } from './tipos.js';

export interface ConteudoDoDocumento {
  readonly bytes: Buffer;
  readonly tipo: string;
  readonly nome: string;
}

/**
 * Documentos de uma demanda. Os bytes ficam no armazenamento PRIVADO (nunca há URL direta); toda
 * leitura passa por aqui, que confere o alcance do registro a que o documento pertence.
 */
export class ServicoDeDocumentos {
  constructor(
    private readonly bd: BancoDeDados,
    private readonly armazenamento: Armazenamento,
    private readonly consultas: ConsultasDeDemandas,
    private readonly antivirus: Antivirus | undefined,
    private readonly agora: () => Date,
  ) {}

  async anexar(
    ator: Ator,
    demandaId: number,
    dados: { nome: string; natureza: NaturezaDeDocumento; bytes: Buffer },
  ): Promise<DocumentoDto[]> {
    exigirDemandaAberta(await carregarDemandaAlcancavel(this.bd, ator, demandaId));

    if (dados.bytes.length === 0) throw erros.arquivoInvalido('O arquivo está vazio.');
    if (dados.bytes.length > tamanhoMaximoDoDocumento) {
      throw erros.arquivoInvalido('O arquivo deve ter no máximo 25 MB.');
    }
    const reconhecido = reconhecerDocumento(dados.bytes);
    if (!reconhecido) {
      throw erros.arquivoInvalido('Envie um arquivo PDF, PNG, JPEG ou ZIP válido.');
    }
    const nome = limparNomeDoArquivo(dados.nome);

    // Falha fechada: arquivo que não pôde ser verificado não entra.
    let varredura: 'limpo' | 'nao_verificado' = 'nao_verificado';
    if (this.antivirus) {
      let resultado;
      try {
        resultado = await this.antivirus.verificar(dados.bytes);
      } catch {
        throw erros.verificacaoIndisponivel();
      }
      if (!resultado.limpo) {
        // A recusa fica na trilha (sem o arquivo) mesmo que a operação falhe.
        await registrarTrilha(this.bd, {
          origem: 'usuario',
          autorId: ator.usuarioId,
          operacao: 'demanda.documento_recusado',
          entidade: 'demanda',
          registroId: demandaId,
          valorNovo: { nome, motivo: 'antivirus' },
        });
        throw erros.arquivoInvalido('O arquivo foi recusado pela verificação de segurança.');
      }
      varredura = 'limpo';
    }

    const chave = `documentos/demandas/${demandaId}/${randomUUID()}.${reconhecido.extensao}`;
    // Os bytes vão ANTES do registro e são apagados se o registro falhar (não sobra arquivo órfão).
    await this.armazenamento.guardar(chave, dados.bytes, reconhecido.tipo);
    try {
      await this.bd.transaction(async (tx) => {
        const [criado] = await tx
          .insert(documento)
          .values({
            registroTipo: 'demanda',
            registroId: demandaId,
            natureza: dados.natureza,
            nome,
            tipoReal: reconhecido.tipo,
            tamanho: dados.bytes.length,
            chaveArmazenamento: chave,
            hashSha256: createHash('sha256').update(dados.bytes).digest('hex'),
            varredura,
            autorEnvio: ator.usuarioId,
          })
          .returning({ id: documento.id });
        await registrarTrilha(tx, {
          origem: 'usuario',
          autorId: ator.usuarioId,
          operacao: 'demanda.anexar_documento',
          entidade: 'demanda',
          registroId: demandaId,
          valorNovo: {
            documentoId: (criado as { id: number }).id,
            nome,
            natureza: dados.natureza,
            tipo: reconhecido.tipo,
            tamanho: dados.bytes.length,
          },
        });
      });
    } catch (erro) {
      await this.armazenamento.remover(chave).catch(() => undefined);
      throw erro;
    }
    return this.consultas.documentos(demandaId);
  }

  async baixar(ator: Ator, documentoId: number): Promise<ConteudoDoDocumento> {
    const doc = await this.carregar(documentoId);
    await carregarDemandaAlcancavel(this.bd, ator, doc.registroId);
    if (doc.situacao === 'removido') throw erros.naoEncontrado();
    const objeto = await this.armazenamento.ler(doc.chaveArmazenamento);
    if (!objeto) throw erros.naoEncontrado();
    return { bytes: objeto.bytes, tipo: doc.tipoReal, nome: doc.nome };
  }

  /** Remover MARCA o documento como removido; os bytes e o registro ficam (prestação de contas). */
  async remover(ator: Ator, documentoId: number): Promise<DocumentoDto[]> {
    const doc = await this.carregar(documentoId);
    exigirDemandaAberta(await carregarDemandaAlcancavel(this.bd, ator, doc.registroId));
    if (doc.situacao === 'removido') throw erros.conflito('O documento já foi removido.');

    await this.bd.transaction(async (tx) => {
      await tx
        .update(documento)
        .set({ situacao: 'removido', removidoPor: ator.usuarioId, removidoEm: this.agora() })
        .where(eq(documento.id, documentoId));
      await registrarTrilha(tx, {
        origem: 'usuario',
        autorId: ator.usuarioId,
        operacao: 'demanda.remover_documento',
        entidade: 'demanda',
        registroId: doc.registroId,
        valorNovo: { documentoId, nome: doc.nome },
      });
    });
    return this.consultas.documentos(doc.registroId);
  }

  /** Corrige o nome e/ou a natureza. O arquivo, o hash e o tamanho não mudam. */
  async editar(
    ator: Ator,
    documentoId: number,
    dados: { nome?: string | undefined; natureza?: NaturezaDeDocumento | undefined },
  ): Promise<DocumentoDto[]> {
    const doc = await this.carregar(documentoId);
    exigirDemandaAberta(await carregarDemandaAlcancavel(this.bd, ator, doc.registroId));
    if (doc.situacao === 'removido') throw erros.conflito('O documento removido não se altera.');

    const nome = dados.nome === undefined ? doc.nome : limparNomeDoArquivo(dados.nome);
    const natureza = dados.natureza ?? doc.natureza;
    await this.bd.transaction(async (tx) => {
      await tx.update(documento).set({ nome, natureza }).where(eq(documento.id, documentoId));
      await registrarTrilha(tx, {
        origem: 'usuario',
        autorId: ator.usuarioId,
        operacao: 'demanda.editar_documento',
        entidade: 'demanda',
        registroId: doc.registroId,
        valorAnterior: { documentoId, nome: doc.nome, natureza: doc.natureza },
        valorNovo: { documentoId, nome, natureza },
      });
    });
    return this.consultas.documentos(doc.registroId);
  }

  private async carregar(id: number) {
    const [doc] = await this.bd.select().from(documento).where(eq(documento.id, id)).limit(1);
    if (!doc || doc.registroTipo !== 'demanda') throw erros.naoEncontrado();
    return doc;
  }
}
