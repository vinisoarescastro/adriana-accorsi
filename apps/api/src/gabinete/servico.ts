import { gabinete, registrarTrilha, type BancoDeDados } from '@gabinete/banco';
import type { CorpoGabinete, IdentidadeDoGabinete } from '@gabinete/compartilhado';
import { eq } from 'drizzle-orm';
import { erros } from '../erros.js';
import type { Ator } from '../equipe/regras.js';

type Linha = typeof gabinete.$inferSelect;

const paraIdentidade = (l: Linha): IdentidadeDoGabinete => ({
  nome: l.nome,
  parlamentarNome: l.parlamentarNome,
  cargo: l.cargo,
  partido: l.partido,
  mandato: l.mandato,
  contatoTelefone: l.contatoTelefone,
  contatoEmail: l.contatoEmail,
  contatoEndereco: l.contatoEndereco,
  temFoto: l.fotoChave !== null,
  fuso: l.fuso,
});

/** Identidade da Parlamentar e do gabinete: uma única linha (id = 1). */
export class ServicoDoGabinete {
  constructor(private readonly bd: BancoDeDados) {}

  private async linha(): Promise<Linha | undefined> {
    const [linha] = await this.bd.select().from(gabinete).where(eq(gabinete.id, 1)).limit(1);
    return linha;
  }

  async obter(): Promise<IdentidadeDoGabinete> {
    const linha = await this.linha();
    if (!linha) throw erros.naoEncontrado();
    return paraIdentidade(linha);
  }

  async chaveDaFoto(): Promise<string | null> {
    const linha = await this.linha();
    if (!linha) throw erros.naoEncontrado();
    return linha.fotoChave;
  }

  async salvar(ator: Ator, dados: CorpoGabinete): Promise<IdentidadeDoGabinete> {
    const antes = await this.linha();
    const valores = {
      nome: dados.nome,
      parlamentarNome: dados.parlamentarNome,
      cargo: dados.cargo,
      partido: dados.partido ?? null,
      mandato: dados.mandato ?? null,
      contatoTelefone: dados.contatoTelefone ?? null,
      contatoEmail: dados.contatoEmail ?? null,
      contatoEndereco: dados.contatoEndereco ?? null,
    };

    const salvo = await this.bd.transaction(async (tx) => {
      const [linha] = await tx
        .insert(gabinete)
        .values({ id: 1, ...valores })
        .onConflictDoUpdate({ target: gabinete.id, set: valores })
        .returning();
      await registrarTrilha(tx, {
        origem: 'usuario',
        autorId: ator.usuarioId,
        operacao: antes ? 'gabinete.atualizar' : 'gabinete.criar',
        entidade: 'gabinete',
        registroId: 1,
        valorAnterior: antes ? paraIdentidade(antes) : null,
        valorNovo: valores,
      });
      return linha as Linha;
    });
    return paraIdentidade(salvo);
  }

  async registrarFoto(ator: Ator, chaveNova: string): Promise<string | null> {
    const antes = await this.linha();
    if (!antes) throw erros.naoEncontrado();
    await this.bd.transaction(async (tx) => {
      await tx.update(gabinete).set({ fotoChave: chaveNova }).where(eq(gabinete.id, 1));
      await registrarTrilha(tx, {
        origem: 'usuario',
        autorId: ator.usuarioId,
        operacao: 'gabinete.alterar_foto',
        entidade: 'gabinete',
        registroId: 1,
        valorAnterior: { temFoto: antes.fotoChave !== null },
        valorNovo: { temFoto: true },
      });
    });
    return antes.fotoChave;
  }
}
