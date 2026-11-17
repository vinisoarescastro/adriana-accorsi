import {
  ceapCategoria,
  ceapParametro,
  registrarTrilha,
  usuario,
  type BancoDeDados,
} from '@gabinete/banco';
import {
  chavesDeParametroDaCeap,
  type CategoriaDaCeapDto,
  type ChaveDeParametroDaCeapDto,
  type CorpoNovoParametro,
  type ParametroDto,
  type ParametrosDaCeap,
} from '@gabinete/compartilhado';
import { desc, eq } from 'drizzle-orm';
import { hojeNoGabinete } from '../atendimento/comum.js';
import { mensagemDoPostgres, violouUnicidade } from '../banco-util.js';
import type { Ator } from '../equipe/regras.js';
import { erros } from '../erros.js';

const diaAnterior = (dia: string) =>
  new Date(new Date(`${dia}T12:00:00Z`).getTime() - 86_400_000).toISOString().slice(0, 10);

const paraCategoria = (l: typeof ceapCategoria.$inferSelect): CategoriaDaCeapDto => ({
  id: l.id,
  nome: l.nome,
  itemNorma: l.itemNorma,
  tetoMensal: l.tetoMensal,
  comprovanteObrigatorio: l.comprovanteObrigatorio,
  situacao: l.situacao,
});

/**
 * Parâmetros e categorias da CEAP. Nada da norma fica no código: o que a Câmara pode mudar é dado, com
 * vigência. Alterar um parâmetro fecha a vigência anterior (no dia anterior) e abre a nova, para reconstituir o
 * que valia em cada data. Só o Administrador e a Parlamentar alteram, e tudo vai para a trilha.
 */
export class ServicoDeParametrosDaCeap {
  constructor(
    private readonly bd: BancoDeDados,
    private readonly agora: () => Date,
  ) {}

  async listar(): Promise<ParametrosDaCeap> {
    const linhas = await this.bd
      .select({
        id: ceapParametro.id,
        chave: ceapParametro.chave,
        valor: ceapParametro.valor,
        vigenteDe: ceapParametro.vigenteDe,
        vigenteAte: ceapParametro.vigenteAte,
        definidoPor: usuario.nome,
        definidoEm: ceapParametro.definidoEm,
      })
      .from(ceapParametro)
      .innerJoin(usuario, eq(usuario.id, ceapParametro.definidoPor))
      .orderBy(desc(ceapParametro.vigenteDe), desc(ceapParametro.id));
    const historico: ParametroDto[] = linhas.map((l) => ({
      ...l,
      definidoEm: l.definidoEm.toISOString(),
    }));
    const hoje = hojeNoGabinete(this.agora());
    const vigentes = Object.fromEntries(
      chavesDeParametroDaCeap.map((c) => [
        c,
        historico.find(
          (p) =>
            p.chave === c && p.vigenteDe <= hoje && (p.vigenteAte === null || p.vigenteAte >= hoje),
        ) ?? null,
      ]),
    ) as Record<ChaveDeParametroDaCeapDto, ParametroDto | null>;
    return { vigentes, historico };
  }

  /** Abre uma vigência nova; a anterior, se aberta, termina no dia anterior. A nova começa depois da última. */
  async definir(ator: Ator, dados: CorpoNovoParametro): Promise<ParametrosDaCeap> {
    try {
      await this.bd.transaction(async (tx) => {
        const existentes = await tx
          .select()
          .from(ceapParametro)
          .where(eq(ceapParametro.chave, dados.chave))
          .orderBy(desc(ceapParametro.vigenteDe))
          .for('update');
        const ultima = existentes[0];
        if (ultima && dados.vigenteDe <= ultima.vigenteDe) {
          throw erros.conflito(
            'A nova vigência precisa começar depois da última (a partir de ' +
              ultima.vigenteDe +
              ').',
          );
        }
        if (ultima && (ultima.vigenteAte === null || ultima.vigenteAte >= dados.vigenteDe)) {
          await tx
            .update(ceapParametro)
            .set({ vigenteAte: diaAnterior(dados.vigenteDe) })
            .where(eq(ceapParametro.id, ultima.id));
        }
        await tx.insert(ceapParametro).values({
          chave: dados.chave,
          valor: dados.valor,
          vigenteDe: dados.vigenteDe,
          definidoPor: ator.usuarioId,
          definidoEm: this.agora(),
        });
        await registrarTrilha(tx, {
          origem: 'usuario',
          autorId: ator.usuarioId,
          operacao: 'ceap.parametro_definir',
          entidade: 'ceap_parametro',
          registroId: dados.chave,
          valorAnterior: ultima ? { valor: ultima.valor, vigenteDe: ultima.vigenteDe } : null,
          valorNovo: { valor: dados.valor, vigenteDe: dados.vigenteDe },
        });
      });
    } catch (erro) {
      if (mensagemDoPostgres(erro).includes('se sobrepõe'))
        throw erros.conflito('A vigência se sobrepõe a outra.');
      throw erro;
    }
    return this.listar();
  }

