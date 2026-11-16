import { pode } from '@gabinete/autorizacao';
import {
  evento,
  participacaoEvento,
  pessoa,
  registrarTrilha,
  type BancoDeDados,
  type Transacao,
} from '@gabinete/banco';
import type {
  CorpoAtualizarEvento,
  CorpoCorrigirPresenca,
  CorpoNovoEvento,
  CorpoRegistrarPresenca,
  EventoFicha,
  PresencaRegistrada,
} from '@gabinete/compartilhado';
import { and, eq } from 'drizzle-orm';
import { mensagemDoPostgres, violouUnicidade } from '../banco-util.js';
import type { Ator } from '../equipe/regras.js';
import { erros } from '../erros.js';
import { presencaCorrigivel, type ConsultasDeEventos } from './consultas.js';

export interface OpcoesDoServicoDeEventos {
  readonly bd: BancoDeDados;
  readonly consultas: ConsultasDeEventos;
  readonly agora: () => Date;
}

const evento404 = () => erros.naoEncontrado();

export class ServicoDeEventos {
  constructor(private readonly o: OpcoesDoServicoDeEventos) {}

  private get bd() {
    return this.o.bd;
  }

  async criar(ator: Ator, dados: CorpoNovoEvento): Promise<EventoFicha> {
    const id = await this.bd.transaction(async (tx) => {
      const [criado] = await tx
        .insert(evento)
        .values({
          criadorId: ator.usuarioId,
          nome: dados.nome,
          inicio: new Date(dados.inicio),
          local: dados.local ?? null,
          criadoEm: this.o.agora(),
        })
        .returning({ id: evento.id });
      const novoId = (criado as { id: number }).id;
      await registrarTrilha(tx, {
        origem: 'usuario',
        autorId: ator.usuarioId,
        operacao: 'evento.criar',
        entidade: 'evento',
        registroId: novoId,
        valorNovo: { inicio: dados.inicio },
      });
      return novoId;
    });
    return this.o.consultas.ficha(ator, id);
  }

  private async carregar(tx: Transacao, id: number) {
    const [linha] = await tx.select().from(evento).where(eq(evento.id, id)).limit(1).for('update');
    if (!linha) throw evento404();
    return linha;
  }

  private exigirAberto(situacao: 'aberto' | 'encerrado'): void {
    if (situacao === 'encerrado') {
      throw erros.conflito('Evento encerrado: não se altera nem se registra presença.');
    }
  }

  async editar(ator: Ator, id: number, dados: CorpoAtualizarEvento): Promise<EventoFicha> {
    await this.bd.transaction(async (tx) => {
      const atual = await this.carregar(tx, id);
      this.exigirAberto(atual.situacao);
      const mudancas: Partial<typeof evento.$inferInsert> = {};
      if (dados.nome !== undefined) mudancas.nome = dados.nome;
      if (dados.inicio !== undefined) mudancas.inicio = new Date(dados.inicio);
      if (dados.local !== undefined) mudancas.local = dados.local;
      await tx.update(evento).set(mudancas).where(eq(evento.id, id));
      await registrarTrilha(tx, {
        origem: 'usuario',
        autorId: ator.usuarioId,
        operacao: 'evento.editar',
        entidade: 'evento',
        registroId: id,
        valorAnterior: { inicio: atual.inicio.toISOString() },
        valorNovo: { inicio: dados.inicio ?? atual.inicio.toISOString() },
      });
    });
    return this.o.consultas.ficha(ator, id);
  }

  /** Encerrar é decisão de alguém (Supervisor ou superior): evento passado não se encerra sozinho (RN-EVE-01). */
  async encerrar(ator: Ator, id: number): Promise<EventoFicha> {
    await this.bd.transaction(async (tx) => {
      const atual = await this.carregar(tx, id);
      this.exigirAberto(atual.situacao);
      await tx
        .update(evento)
        .set({ situacao: 'encerrado', encerradoEm: this.o.agora(), encerradoPor: ator.usuarioId })
        .where(eq(evento.id, id));
      await registrarTrilha(tx, {
        origem: 'usuario',
        autorId: ator.usuarioId,
        operacao: 'evento.encerrar',
        entidade: 'evento',
        registroId: id,
      });
    });
    return this.o.consultas.ficha(ator, id);
  }

  /**
   * A pessoa pelo telefone. Se não estiver cadastrada, o nome cria o cadastro no ato (RN-EVE-02).
   * Sem o nome, devolve o pedido dele (409 com o detalhe `nome`), para a tela perguntar.
   */
  private async pessoaPorTelefone(
    tx: Transacao,
    ator: Ator,
    telefone: string,
    nome: string | undefined,
  ): Promise<{ id: number; criada: boolean }> {
    const [existente] = await tx
      .select({ id: pessoa.id })
      .from(pessoa)
      .where(and(eq(pessoa.telefoneNormalizado, telefone), eq(pessoa.situacao, 'ativa')))
      .limit(1);
    if (existente) return { id: existente.id, criada: false };
    if (!nome) throw erros.conflito('Pessoa não cadastrada: informe o nome.', ['nome']);
    const [criada] = await tx
      .insert(pessoa)
      .values({ nomeCompleto: nome, telefoneNormalizado: telefone, criadoPor: ator.usuarioId })
      .returning({ id: pessoa.id });
    const id = (criada as { id: number }).id;
    await registrarTrilha(tx, {
      origem: 'usuario',
      autorId: ator.usuarioId,
      operacao: 'pessoa.criar',
      entidade: 'pessoa',
      registroId: id,
    });
    return { id, criada: true };
  }

