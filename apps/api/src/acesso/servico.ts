import {
  conferirSenha,
  contaAcesso,
  gerarVerificador,
  registrarTrilha,
  senhaInicial,
  usuario,
  type BancoDeDados,
} from '@gabinete/banco';
import type { CorpoTrocarSenha } from '@gabinete/compartilhado';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { erros } from '../erros.js';
import { atrasoDaFalha, ContadorDeFalhas } from './limitador.js';
import { problemasDaSenha } from './politica-de-senha.js';
import {
  buscarSessao,
  criarSessao,
  encerrarSessao,
  encerrarSessoesDoUsuario,
  type DadosDaSessao,
} from './sessoes.js';
import { hashDaOrigem, hashDoTicket } from './tickets.js';

/** Bloqueio: 5 tentativas erradas bloqueiam a conta por 15 minutos (RN-ACE-02). */
export const tentativasAteBloquear = 5;
export const duracaoDoBloqueioEmMs = 15 * 60_000;

export interface OpcoesDoServico {
  readonly bd: BancoDeDados;
  readonly segredo: string;
  readonly agora: () => Date;
  readonly dormir: (ms: number) => Promise<void>;
}

export interface Entrada {
  readonly email: string;
  readonly senha: string;
  /** IP de quem chama. Só o hash é usado. */
  readonly origem: string;
}

export interface Entrou {
  readonly ticket: string;
  readonly sessao: DadosDaSessao;
}

export class ServicoDeAcesso {
  private readonly falhas: ContadorDeFalhas;
  /** Verificador de uma senha que ninguém tem: faz o mesmo trabalho quando o e-mail não existe. */
  private verificadorFalso: Promise<string> | undefined;

  constructor(private readonly opcoes: OpcoesDoServico) {
    this.falhas = new ContadorDeFalhas(opcoes.agora);
  }

  private get bd() {
    return this.opcoes.bd;
  }

  private async obterVerificadorFalso(): Promise<string> {
    this.verificadorFalso ??= gerarVerificador(`falso-${Math.random()}-${Date.now()}`);
    return this.verificadorFalso;
  }

  async entrar(entrada: Entrada): Promise<Entrou> {
    const agora = this.opcoes.agora();
    const email = entrada.email.trim().toLowerCase();
    const origem = hashDaOrigem(entrada.origem, this.opcoes.segredo);

    const [conta] = await this.bd
      .select({
        contaId: contaAcesso.id,
        verificador: contaAcesso.verificadorSenha,
        bloqueadaAte: contaAcesso.bloqueadaAte,
        tentativas: contaAcesso.tentativasFalhas,
        usuarioId: usuario.id,
        situacao: usuario.situacao,
        perfil: usuario.perfil,
        nome: usuario.nome,
        troca: contaAcesso.senhaTrocaObrigatoria,
      })
      .from(contaAcesso)
      .innerJoin(usuario, eq(usuario.contaId, contaAcesso.id))
      .where(eq(contaAcesso.email, email))
      .limit(1);

    const bloqueadaAte = conta?.bloqueadaAte ?? null;
    const bloqueada = bloqueadaAte !== null && bloqueadaAte.getTime() > agora.getTime();
    // Sempre há uma verificação de senha, existindo a conta ou não: o tempo não revela nada.
    const alvo = conta && !bloqueada ? conta.verificador : await this.obterVerificadorFalso();
    const senhaCorreta = await conferirSenha(alvo, entrada.senha);

    if (!conta || bloqueada || !senhaCorreta || conta.situacao !== 'ativo') {
      if (conta && !bloqueada && !senhaCorreta) {
        await this.registrarFalhaDaConta(conta.contaId, conta.usuarioId, agora);
      }
      const falhas = this.falhas.registrarFalha(origem);
      await this.opcoes.dormir(atrasoDaFalha(falhas));
      throw erros.credenciaisInvalidas();
    }

    const [inicial] = await this.bd
      .select({ expiraEm: senhaInicial.expiraEm })
      .from(senhaInicial)
      .where(and(eq(senhaInicial.usuarioId, conta.usuarioId), isNull(senhaInicial.usadaEm)))
      .limit(1);
    if (inicial && inicial.expiraEm.getTime() <= agora.getTime()) {
      await registrarTrilha(this.bd, {
        origem: 'usuario',
        autorId: conta.usuarioId,
        operacao: 'acesso.senha_inicial_vencida',
        entidade: 'usuario',
        registroId: conta.usuarioId,
      });
      throw erros.senhaInicialVencida();
    }

    const criada = await this.bd.transaction(async (tx) => {
      if (conta.tentativas > 0) {
        await tx
          .update(contaAcesso)
          .set({ tentativasFalhas: 0, bloqueadaAte: null })
          .where(eq(contaAcesso.id, conta.contaId));
      }
      const nova = await criarSessao(tx, {
        usuarioId: conta.usuarioId,
        perfil: conta.perfil,
        agora,
        segredo: this.opcoes.segredo,
      });
      await registrarTrilha(tx, {
        origem: 'usuario',
        autorId: conta.usuarioId,
        operacao: 'acesso.entrada',
        entidade: 'usuario',
        registroId: conta.usuarioId,
      });
      return nova;
    });
    this.falhas.limpar(origem);

    return {
      ticket: criada.ticket,
      sessao: {
        ticketHash: hashDoTicket(criada.ticket, this.opcoes.segredo),
        usuarioId: conta.usuarioId,
        contaId: conta.contaId,
        nome: conta.nome,
        email,
        perfil: conta.perfil,
        habilitacoes: criada.habilitacoes,
        senhaTrocaObrigatoria: conta.troca,
        expiraEm: criada.expiraEm,
      },
    };
  }

