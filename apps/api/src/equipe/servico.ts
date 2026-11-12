import {
  contaAcesso,
  gerarSenhaInicial,
  gerarVerificador,
  habilitacao,
  registrarTrilha,
  senhaInicial,
  trilha,
  usuario,
  type BancoDeDados,
  type Transacao,
} from '@gabinete/banco';
import type {
  Area,
  CorpoAtualizarUsuario,
  CorpoNovoUsuario,
  Perfil,
  SituacaoDeUsuario,
  UsuarioComSenhaInicial,
  UsuarioDaEquipe,
} from '@gabinete/compartilhado';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { encerrarSessoesDoUsuario } from '../acesso/sessoes.js';
import { mensagemDoPostgres, restricaoViolada, violouUnicidade } from '../banco-util.js';
import { erros } from '../erros.js';
import {
  exigirOutroUsuario,
  exigirPodeAtribuir,
  exigirPodeGerir,
  habilitacoesParaGravar,
  type Ator,
} from './regras.js';

const validadeDaSenhaInicialEmHoras = 72;

type Linha = {
  id: number;
  nome: string;
  email: string;
  contato: string | null;
  perfil: Perfil;
  situacao: SituacaoDeUsuario;
  fotoChave: string | null;
  criadoEm: Date;
};

export class ServicoDeEquipe {
  constructor(
    private readonly bd: BancoDeDados,
    private readonly agora: () => Date,
  ) {}

  private selecionar() {
    return this.bd
      .select({
        id: usuario.id,
        nome: usuario.nome,
        email: contaAcesso.email,
        contato: usuario.contato,
        perfil: usuario.perfil,
        situacao: usuario.situacao,
        fotoChave: usuario.fotoChave,
        criadoEm: usuario.criadoEm,
      })
      .from(usuario)
      .innerJoin(contaAcesso, eq(contaAcesso.id, usuario.contaId));
  }

  private async montar(linhas: Linha[]): Promise<UsuarioDaEquipe[]> {
    const ids = linhas.map((l) => l.id);
    const concedidas = ids.length
      ? await this.bd
          .select({ usuarioId: habilitacao.usuarioId, area: habilitacao.area })
          .from(habilitacao)
          .where(inArray(habilitacao.usuarioId, ids))
      : [];
    return linhas.map((l) => ({
      id: l.id,
      nome: l.nome,
      email: l.email,
      contato: l.contato,
      perfil: l.perfil,
      situacao: l.situacao,
      habilitacoes: concedidas
        .filter((c) => c.usuarioId === l.id)
        .map((c) => c.area)
        .sort(),
      temFoto: l.fotoChave !== null,
      criadoEm: l.criadoEm.toISOString(),
    }));
  }

  async listar(): Promise<UsuarioDaEquipe[]> {
    return this.montar(await this.selecionar().orderBy(usuario.nome));
  }

  async obter(id: number): Promise<UsuarioDaEquipe> {
    const [linha] = await this.selecionar().where(eq(usuario.id, id)).limit(1);
    if (!linha) throw erros.naoEncontrado();
    const [montado] = await this.montar([linha]);
    return montado as UsuarioDaEquipe;
  }

  async chaveDaFoto(id: number): Promise<string | null> {
    const [linha] = await this.bd
      .select({ fotoChave: usuario.fotoChave })
      .from(usuario)
      .where(eq(usuario.id, id))
      .limit(1);
    if (!linha) throw erros.naoEncontrado();
    return linha.fotoChave;
  }

  async criar(ator: Ator, dados: CorpoNovoUsuario): Promise<UsuarioComSenhaInicial> {
    exigirPodeAtribuir(ator, dados.perfil);
    const concedidas = habilitacoesParaGravar(ator, dados.perfil, dados.habilitacoes);
    const senha = gerarSenhaInicial();
    const verificador = await gerarVerificador(senha);
    const validaAte = new Date(this.agora().getTime() + validadeDaSenhaInicialEmHoras * 3_600_000);

    let criadoId: number;
    try {
      criadoId = await this.bd.transaction(async (tx) => {
        const [conta] = await tx
          .insert(contaAcesso)
          .values({
            email: dados.email,
            verificadorSenha: verificador,
            senhaTrocaObrigatoria: true,
          })
          .returning({ id: contaAcesso.id });
        const [novo] = await tx
          .insert(usuario)
          .values({
            contaId: conta!.id,
            nome: dados.nome,
            contato: dados.contato ?? null,
            perfil: dados.perfil,
          })
          .returning({ id: usuario.id });
        const id = novo!.id;
        if (concedidas.length > 0) {
          await tx
            .insert(habilitacao)
            .values(
              concedidas.map((area) => ({ usuarioId: id, area, concedidaPor: ator.usuarioId })),
            );
        }
        await tx.insert(senhaInicial).values({ usuarioId: id, expiraEm: validaAte });
        await registrarTrilha(tx, {
          origem: 'usuario',
          autorId: ator.usuarioId,
          operacao: 'equipe.criar',
          entidade: 'usuario',
          registroId: id,
          valorNovo: {
            email: dados.email,
            nome: dados.nome,
            perfil: dados.perfil,
            habilitacoes: concedidas,
          },
        });
        return id;
      });
    } catch (erro) {
      this.traduzir(erro);
    }

    return {
      ...(await this.obter(criadoId)),
      senhaInicial: senha,
      senhaInicialValidaAte: validaAte.toISOString(),
    };
  }

