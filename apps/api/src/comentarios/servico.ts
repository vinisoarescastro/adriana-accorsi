import { nivelDoPerfil } from '@gabinete/autorizacao';
import {
  comentarioInterno,
  comentarioMencao,
  habilitacao,
  registrarTrilha,
  usuario,
  type BancoDeDados,
} from '@gabinete/banco';
import {
  perfisComTodasAsHabilitacoes,
  type ComentarioDto,
  type CorpoNovoComentario,
} from '@gabinete/compartilhado';
import { and, eq, inArray } from 'drizzle-orm';
import { carregarDemandaAlcancavel } from '../atendimento/comum.js';
import type { ConsultasDeDemandas } from '../demandas/consultas.js';
import type { Ator } from '../equipe/regras.js';
import { erros } from '../erros.js';

/**
 * Comentários internos: texto da equipe, SEMPRE interno. Não existe operação que o publique nem
 * campo que o torne público: o andamento ao cidadão é outra entidade, escrita de propósito (fase 3).
 */
export class ServicoDeComentarios {
  constructor(
    private readonly bd: BancoDeDados,
    private readonly consultas: ConsultasDeDemandas,
    private readonly agora: () => Date,
  ) {}

  /** Só ficam as menções a usuários ativos que alcançam o registro (RF-V13). */
  private async mencionaveis(ids: readonly number[]): Promise<number[]> {
    const unicos = [...new Set(ids)];
    if (unicos.length === 0) return [];
    const ativos = await this.bd
      .select({ id: usuario.id, perfil: usuario.perfil })
      .from(usuario)
      .where(and(inArray(usuario.id, unicos), eq(usuario.situacao, 'ativo')));
    const comAtendimento = new Set(
      (
        await this.bd
          .select({ usuarioId: habilitacao.usuarioId })
          .from(habilitacao)
          .where(and(inArray(habilitacao.usuarioId, unicos), eq(habilitacao.area, 'AT')))
      ).map((h) => h.usuarioId),
    );
    return ativos
      .filter((u) => perfisComTodasAsHabilitacoes.includes(u.perfil) || comAtendimento.has(u.id))
      .map((u) => u.id);
  }

  async criar(ator: Ator, demandaId: number, dados: CorpoNovoComentario): Promise<ComentarioDto[]> {
    await carregarDemandaAlcancavel(this.bd, ator, demandaId);
    const mencionados = await this.mencionaveis(dados.mencoes);

    await this.bd.transaction(async (tx) => {
      const [criado] = await tx
        .insert(comentarioInterno)
        .values({
          registroTipo: 'demanda',
          registroId: demandaId,
          autorId: ator.usuarioId,
          texto: dados.texto,
        })
        .returning({ id: comentarioInterno.id });
      const comentarioId = (criado as { id: number }).id;
      if (mencionados.length > 0) {
        await tx
          .insert(comentarioMencao)
          .values(mencionados.map((usuarioId) => ({ comentarioId, usuarioId })));
      }
      // A trilha guarda o id, nunca o texto.
      await registrarTrilha(tx, {
        origem: 'usuario',
        autorId: ator.usuarioId,
        operacao: 'demanda.comentar',
        entidade: 'demanda',
        registroId: demandaId,
        valorNovo: { comentarioId, mencionados },
      });
    });
    return this.consultas.comentarios(demandaId);
  }

  /** Cada um remove o próprio; o de terceiro exige Supervisor (RN-COM-02). */
  async remover(ator: Ator, comentarioId: number): Promise<ComentarioDto[]> {
    const [comentario] = await this.bd
      .select()
      .from(comentarioInterno)
      .where(eq(comentarioInterno.id, comentarioId))
      .limit(1);
    if (!comentario || comentario.registroTipo !== 'demanda') throw erros.naoEncontrado();
    await carregarDemandaAlcancavel(this.bd, ator, comentario.registroId);

    if (comentario.autorId !== ator.usuarioId && nivelDoPerfil[ator.perfil] < 3) {
      throw erros.semPermissao('Só o autor ou um Supervisor remove um comentário.');
    }
    if (comentario.situacao === 'removido') throw erros.conflito('O comentário já foi removido.');

    await this.bd.transaction(async (tx) => {
      await tx
        .update(comentarioInterno)
        .set({ situacao: 'removido', removidoPor: ator.usuarioId, removidoEm: this.agora() })
        .where(eq(comentarioInterno.id, comentarioId));
      await registrarTrilha(tx, {
        origem: 'usuario',
        autorId: ator.usuarioId,
        operacao: 'demanda.remover_comentario',
        entidade: 'demanda',
        registroId: comentario.registroId,
        valorNovo: { comentarioId, autorDoComentario: comentario.autorId },
      });
    });
    return this.consultas.comentarios(comentario.registroId);
  }
}
