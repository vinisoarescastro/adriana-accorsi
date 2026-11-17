import { categoria, registrarTrilha, type BancoDeDados } from '@gabinete/banco';
import type { CategoriaDto, CorpoNovaCategoria } from '@gabinete/compartilhado';
import { eq } from 'drizzle-orm';
import { violouUnicidade } from '../banco-util.js';
import type { Ator } from '../equipe/regras.js';
import { erros } from '../erros.js';

const paraDto = (l: typeof categoria.$inferSelect): CategoriaDto => ({
  id: l.id,
  natureza: l.natureza as CategoriaDto['natureza'],
  nome: l.nome,
  situacao: l.situacao,
});

/**
 * Vocabulários controlados do legislativo (tipos de proposição e assuntos). Nada se apaga: uma
 * categoria em uso só se inativa, e a inativa deixa de ser oferecida em projetos novos.
 */
export class ServicoDeVocabularios {
  constructor(private readonly bd: BancoDeDados) {}

  async criar(ator: Ator, dados: CorpoNovaCategoria): Promise<CategoriaDto> {
    try {
      return await this.bd.transaction(async (tx) => {
        const [criada] = await tx
          .insert(categoria)
          .values({ natureza: dados.natureza, nome: dados.nome })
          .returning();
        const nova = criada as typeof categoria.$inferSelect;
        await registrarTrilha(tx, {
          origem: 'usuario',
          autorId: ator.usuarioId,
          operacao: 'categoria.criar',
          entidade: 'categoria',
          registroId: nova.id,
          valorNovo: { natureza: nova.natureza, nome: nova.nome },
        });
        return paraDto(nova);
      });
    } catch (erro) {
      if (violouUnicidade(erro)) {
        throw erros.conflito('Já existe uma categoria com este nome. Reative a existente.');
      }
      throw erro;
    }
  }

  async alterarSituacao(
    ator: Ator,
    id: number,
    situacao: 'ativa' | 'inativa',
  ): Promise<CategoriaDto> {
    return this.bd.transaction(async (tx) => {
      const [atual] = await tx
        .select()
        .from(categoria)
        .where(eq(categoria.id, id))
        .limit(1)
        .for('update');
      // Só as categorias do legislativo se mantêm por aqui (as de despesa e emenda são de outra fase).
      if (
        !atual ||
        !['tipo_proposicao', 'assunto_projeto', 'tipo_emenda'].includes(atual.natureza)
      ) {
        throw erros.naoEncontrado();
      }
      if (atual.situacao === situacao) {
        throw erros.conflito(situacao === 'ativa' ? 'Já está ativa.' : 'Já está inativa.');
      }
      const [nova] = await tx
        .update(categoria)
        .set({ situacao })
        .where(eq(categoria.id, id))
        .returning();
      await registrarTrilha(tx, {
        origem: 'usuario',
        autorId: ator.usuarioId,
        operacao: situacao === 'ativa' ? 'categoria.reativar' : 'categoria.inativar',
        entidade: 'categoria',
        registroId: id,
        valorAnterior: { situacao: atual.situacao },
        valorNovo: { situacao },
      });
      return paraDto(nova as typeof categoria.$inferSelect);
    });
  }
}