  async atualizar(ator: Ator, id: number, dados: CorpoAtualizarUsuario): Promise<UsuarioDaEquipe> {
    const antes = await this.obter(id);
    exigirPodeGerir(ator, antes.perfil);

    const mudancas: { nome?: string; contato?: string | null } = {};
    if (dados.nome !== undefined) mudancas.nome = dados.nome;
    if (dados.contato !== undefined) mudancas.contato = dados.contato;

    await this.bd.transaction(async (tx) => {
      await tx.update(usuario).set(mudancas).where(eq(usuario.id, id));
      await registrarTrilha(tx, {
        origem: 'usuario',
        autorId: ator.usuarioId,
        operacao: 'equipe.atualizar',
        entidade: 'usuario',
        registroId: id,
        valorAnterior: { nome: antes.nome, contato: antes.contato },
        valorNovo: mudancas,
      });
    });
    return this.obter(id);
  }

  async alterarPerfil(ator: Ator, id: number, perfil: Perfil): Promise<UsuarioDaEquipe> {
    exigirOutroUsuario(ator, id);
    const antes = await this.obter(id);
    exigirPodeGerir(ator, antes.perfil);
    exigirPodeAtribuir(ator, perfil);

    try {
      await this.bd.transaction(async (tx) => {
        await tx.update(usuario).set({ perfil }).where(eq(usuario.id, id));
        // Administrador e Parlamentar têm todas as habilitações, não removíveis.
        const todas = habilitacoesParaGravar(ator, perfil, []);
        if (perfil === 'administrador' || perfil === 'parlamentar') {
          await this.substituirHabilitacoes(tx, ator, id, todas);
        }
        await encerrarSessoesDoUsuario(tx, id);
        await registrarTrilha(tx, {
          origem: 'usuario',
          autorId: ator.usuarioId,
          operacao: 'equipe.alterar_perfil',
          entidade: 'usuario',
          registroId: id,
          valorAnterior: { perfil: antes.perfil },
          valorNovo: { perfil },
        });
      });
    } catch (erro) {
      this.traduzir(erro);
    }
    return this.obter(id);
  }

  async alterarSituacao(
    ator: Ator,
    id: number,
    situacao: SituacaoDeUsuario,
  ): Promise<UsuarioDaEquipe> {
    exigirOutroUsuario(ator, id);
    const antes = await this.obter(id);
    exigirPodeGerir(ator, antes.perfil);

    try {
      await this.bd.transaction(async (tx) => {
        await tx.update(usuario).set({ situacao }).where(eq(usuario.id, id));
        await encerrarSessoesDoUsuario(tx, id);
        await registrarTrilha(tx, {
          origem: 'usuario',
          autorId: ator.usuarioId,
          operacao: 'equipe.alterar_situacao',
          entidade: 'usuario',
          registroId: id,
          valorAnterior: { situacao: antes.situacao },
          valorNovo: { situacao },
        });
      });
    } catch (erro) {
      this.traduzir(erro);
    }
    return this.obter(id);
  }

