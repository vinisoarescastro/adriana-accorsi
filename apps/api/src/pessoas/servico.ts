import {
  cancelarEnviosPendentes,
  consentimentosVigentes,
  pessoa,
  registrarConsentimento,
  registrarTrilha,
  type BancoDeDados,
  type Leitor,
} from '@gabinete/banco';
import {
  formatarTelefone,
  normalizarTelefone,
  type CorpoAtualizarPessoa,
  type CorpoNovaPessoa,
  type PaginaDePessoas,
  type PessoaDto,
} from '@gabinete/compartilhado';
import { and, count, eq, ilike, or, type SQL } from 'drizzle-orm';
import { padraoDeBusca, paginar } from '../atendimento/comum.js';
import { violouUnicidade } from '../banco-util.js';
import type { Ator } from '../equipe/regras.js';
import { erros } from '../erros.js';

type Linha = typeof pessoa.$inferSelect;

export const paraPessoaDto = (l: Linha, consentimento = false): PessoaDto => ({
  id: l.id,
  nomeCompleto: l.nomeCompleto,
  telefone: l.telefoneNormalizado ? formatarTelefone(l.telefoneNormalizado) : null,
  email: l.email,
  emailInvalido: l.emailInvalido,
  consentimento,
  contatos: l.contatos,
  endereco: l.endereco,
  situacao: l.situacao,
  criadoEm: l.criadoEm.toISOString(),
});

/**
 * Pessoas (o cidadão atendido). A trilha NUNCA guarda dados pessoais: se guardasse, eliminar os
 * dados de uma pessoa não a eliminaria de verdade. Ela registra só quais campos mudaram.
 */
export class ServicoDePessoas {
  constructor(private readonly bd: BancoDeDados) {}

  /** O DTO com o consentimento vigente (uma consulta só, para uma ou várias pessoas). */
  private async comConsentimento(
    linhas: readonly Linha[],
    leitor: Leitor = this.bd,
  ): Promise<PessoaDto[]> {
    const vigentes = await consentimentosVigentes(
      leitor,
      linhas.map((l) => l.id),
    );
    return linhas.map((l) => paraPessoaDto(l, vigentes.get(l.id) ?? false));
  }

  async obter(id: number): Promise<PessoaDto> {
    const [linha] = await this.bd.select().from(pessoa).where(eq(pessoa.id, id)).limit(1);
    if (!linha) throw erros.naoEncontrado();
    return (await this.comConsentimento([linha]))[0] as PessoaDto;
  }

  /** A pessoa ATIVA com esse telefone, se houver (qualquer forma de escrever o número serve). */
  async buscarPorTelefone(telefone: string): Promise<PessoaDto | null> {
    const normalizado = normalizarTelefone(telefone);
    if (!normalizado) return null;
    const [linha] = await this.bd
      .select()
      .from(pessoa)
      .where(and(eq(pessoa.telefoneNormalizado, normalizado), eq(pessoa.situacao, 'ativa')))
      .limit(1);
    return linha ? ((await this.comConsentimento([linha]))[0] as PessoaDto) : null;
  }

  async listar(filtro: {
    busca?: string;
    situacao?: 'ativa' | 'inativa' | 'dados_eliminados';
    pagina: number;
    porPagina: number;
  }): Promise<PaginaDePessoas> {
    const condicoes: SQL[] = [];
    if (filtro.situacao) condicoes.push(eq(pessoa.situacao, filtro.situacao));
    if (filtro.busca) {
      const digitos = filtro.busca.replace(/\D/g, '');
      const porNome = ilike(pessoa.nomeCompleto, padraoDeBusca(filtro.busca));
      const porTelefone =
        digitos.length >= 4 ? ilike(pessoa.telefoneNormalizado, padraoDeBusca(digitos)) : undefined;
      const criterio = porTelefone ? or(porNome, porTelefone) : porNome;
      if (criterio) condicoes.push(criterio);
    }
    const onde = condicoes.length > 0 ? and(...condicoes) : undefined;

    const [total] = await this.bd.select({ total: count() }).from(pessoa).where(onde);
    const { limite, deslocamento } = paginar(filtro.pagina, filtro.porPagina);
    const itens = await this.bd
      .select()
      .from(pessoa)
      .where(onde)
      .orderBy(pessoa.nomeCompleto, pessoa.id)
      .limit(limite)
      .offset(deslocamento);

    return {
      itens: await this.comConsentimento(itens),
      total: total?.total ?? 0,
      pagina: filtro.pagina,
      porPagina: filtro.porPagina,
    };
  }

  async criar(ator: Ator, dados: CorpoNovaPessoa): Promise<PessoaDto> {
    try {
      return await this.bd.transaction(async (tx) => {
        const [criada] = await tx
          .insert(pessoa)
          .values({
            nomeCompleto: dados.nome,
            telefoneNormalizado: dados.telefone,
            email: dados.email ?? null,
            contatos: dados.contatos ?? null,
            endereco: dados.endereco ?? null,
            criadoPor: ator.usuarioId,
          })
          .returning();
        await registrarTrilha(tx, {
          origem: 'usuario',
          autorId: ator.usuarioId,
          operacao: 'pessoa.criar',
          entidade: 'pessoa',
          registroId: (criada as Linha).id,
        });
        if (dados.consentimento) {
          if (!dados.email)
            throw erros.conflito('O consentimento por e-mail exige o e-mail da pessoa.');
          await registrarConsentimento(tx, {
            pessoaId: (criada as Linha).id,
            consentido: dados.consentimento.consentido,
            origem: dados.consentimento.origem,
            registradoPor: ator.usuarioId,
            ...(dados.consentimento.consentido
              ? { versaoTexto: dados.consentimento.versaoTexto }
              : {}),
          });
        }
        return paraPessoaDto(criada as Linha, dados.consentimento?.consentido === true);
      });
    } catch (erro) {
      this.traduzir(erro, dados.telefone);
    }
  }