  // --- Categorias ---

  async categorias(): Promise<CategoriaDaCeapDto[]> {
    return (await this.bd.select().from(ceapCategoria).orderBy(ceapCategoria.nome)).map(
      paraCategoria,
    );
  }

  async criarCategoria(
    ator: Ator,
    dados: {
      nome: string;
      itemNorma?: string | undefined;
      tetoMensal?: string | undefined;
      comprovanteObrigatorio: boolean;
    },
  ): Promise<CategoriaDaCeapDto[]> {
    try {
      await this.bd.transaction(async (tx) => {
        const [criada] = await tx
          .insert(ceapCategoria)
          .values({
            nome: dados.nome,
            itemNorma: dados.itemNorma ?? null,
            tetoMensal: dados.tetoMensal ?? null,
            comprovanteObrigatorio: dados.comprovanteObrigatorio,
          })
          .returning({ id: ceapCategoria.id });
        await registrarTrilha(tx, {
          origem: 'usuario',
          autorId: ator.usuarioId,
          operacao: 'ceap.categoria_criar',
          entidade: 'ceap_categoria',
          registroId: (criada as { id: number }).id,
          valorNovo: { nome: dados.nome, tetoMensal: dados.tetoMensal ?? null },
        });
      });
    } catch (erro) {
      if (violouUnicidade(erro)) throw erros.conflito('Já existe uma categoria com este nome.');
      throw erro;
    }
    return this.categorias();
  }

  async atualizarCategoria(
    ator: Ator,
    id: number,
    dados: {
      nome?: string | undefined;
      itemNorma?: string | null | undefined;
      tetoMensal?: string | null | undefined;
      comprovanteObrigatorio?: boolean | undefined;
    },
  ): Promise<CategoriaDaCeapDto[]> {
    const mudancas: Partial<typeof ceapCategoria.$inferInsert> = {};
    if (dados.nome !== undefined) mudancas.nome = dados.nome;
    if (dados.itemNorma !== undefined) mudancas.itemNorma = dados.itemNorma;
    if (dados.tetoMensal !== undefined) mudancas.tetoMensal = dados.tetoMensal;
    if (dados.comprovanteObrigatorio !== undefined)
      mudancas.comprovanteObrigatorio = dados.comprovanteObrigatorio;
    try {
      await this.bd.transaction(async (tx) => {
        const [atual] = await tx
          .select()
          .from(ceapCategoria)
          .where(eq(ceapCategoria.id, id))
          .limit(1)
          .for('update');
        if (!atual) throw erros.naoEncontrado();
        await tx.update(ceapCategoria).set(mudancas).where(eq(ceapCategoria.id, id));
        await registrarTrilha(tx, {
          origem: 'usuario',
          autorId: ator.usuarioId,
          operacao: 'ceap.categoria_editar',
          entidade: 'ceap_categoria',
          registroId: id,
          valorAnterior: {
            nome: atual.nome,
            tetoMensal: atual.tetoMensal,
            comprovanteObrigatorio: atual.comprovanteObrigatorio,
          },
          valorNovo: mudancas,
        });
      });
    } catch (erro) {
      if (violouUnicidade(erro)) throw erros.conflito('Já existe uma categoria com este nome.');
      throw erro;
    }
    return this.categorias();
  }

  /** Desativar não apaga: as despesas antigas mantêm a categoria. A última ativa não se desativa. */
  async alterarSituacaoDaCategoria(
    ator: Ator,
    id: number,
    situacao: 'ativa' | 'inativa',
  ): Promise<CategoriaDaCeapDto[]> {
    try {
      await this.bd.transaction(async (tx) => {
        const [atual] = await tx
          .select()
          .from(ceapCategoria)
          .where(eq(ceapCategoria.id, id))
          .limit(1)
          .for('update');
        if (!atual) throw erros.naoEncontrado();
        if (atual.situacao === situacao)
          throw erros.conflito(situacao === 'ativa' ? 'Já está ativa.' : 'Já está inativa.');
        await tx.update(ceapCategoria).set({ situacao }).where(eq(ceapCategoria.id, id));
        await registrarTrilha(tx, {
          origem: 'usuario',
          autorId: ator.usuarioId,
          operacao: situacao === 'ativa' ? 'ceap.categoria_reativar' : 'ceap.categoria_desativar',
          entidade: 'ceap_categoria',
          registroId: id,
          valorNovo: { situacao },
        });
      });
    } catch (erro) {
      if (mensagemDoPostgres(erro).includes('última categoria ativa')) {
        throw erros.conflito('A última categoria ativa não se desativa.');
      }
      throw erro;
    }
    return this.categorias();
  }
}
