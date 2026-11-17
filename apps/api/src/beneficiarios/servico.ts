import { beneficiario, registrarTrilha, type BancoDeDados } from '@gabinete/banco';
import {
  normalizarCnpj,
  type BeneficiarioDto,
  type CorpoAtualizarBeneficiario,
  type CorpoNovoBeneficiario,
  type NaturezaDeBeneficiarioDto,
  type PaginaDeBeneficiarios,
  type Uf,
} from '@gabinete/compartilhado';
import { and, count, eq, ilike, or, type SQL } from 'drizzle-orm';
import { padraoDeBusca, paginar } from '../atendimento/comum.js';
import { violouUnicidade } from '../banco-util.js';
import type { Ator } from '../equipe/regras.js';
import { erros } from '../erros.js';

type Linha = typeof beneficiario.$inferSelect;

export const paraBeneficiarioDto = (l: Linha): BeneficiarioDto => ({
  id: l.id,
  nomeFantasia: l.nomeFantasia,
  razaoSocial: l.razaoSocial,
  cnpj: l.cnpj,
  natureza: l.natureza,
  cep: l.cep,
  logradouro: l.logradouro,
  numero: l.numero,
  complemento: l.complemento,
  bairro: l.bairro,
  cidade: l.cidade,
  estado: l.estado as Uf,
  situacao: l.situacao,
  criadoEm: l.criadoEm.toISOString(),
});

export interface FiltroDeBeneficiarios {
  readonly busca?: string | undefined;
  readonly situacao?: 'ativo' | 'inativo' | undefined;
  readonly natureza?: NaturezaDeBeneficiarioDto | undefined;
  readonly estado?: Uf | undefined;
  readonly pagina: number;
  readonly porPagina: number;
}

const mensagemDeCnpjRepetido = 'Já existe um beneficiário ativo com este CNPJ.';

/**
 * Beneficiários: municípios, órgãos e entidades que recebem emendas e aparecem em projetos. Os dados
 * são de pessoas jurídicas, então a trilha pode guardá-los. Os mesmos beneficiários serão usados
 * pelas emendas (fase 6).
 */
export class ServicoDeBeneficiarios {
  constructor(private readonly bd: BancoDeDados) {}

  async listar(filtro: FiltroDeBeneficiarios): Promise<PaginaDeBeneficiarios> {
    const condicoes: SQL[] = [];
    if (filtro.situacao) condicoes.push(eq(beneficiario.situacao, filtro.situacao));
    if (filtro.natureza) condicoes.push(eq(beneficiario.natureza, filtro.natureza));
    if (filtro.estado) condicoes.push(eq(beneficiario.estado, filtro.estado));
    if (filtro.busca) {
      const termo = padraoDeBusca(filtro.busca);
      const cnpj = normalizarCnpj(filtro.busca);
      const criterio = or(
        ilike(beneficiario.nomeFantasia, termo),
        ilike(beneficiario.razaoSocial, termo),
        ilike(beneficiario.cidade, termo),
        // Qualquer pedaço do CNPJ serve, com ou sem pontuação.
        cnpj.length >= 4 ? ilike(beneficiario.cnpj, padraoDeBusca(cnpj)) : undefined,
      );
      if (criterio) condicoes.push(criterio);
    }
    const onde = condicoes.length > 0 ? and(...condicoes) : undefined;

    const [total] = await this.bd.select({ total: count() }).from(beneficiario).where(onde);
    const { limite, deslocamento } = paginar(filtro.pagina, filtro.porPagina);
    const itens = await this.bd
      .select()
      .from(beneficiario)
      .where(onde)
      .orderBy(beneficiario.nomeFantasia, beneficiario.id)
      .limit(limite)
      .offset(deslocamento);

    return {
      itens: itens.map(paraBeneficiarioDto),
      total: total?.total ?? 0,
      pagina: filtro.pagina,
      porPagina: filtro.porPagina,
    };
  }

  async obter(id: number): Promise<BeneficiarioDto> {
    const [linha] = await this.bd
      .select()
      .from(beneficiario)
      .where(eq(beneficiario.id, id))
      .limit(1);
    if (!linha) throw erros.naoEncontrado();
    return paraBeneficiarioDto(linha);
  }