  buscarSessao(ticket: string): Promise<DadosDaSessao | null> {
    return buscarSessao(this.bd, ticket, {
      agora: this.opcoes.agora(),
      segredo: this.opcoes.segredo,
    });
  }

  async sair(sessao: DadosDaSessao): Promise<void> {
    await encerrarSessao(this.bd, sessao.ticketHash);
  }

  async trocarSenha(sessao: DadosDaSessao, entrada: CorpoTrocarSenha): Promise<void> {
    const agora = this.opcoes.agora();

    const [conta] = await this.bd
      .select({ verificador: contaAcesso.verificadorSenha })
      .from(contaAcesso)
      .where(eq(contaAcesso.id, sessao.contaId))
      .limit(1);
    if (!conta) throw erros.naoAutenticado();

    // Quem tem uma sessão roubada não pode adivinhar a senha atual sem limite: cada erro conta
    // para o bloqueio da conta, como no login.
    if (!(await conferirSenha(conta.verificador, entrada.senhaAtual))) {
      await this.registrarFalhaDaConta(sessao.contaId, sessao.usuarioId, agora);
      throw erros.senhaAtualIncorreta();
    }

    const problemas = problemasDaSenha(entrada.novaSenha, {
      email: sessao.email,
      senhaAtual: entrada.senhaAtual,
    });
    if (problemas.length > 0) throw erros.senhaFraca(problemas);

    const novoVerificador = await gerarVerificador(entrada.novaSenha);

    await this.bd.transaction(async (tx) => {
      await tx
        .update(contaAcesso)
        .set({
          verificadorSenha: novoVerificador,
          senhaTrocaObrigatoria: false,
          tentativasFalhas: 0,
          bloqueadaAte: null,
        })
        .where(eq(contaAcesso.id, sessao.contaId));
      await tx
        .update(senhaInicial)
        .set({ usadaEm: agora })
        .where(and(eq(senhaInicial.usuarioId, sessao.usuarioId), isNull(senhaInicial.usadaEm)));
      await encerrarSessoesDoUsuario(tx, sessao.usuarioId, { exceto: sessao.ticketHash });
      await registrarTrilha(tx, {
        origem: 'usuario',
        autorId: sessao.usuarioId,
        operacao: 'acesso.senha_trocada',
        entidade: 'usuario',
        registroId: sessao.usuarioId,
      });
    });
  }

  /** Conta uma falha de forma atômica e bloqueia a conta ao chegar a 5 (RN-ACE-02). */
  private async registrarFalhaDaConta(
    contaId: number,
    usuarioId: number,
    agora: Date,
  ): Promise<void> {
    await this.bd.transaction(async (tx) => {
      const [atualizada] = await tx
        .update(contaAcesso)
        .set({ tentativasFalhas: sql`${contaAcesso.tentativasFalhas} + 1` })
        .where(eq(contaAcesso.id, contaId))
        .returning({ tentativas: contaAcesso.tentativasFalhas });

      const bloquear = (atualizada?.tentativas ?? 0) >= tentativasAteBloquear;
      if (bloquear) {
        const ate = new Date(agora.getTime() + duracaoDoBloqueioEmMs);
        await tx
          .update(contaAcesso)
          .set({ tentativasFalhas: 0, bloqueadaAte: ate })
          .where(eq(contaAcesso.id, contaId));
        await encerrarSessoesDoUsuario(tx, usuarioId);
      }
      await registrarTrilha(tx, {
        origem: 'usuario',
        autorId: usuarioId,
        operacao: bloquear ? 'acesso.bloqueio' : 'acesso.falha',
        entidade: 'conta_acesso',
        registroId: contaId,
        valorNovo: bloquear
          ? { bloqueadaPorMinutos: duracaoDoBloqueioEmMs / 60_000 }
          : { tentativas: atualizada?.tentativas },
      });
    });
  }
}
