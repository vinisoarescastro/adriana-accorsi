import {
  andamentoPublicado,
  consentimentoNotificacao,
  consentimentoVigente,
  demanda,
  enfileirarNotificacao,
  pessoa,
  registrarTrilha,
  usuario,
  type BancoDeDados,
  type Conexao,
} from '@gabinete/banco';
import type {
  AcompanhamentoInterno,
  AndamentoDto,
  CorpoNovoAndamento,
  NotificacaoDaPessoa,
} from '@gabinete/compartilhado';
import { lerAcompanhamento } from '@gabinete/banco/publico';
import { desc, eq, inArray } from 'drizzle-orm';
import { carregarDemandaAlcancavel, exigirDemandaAberta } from '../atendimento/comum.js';
import type { Ator } from '../equipe/regras.js';
import { erros } from '../erros.js';
import {
  cifrarSegredoDeLink,
  decifrarSegredoDeLink,
  gerarSegredoDeLink,
  hashDoSegredoDeLink,
  montarLinkDeAcompanhamento,
} from '../demandas/link.js';

export interface OpcoesDoAcompanhamento {
  readonly conexao: Conexao;
  readonly agora: () => Date;
  readonly segredoDaAplicacao: string;
  readonly hostnamePublico: string;
}

/**
 * O lado da equipe do acompanhamento do cidadão: o link (obter, revogar, regenerar, suspender,
 * retomar), a pré-visualização (a MESMA projeção do cidadão) e os andamentos publicáveis.
 * Nenhuma operação aqui publica comentário interno, documento ou dado de outro módulo (RN-PUB-08).
 */
export class ServicoDeAcompanhamento {
  constructor(private readonly o: OpcoesDoAcompanhamento) {}

  private get bd(): BancoDeDados {
    return this.o.conexao.bd;
  }

  async obter(ator: Ator, demandaId: number): Promise<AcompanhamentoInterno> {
    const linha = await carregarDemandaAlcancavel(this.bd, ator, demandaId);
    const linhasDeAndamento = await this.bd
      .select()
      .from(andamentoPublicado)
      .where(eq(andamentoPublicado.demandaId, demandaId))
      .orderBy(desc(andamentoPublicado.id));
    const idsDeUsuarios = [
      ...new Set(
        linhasDeAndamento.flatMap((a) => [a.autorId, ...(a.removidoPor ? [a.removidoPor] : [])]),
      ),
    ];
    const nomes = new Map(
      idsDeUsuarios.length === 0
        ? []
        : (
            await this.bd
              .select({ id: usuario.id, nome: usuario.nome })
              .from(usuario)
              .where(inArray(usuario.id, idsDeUsuarios))
          ).map((u) => [u.id, u.nome] as const),
    );

    const [p] = await this.bd.select().from(pessoa).where(eq(pessoa.id, linha.solicitanteId));
    let notificacao: NotificacaoDaPessoa | null = null;
    if (p) {
      const [ultimo] = await this.bd
        .select()
        .from(consentimentoNotificacao)
        .where(eq(consentimentoNotificacao.pessoaId, p.id))
        .orderBy(desc(consentimentoNotificacao.id))
        .limit(1);
      notificacao = {
        pessoaId: p.id,
        temEmail: !!p.email,
        emailInvalido: p.emailInvalido,
        consentimento: await consentimentoVigente(this.bd, p.id),
        registradoEm: ultimo?.registradoEm.toISOString() ?? null,
        origem: ultimo?.origem ?? null,
      };
    }

    return {
      estado: linha.publicacaoLink === 'expirada' ? 'ativa' : linha.publicacaoLink,
      link:
        linha.publicacaoLink === 'revogada'
          ? null
          : montarLinkDeAcompanhamento(
              this.o.hostnamePublico,
              decifrarSegredoDeLink(linha.segredoLinkCifrado, this.o.segredoDaAplicacao),
            ),
      previa: await lerAcompanhamento(this.o.conexao.cliente, { protocolo: linha.protocolo }),
      andamentos: linhasDeAndamento.map((a): AndamentoDto => ({
        id: a.id,
        texto: a.texto,
        autor: nomes.get(a.autorId) ?? '',
        publicadoEm: a.publicadoEm.toISOString(),
        removido: a.situacao === 'removido',
        removidoPor: a.removidoPor ? (nomes.get(a.removidoPor) ?? null) : null,
        removidoEm: a.removidoEm?.toISOString() ?? null,
      })),
      notificacao,
    };
  }

  // -------------------------------------------------------------------------
  // Link
  // -------------------------------------------------------------------------

  /** Revogar apaga o segredo, sem volta; a consulta por protocolo segue de pé (RN-PUB-05). */
  async revogar(ator: Ator, id: number): Promise<AcompanhamentoInterno> {
    await this.bd.transaction(async (tx) => {
      const atual = await carregarDemandaAlcancavel(tx, ator, id, { paraAtualizar: true });
      if (atual.publicacaoLink === 'revogada') throw erros.conflito('O link já foi revogado.');
      await tx
        .update(demanda)
        .set({
          publicacaoLink: 'revogada',
          // O segredo some: no lugar fica um hash de um valor que ninguém conhece.
          segredoLinkHash: hashDoSegredoDeLink(gerarSegredoDeLink()),
          segredoLinkCifrado: 'revogado',
        })
        .where(eq(demanda.id, id));
      await registrarTrilha(tx, {
        origem: 'usuario',
        autorId: ator.usuarioId,
        operacao: 'link.revogar',
        entidade: 'demanda',
        registroId: id,
        valorAnterior: { estado: atual.publicacaoLink },
        valorNovo: { estado: 'revogada' },
      });
    });
    return this.obter(ator, id);
  }