  async criar(ator: Ator, dados: CorpoNovoBeneficiario): Promise<BeneficiarioDto> {
    try {
      return await this.bd.transaction(async (tx) => {
        const [criado] = await tx
          .insert(beneficiario)
          .values({
            nomeFantasia: dados.nomeFantasia,
            razaoSocial: dados.razaoSocial,
            cnpj: dados.cnpj,
            natureza: dados.natureza,
            cep: dados.cep,
            logradouro: dados.logradouro,
            numero: dados.numero,
            complemento: dados.complemento || null,
            bairro: dados.bairro,
            cidade: dados.cidade,
            estado: dados.estado,
            criadoPor: ator.usuarioId,
          })
          .returning();
        const nova = criado as Linha;
        await registrarTrilha(tx, {
          origem: 'usuario',
          autorId: ator.usuarioId,
          operacao: 'beneficiario.criar',
          entidade: 'beneficiario',
          registroId: nova.id,
          valorNovo: { cnpj: nova.cnpj, natureza: nova.natureza, cidade: nova.cidade },
        });
        return paraBeneficiarioDto(nova);
      });
    } catch (erro) {
      if (violouUnicidade(erro)) throw erros.conflito(mensagemDeCnpjRepetido);
      throw erro;
    }
  }

  async atualizar(
    ator: Ator,
    id: number,
    dados: CorpoAtualizarBeneficiario,
  ): Promise<BeneficiarioDto> {
    const mudancas: Partial<typeof beneficiario.$inferInsert> = {};
    if (dados.nomeFantasia !== undefined) mudancas.nomeFantasia = dados.nomeFantasia;
    if (dados.razaoSocial !== undefined) mudancas.razaoSocial = dados.razaoSocial;
    if (dados.cnpj !== undefined) mudancas.cnpj = dados.cnpj;
    if (dados.natureza !== undefined) mudancas.natureza = dados.natureza;
    if (dados.cep !== undefined) mudancas.cep = dados.cep;
    if (dados.logradouro !== undefined) mudancas.logradouro = dados.logradouro;
    if (dados.numero !== undefined) mudancas.numero = dados.numero;
    if (dados.complemento !== undefined) mudancas.complemento = dados.complemento || null;
    if (dados.bairro !== undefined) mudancas.bairro = dados.bairro;
    if (dados.cidade !== undefined) mudancas.cidade = dados.cidade;
    if (dados.estado !== undefined) mudancas.estado = dados.estado;

    try {
      return await this.bd.transaction(async (tx) => {
        const [atual] = await tx
          .select()
          .from(beneficiario)
          .where(eq(beneficiario.id, id))
          .limit(1)
          .for('update');
        if (!atual) throw erros.naoEncontrado();
        const [novo] = await tx
          .update(beneficiario)
          .set(mudancas)
          .where(eq(beneficiario.id, id))
          .returning();
        await registrarTrilha(tx, {
          origem: 'usuario',
          autorId: ator.usuarioId,
          operacao: 'beneficiario.editar',
          entidade: 'beneficiario',
          registroId: id,
          valorAnterior: { cnpj: atual.cnpj },
          valorNovo: { campos: Object.keys(mudancas), cnpj: (novo as Linha).cnpj },
        });
        return paraBeneficiarioDto(novo as Linha);
      });
    } catch (erro) {
      if (violouUnicidade(erro)) throw erros.conflito(mensagemDeCnpjRepetido);
      throw erro;
    }
  }

  /** Inativar libera o CNPJ; reativar com o CNPJ já ocupado por outro ativo é recusado. */
  async alterarSituacao(
    ator: Ator,
    id: number,
    situacao: 'ativo' | 'inativo',
  ): Promise<BeneficiarioDto> {
    try {
      return await this.bd.transaction(async (tx) => {
        const [atual] = await tx
          .select()
          .from(beneficiario)
          .where(eq(beneficiario.id, id))
          .limit(1)
          .for('update');
        if (!atual) throw erros.naoEncontrado();
        if (atual.situacao === situacao) {
          throw erros.conflito(
            situacao === 'ativo'
              ? 'O beneficiário já está ativo.'
              : 'O beneficiário já está inativo.',
          );
        }
        const [novo] = await tx
          .update(beneficiario)
          .set({ situacao })
          .where(eq(beneficiario.id, id))
          .returning();
        await registrarTrilha(tx, {
          origem: 'usuario',
          autorId: ator.usuarioId,
          operacao: situacao === 'ativo' ? 'beneficiario.reativar' : 'beneficiario.inativar',
          entidade: 'beneficiario',
          registroId: id,
          valorAnterior: { situacao: atual.situacao },
          valorNovo: { situacao },
        });
        return paraBeneficiarioDto(novo as Linha);
      });
    } catch (erro) {
      if (violouUnicidade(erro)) throw erros.conflito(mensagemDeCnpjRepetido);
      throw erro;
    }
  }
}