  async atualizar(ator: Ator, id: number, dados: CorpoAtualizarPessoa): Promise<PessoaDto> {
    const atual = await this.exigirEditavel(id);

    const mudancas: Partial<typeof pessoa.$inferInsert> = {};
    if (dados.nome !== undefined) mudancas.nomeCompleto = dados.nome;
    if (dados.telefone !== undefined) mudancas.telefoneNormalizado = dados.telefone;
    if (dados.email !== undefined) {
      mudancas.email = dados.email;
      // Um e-mail corrigido merece nova chance: o marcador de inválido era do endereço antigo.
      if (dados.email !== atual.email) mudancas.emailInvalido = false;
    }
    if (dados.contatos !== undefined) mudancas.contatos = dados.contatos;
    if (dados.endereco !== undefined) mudancas.endereco = dados.endereco;

    try {
      return await this.bd.transaction(async (tx) => {
        const [salva] = await tx
          .update(pessoa)
          .set(mudancas)
          .where(eq(pessoa.id, atual.id))
          .returning();
        await registrarTrilha(tx, {
          origem: 'usuario',
          autorId: ator.usuarioId,
          operacao: 'pessoa.atualizar',
          entidade: 'pessoa',
          registroId: id,
          // Só os NOMES dos campos: o valor é dado pessoal e não pode ficar na trilha.
          valorNovo: { campos: Object.keys(mudancas) },
        });
        return (await this.comConsentimento([salva as Linha], tx))[0] as PessoaDto;
      });
    } catch (erro) {
      this.traduzir(erro, dados.telefone);
    }
  }

  async alterarSituacao(ator: Ator, id: number, situacao: 'ativa' | 'inativa'): Promise<PessoaDto> {
    const atual = await this.exigirEditavel(id);
    if (atual.situacao === situacao) return (await this.comConsentimento([atual]))[0] as PessoaDto;

    try {
      return await this.bd.transaction(async (tx) => {
        const [salva] = await tx
          .update(pessoa)
          .set({ situacao })
          .where(eq(pessoa.id, id))
          .returning();
        await registrarTrilha(tx, {
          origem: 'usuario',
          autorId: ator.usuarioId,
          operacao: situacao === 'inativa' ? 'pessoa.inativar' : 'pessoa.reativar',
          entidade: 'pessoa',
          registroId: id,
          valorAnterior: { situacao: atual.situacao },
          valorNovo: { situacao },
        });
        return (await this.comConsentimento([salva as Linha], tx))[0] as PessoaDto;
      });
    } catch (erro) {
      this.traduzir(erro, atual.telefoneNormalizado ?? undefined);
    }
  }

  /**
   * Elimina os dados pessoais (Administrador): nome, telefone, e-mail, contatos e endereço viram
   * nulos e a situação vira "dados eliminados". A linha permanece, para que protocolo, link e
   * histórico das demandas sigam funcionando. É irreversível.
   */
  async eliminarDados(ator: Ator, id: number): Promise<PessoaDto> {
    const atual = await this.exigirEditavel(id);
    return this.bd.transaction(async (tx) => {
      const [salva] = await tx
        .update(pessoa)
        .set({
          nomeCompleto: null,
          telefoneNormalizado: null,
          email: null,
          contatos: null,
          endereco: null,
          situacao: 'dados_eliminados',
        })
        .where(eq(pessoa.id, id))
        .returning();
      await registrarTrilha(tx, {
        origem: 'usuario',
        autorId: ator.usuarioId,
        operacao: 'pessoa.eliminar_dados',
        entidade: 'pessoa',
        registroId: id,
        valorAnterior: { situacao: atual.situacao },
        valorNovo: { situacao: 'dados_eliminados' },
        justificativa: 'Eliminação de dados pessoais',
      });
      // Eliminar encerra o consentimento e cancela o que ainda não saiu (e o e-mail já foi apagado).
      await registrarConsentimento(tx, {
        pessoaId: id,
        consentido: false,
        origem: 'dados_eliminados',
        registradoPor: ator.usuarioId,
      });
      await cancelarEnviosPendentes(tx, id, 'Dados pessoais eliminados');
      return paraPessoaDto(salva as Linha, false);
    });
  }

  private async exigirEditavel(id: number): Promise<Linha> {
    const [linha] = await this.bd.select().from(pessoa).where(eq(pessoa.id, id)).limit(1);
    if (!linha) throw erros.naoEncontrado();
    if (linha.situacao === 'dados_eliminados') {
      throw erros.conflito('Os dados desta pessoa foram eliminados e não podem ser alterados.');
    }
    return linha;
  }

  private traduzir(erro: unknown, telefone?: string): never {
    if (violouUnicidade(erro)) {
      throw erros.conflito(
        `Já existe uma pessoa ativa com o telefone ${telefone ? formatarTelefone(telefone) : 'informado'}.`,
      );
    }
    throw erro;
  }
}