  /** Um segredo novo; o antigo deixa de valer. Reabre o link, qualquer que fosse o estado. */
  async regenerar(ator: Ator, id: number): Promise<AcompanhamentoInterno> {
    const segredo = gerarSegredoDeLink();
    await this.bd.transaction(async (tx) => {
      const atual = await carregarDemandaAlcancavel(tx, ator, id, { paraAtualizar: true });
      await tx
        .update(demanda)
        .set({
          publicacaoLink: 'ativa',
          segredoLinkHash: hashDoSegredoDeLink(segredo),
          segredoLinkCifrado: cifrarSegredoDeLink(segredo, this.o.segredoDaAplicacao),
        })
        .where(eq(demanda.id, id));
      // O segredo NUNCA entra na trilha.
      await registrarTrilha(tx, {
        origem: 'usuario',
        autorId: ator.usuarioId,
        operacao: 'link.regenerar',
        entidade: 'demanda',
        registroId: id,
        valorAnterior: { estado: atual.publicacaoLink },
        valorNovo: { estado: 'ativa' },
      });
    });
    return this.obter(ator, id);
  }

  /** Suspender fecha as duas vias públicas, reversível, mesmo link (RN-PUB-06). */
  async suspender(ator: Ator, id: number): Promise<AcompanhamentoInterno> {
    await this.mudarEstado(ator, id, 'suspensa', 'link.suspender', (atual) => {
      if (atual !== 'ativa') throw erros.conflito('Só um link ativo pode ser suspenso.');
    });
    return this.obter(ator, id);
  }

  async retomar(ator: Ator, id: number): Promise<AcompanhamentoInterno> {
    await this.mudarEstado(ator, id, 'ativa', 'link.retomar', (atual) => {
      if (atual !== 'suspensa') throw erros.conflito('Só um link suspenso pode ser retomado.');
    });
    return this.obter(ator, id);
  }

  private async mudarEstado(
    ator: Ator,
    id: number,
    novo: 'ativa' | 'suspensa',
    operacao: string,
    exigir: (atual: string) => void,
  ): Promise<void> {
    await this.bd.transaction(async (tx) => {
      const atual = await carregarDemandaAlcancavel(tx, ator, id, { paraAtualizar: true });
      exigir(atual.publicacaoLink);
      await tx.update(demanda).set({ publicacaoLink: novo }).where(eq(demanda.id, id));
      await registrarTrilha(tx, {
        origem: 'usuario',
        autorId: ator.usuarioId,
        operacao,
        entidade: 'demanda',
        registroId: id,
        valorAnterior: { estado: atual.publicacaoLink },
        valorNovo: { estado: novo },
      });
    });
  }

  // -------------------------------------------------------------------------
  // Andamentos publicáveis
  // -------------------------------------------------------------------------

  async publicar(
    ator: Ator,
    demandaId: number,
    dados: CorpoNovoAndamento,
  ): Promise<AndamentoDto[]> {
    await this.bd.transaction(async (tx) => {
      const alvo = await carregarDemandaAlcancavel(tx, ator, demandaId, { paraAtualizar: true });
      exigirDemandaAberta(alvo);
      const publicadoEm = this.o.agora();
      const [criado] = await tx
        .insert(andamentoPublicado)
        .values({ demandaId, texto: dados.texto, autorId: ator.usuarioId, publicadoEm })
        .returning({ id: andamentoPublicado.id });
      const andamentoId = (criado as { id: number }).id;
      // A trilha guarda o texto: ao remover, some da página mas a linha e o texto ficam (RN-PUB-07).
      await registrarTrilha(tx, {
        origem: 'usuario',
        autorId: ator.usuarioId,
        operacao: 'andamento.publicar',
        entidade: 'demanda',
        registroId: demandaId,
        valorNovo: { andamentoId, texto: dados.texto },
      });
      await enfileirarNotificacao(tx, {
        demandaId,
        evento: 'andamento_publicado',
        payload: { texto: dados.texto },
        criadoEm: publicadoEm,
      });
    });
    return (await this.obter(ator, demandaId)).andamentos as AndamentoDto[];
  }

  async removerAndamento(ator: Ator, andamentoId: number): Promise<AndamentoDto[]> {
    const [andamento] = await this.bd
      .select()
      .from(andamentoPublicado)
      .where(eq(andamentoPublicado.id, andamentoId))
      .limit(1);
    if (!andamento) throw erros.naoEncontrado();
    await carregarDemandaAlcancavel(this.bd, ator, andamento.demandaId);
    if (andamento.situacao === 'removido') throw erros.conflito('O andamento já foi removido.');

    await this.bd.transaction(async (tx) => {
      await tx
        .update(andamentoPublicado)
        .set({ situacao: 'removido', removidoPor: ator.usuarioId, removidoEm: this.o.agora() })
        .where(eq(andamentoPublicado.id, andamentoId));
      await registrarTrilha(tx, {
        origem: 'usuario',
        autorId: ator.usuarioId,
        operacao: 'andamento.remover',
        entidade: 'demanda',
        registroId: andamento.demandaId,
        valorNovo: { andamentoId, texto: andamento.texto },
      });
    });
    return (await this.obter(ator, andamento.demandaId)).andamentos as AndamentoDto[];
  }
}