  async registrarPresenca(
    ator: Ator,
    eventoId: number,
    dados: CorpoRegistrarPresenca,
  ): Promise<PresencaRegistrada> {
    let pessoaCriada = false;
    try {
      await this.bd.transaction(async (tx) => {
        const atual = await this.carregar(tx, eventoId);
        this.exigirAberto(atual.situacao);
        const alvo = await this.pessoaPorTelefone(tx, ator, dados.telefone, dados.nome);
        pessoaCriada = alvo.criada;
        await tx.insert(participacaoEvento).values({
          eventoId,
          pessoaId: alvo.id,
          registradoPor: ator.usuarioId,
          registradoEm: this.o.agora(),
          observacao: dados.observacao ?? null,
        });
        await registrarTrilha(tx, {
          origem: 'usuario',
          autorId: ator.usuarioId,
          operacao: 'presenca.registrar',
          entidade: 'evento',
          registroId: eventoId,
          valorNovo: { pessoaId: alvo.id },
        });
      });
    } catch (erro) {
      this.traduzir(erro);
    }
    return { evento: await this.o.consultas.ficha(ator, eventoId), pessoaCriada };
  }

  /**
   * Corrige a presença: quem registrou, em até 30 minutos; depois, Assessor Interno ou superior
   * (RN-EVE-03). Quem não pode vê-la recebe "não encontrada".
   */
  async corrigirPresenca(
    ator: Ator,
    eventoId: number,
    pessoaId: number,
    dados: CorpoCorrigirPresenca,
  ): Promise<EventoFicha> {
    try {
      await this.bd.transaction(async (tx) => {
        const atual = await this.carregar(tx, eventoId);
        const [presenca] = await tx
          .select()
          .from(participacaoEvento)
          .where(
            and(
              eq(participacaoEvento.eventoId, eventoId),
              eq(participacaoEvento.pessoaId, pessoaId),
            ),
          )
          .limit(1);
        if (!presenca) throw erros.naoEncontrado();
        const veTudo = pode('eventos.lista_nominal', {
          perfil: ator.perfil,
          habilitacoes: ator.habilitacoes,
        });
        if (!veTudo && presenca.registradoPor !== ator.usuarioId) throw erros.naoEncontrado();
        this.exigirAberto(atual.situacao);
        if (!presencaCorrigivel(ator, presenca, this.o.agora())) {
          throw erros.semPermissao(
            'A correção passou de 30 minutos: peça a um Assessor Interno ou superior.',
          );
        }

        let novaPessoaId = pessoaId;
        if (dados.telefone) {
          novaPessoaId = (await this.pessoaPorTelefone(tx, ator, dados.telefone, dados.nome)).id;
        }
        const mudancas: Partial<typeof participacaoEvento.$inferInsert> = {};
        if (dados.observacao !== undefined) mudancas.observacao = dados.observacao;
        if (novaPessoaId !== pessoaId) mudancas.pessoaId = novaPessoaId;
        await tx
          .update(participacaoEvento)
          .set(mudancas)
          .where(
            and(
              eq(participacaoEvento.eventoId, eventoId),
              eq(participacaoEvento.pessoaId, pessoaId),
            ),
          );
        await registrarTrilha(tx, {
          origem: 'usuario',
          autorId: ator.usuarioId,
          operacao: 'presenca.corrigir',
          entidade: 'evento',
          registroId: eventoId,
          valorAnterior: { pessoaId },
          valorNovo: { pessoaId: novaPessoaId },
        });
      });
    } catch (erro) {
      this.traduzir(erro);
    }
    return this.o.consultas.ficha(ator, eventoId);
  }

  /** Remover apaga a linha e deixa o motivo na trilha (RN-EVE-03). Exige Supervisor (a operação). */
  async removerPresenca(
    ator: Ator,
    eventoId: number,
    pessoaId: number,
    justificativa: string,
  ): Promise<EventoFicha> {
    try {
      await this.bd.transaction(async (tx) => {
        const atual = await this.carregar(tx, eventoId);
        this.exigirAberto(atual.situacao);
        const apagadas = await tx
          .delete(participacaoEvento)
          .where(
            and(
              eq(participacaoEvento.eventoId, eventoId),
              eq(participacaoEvento.pessoaId, pessoaId),
            ),
          )
          .returning({ pessoaId: participacaoEvento.pessoaId });
        if (apagadas.length === 0) throw erros.naoEncontrado();
        await registrarTrilha(tx, {
          origem: 'usuario',
          autorId: ator.usuarioId,
          operacao: 'presenca.remover',
          entidade: 'evento',
          registroId: eventoId,
          valorAnterior: { pessoaId },
          justificativa,
        });
      });
    } catch (erro) {
      this.traduzir(erro);
    }
    return this.o.consultas.ficha(ator, eventoId);
  }

  private traduzir(erro: unknown): never {
    if (violouUnicidade(erro)) throw erros.conflito('Esta pessoa já consta na lista de presença.');
    if (mensagemDoPostgres(erro).includes('evento encerrado')) {
      throw erros.conflito('Evento encerrado: não se altera nem se registra presença.');
    }
    throw erro;
  }
}