  async alterarHabilitacoes(
    ator: Ator,
    id: number,
    pedidas: readonly Area[],
  ): Promise<UsuarioDaEquipe> {
    exigirOutroUsuario(ator, id);
    const antes = await this.obter(id);
    exigirPodeGerir(ator, antes.perfil);
    if (antes.perfil === 'administrador' || antes.perfil === 'parlamentar') {
      throw erros.semPermissao(
        'Administrador e Parlamentar têm todas as habilitações, que não podem ser removidas.',
      );
    }
    const novas = habilitacoesParaGravar(ator, antes.perfil, pedidas);

    await this.bd.transaction(async (tx) => {
      await this.substituirHabilitacoes(tx, ator, id, novas);
      await encerrarSessoesDoUsuario(tx, id);
      await registrarTrilha(tx, {
        origem: 'usuario',
        autorId: ator.usuarioId,
        operacao: 'equipe.alterar_habilitacoes',
        entidade: 'usuario',
        registroId: id,
        valorAnterior: { habilitacoes: antes.habilitacoes },
        valorNovo: { habilitacoes: [...novas].sort() },
      });
    });
    return this.obter(id);
  }

  /** Gera nova senha inicial: troca obrigatória, bloqueio zerado e sessões encerradas. */
  async redefinirSenha(ator: Ator, id: number): Promise<UsuarioComSenhaInicial> {
    exigirOutroUsuario(ator, id);
    const alvo = await this.obter(id);
    exigirPodeGerir(ator, alvo.perfil);

    const senha = gerarSenhaInicial();
    const verificador = await gerarVerificador(senha);
    const validaAte = new Date(this.agora().getTime() + validadeDaSenhaInicialEmHoras * 3_600_000);

    await this.bd.transaction(async (tx) => {
      const [conta] = await tx
        .select({ contaId: usuario.contaId })
        .from(usuario)
        .where(eq(usuario.id, id))
        .limit(1);
      await tx
        .update(contaAcesso)
        .set({
          verificadorSenha: verificador,
          senhaTrocaObrigatoria: true,
          tentativasFalhas: 0,
          bloqueadaAte: null,
        })
        .where(eq(contaAcesso.id, conta!.contaId));
      await tx
        .insert(senhaInicial)
        .values({ usuarioId: id, expiraEm: validaAte })
        .onConflictDoUpdate({
          target: senhaInicial.usuarioId,
          set: { expiraEm: validaAte, usadaEm: null },
        });
      await encerrarSessoesDoUsuario(tx, id);
      await registrarTrilha(tx, {
        origem: 'usuario',
        autorId: ator.usuarioId,
        operacao: 'equipe.redefinir_senha',
        entidade: 'usuario',
        registroId: id,
      });
    });

    return { ...alvo, senhaInicial: senha, senhaInicialValidaAte: validaAte.toISOString() };
  }

  async registrarFoto(ator: Ator, id: number, chaveNova: string, chaveAnterior: string | null) {
    await this.bd.transaction(async (tx) => {
      await tx.update(usuario).set({ fotoChave: chaveNova }).where(eq(usuario.id, id));
      await registrarTrilha(tx, {
        origem: 'usuario',
        autorId: ator.usuarioId,
        operacao: 'usuario.alterar_foto',
        entidade: 'usuario',
        registroId: id,
        valorAnterior: { temFoto: chaveAnterior !== null },
        valorNovo: { temFoto: true },
      });
    });
  }

  async historico(id: number) {
    await this.obter(id);
    const linhas = await this.bd
      .select()
      .from(trilha)
      .where(and(eq(trilha.entidade, 'usuario'), eq(trilha.registroId, String(id))))
      .orderBy(desc(trilha.id))
      .limit(200);
    return linhas.map((l) => ({
      id: l.id,
      ocorridaEm: l.ocorridaEm.toISOString(),
      autorId: l.autorId,
      operacao: l.operacao,
      valorAnterior: l.valorAnterior,
      valorNovo: l.valorNovo,
    }));
  }

  private async substituirHabilitacoes(
    tx: Transacao,
    ator: Ator,
    id: number,
    novas: readonly Area[],
  ): Promise<void> {
    await tx.delete(habilitacao).where(eq(habilitacao.usuarioId, id));
    if (novas.length > 0) {
      await tx
        .insert(habilitacao)
        .values(novas.map((area) => ({ usuarioId: id, area, concedidaPor: ator.usuarioId })));
    }
  }

  /** Traduz violações do banco em erros que o usuário entende. */
  private traduzir(erro: unknown): never {
    if (violouUnicidade(erro)) {
      const restricao = restricaoViolada(erro) ?? '';
      if (restricao.includes('parlamentar')) {
        throw erros.conflito('Já existe um usuário ativo com o perfil Parlamentar.');
      }
      throw erros.conflito('Já existe um usuário com esse e-mail.');
    }
    if (mensagemDoPostgres(erro).includes('sem um administrador')) {
      throw erros.conflito('O sistema não pode ficar sem um administrador ativo.');
    }
    throw erro;
  }
}
