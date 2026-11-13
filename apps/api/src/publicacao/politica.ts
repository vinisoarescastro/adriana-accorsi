import { politicaPublicacao, registrarTrilha, usuario, type BancoDeDados } from '@gabinete/banco';
import type {
  CorpoPoliticaDePublicacao,
  PoliticaDePublicacaoDto,
  PoliticaEHistorico,
} from '@gabinete/compartilhado';
import { desc, eq, isNull, sql } from 'drizzle-orm';
import type { Ator } from '../equipe/regras.js';
import { erros } from '../erros.js';

/**
 * Política de publicação: o que o cidadão pode ver. Versionada: alterar fecha a versão vigente e
 * abre a seguinte, na mesma transação (RN-PUB-03). Nada é público por padrão (RN-PUB-01).
 */
export class ServicoDePoliticaDePublicacao {
  // As datas de vigência vêm do relógio do banco, na mesma transação: fechar e abrir coincidem, e
  // um relógio da aplicação defasado nunca produz uma vigência invertida.
  constructor(private readonly bd: BancoDeDados) {}

  private async linhas() {
    return this.bd
      .select({
        id: politicaPublicacao.id,
        exibirTitulo: politicaPublicacao.exibirTitulo,
        exibicaoNome: politicaPublicacao.exibicaoNome,
        exibicaoTelefone: politicaPublicacao.exibicaoTelefone,
        expiracaoDias: politicaPublicacao.expiracaoDias,
        vigenteDesde: politicaPublicacao.vigenteDesde,
        vigenteAte: politicaPublicacao.vigenteAte,
        criadoPor: usuario.nome,
      })
      .from(politicaPublicacao)
      .leftJoin(usuario, eq(usuario.id, politicaPublicacao.criadoPor))
      .orderBy(desc(politicaPublicacao.id));
  }

  async consultar(): Promise<PoliticaEHistorico> {
    const todas = (await this.linhas()).map((l): PoliticaDePublicacaoDto => ({
      ...l,
      vigenteDesde: l.vigenteDesde.toISOString(),
      vigenteAte: l.vigenteAte?.toISOString() ?? null,
    }));
    const vigente = todas.find((p) => p.vigenteAte === null);
    if (!vigente) throw new Error('Não há política de publicação vigente.');
    return { vigente, anteriores: todas.filter((p) => p !== vigente) };
  }

  async alterar(ator: Ator, dados: CorpoPoliticaDePublicacao): Promise<PoliticaEHistorico> {
    await this.bd.transaction(async (tx) => {
      const [atual] = await tx
        .select()
        .from(politicaPublicacao)
        .where(isNull(politicaPublicacao.vigenteAte))
        .limit(1)
        .for('update');
      if (!atual) throw new Error('Não há política de publicação vigente.');
      if (
        atual.exibirTitulo === dados.exibirTitulo &&
        atual.exibicaoNome === dados.exibicaoNome &&
        atual.exibicaoTelefone === dados.exibicaoTelefone &&
        atual.expiracaoDias === dados.expiracaoDias
      ) {
        throw erros.conflito('Nada mudou em relação à política vigente.');
      }

      await tx
        .update(politicaPublicacao)
        .set({ vigenteAte: sql`now()` })
        .where(eq(politicaPublicacao.id, atual.id));
      const [nova] = await tx
        .insert(politicaPublicacao)
        .values({ ...dados, criadoPor: ator.usuarioId })
        .returning({ id: politicaPublicacao.id });
      await registrarTrilha(tx, {
        origem: 'usuario',
        autorId: ator.usuarioId,
        operacao: 'publicacao.alterar_politica',
        entidade: 'politica_publicacao',
        registroId: (nova as { id: number }).id,
        valorAnterior: {
          exibirTitulo: atual.exibirTitulo,
          exibicaoNome: atual.exibicaoNome,
          exibicaoTelefone: atual.exibicaoTelefone,
          expiracaoDias: atual.expiracaoDias,
        },
        valorNovo: dados,
      });
    });
    return this.consultar();
  }
}
