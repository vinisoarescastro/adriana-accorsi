import { etapa, registrarTrilha, tipoProcesso, type BancoDeDados } from '@gabinete/banco';
import type {
  CorpoAjustarEtapa,
  CorpoNovaEtapa,
  EtapaDoFluxo,
  FluxoDeTrabalho,
} from '@gabinete/compartilhado';
import { asc, eq, max } from 'drizzle-orm';
import { codigoDoPostgres, mensagemDoPostgres, restricaoViolada } from '../banco-util.js';
import { erros } from '../erros.js';
import type { Ator } from '../equipe/regras.js';

type Linha = typeof etapa.$inferSelect;

const paraEtapa = (l: Linha): EtapaDoFluxo => ({
  id: l.id,
  nomeInterno: l.nomeInterno,
  ordem: l.ordem,
  papel: l.papel,
  rotuloPublico: l.rotuloPublico,
  visivelPublico: l.visivelPublico,
  prazoPadraoDias: l.prazoPadraoDias,
  situacao: l.situacao,
});

export class ServicoDeFluxos {
  constructor(private readonly bd: BancoDeDados) {}

  async listar(): Promise<FluxoDeTrabalho[]> {
    const tipos = await this.bd.select().from(tipoProcesso).orderBy(asc(tipoProcesso.id));
    const etapas = await this.bd.select().from(etapa).orderBy(asc(etapa.ordem), asc(etapa.id));
    return tipos.map((t) => ({
      tipo: t.tipo,
      nome: t.nome,
      etapas: etapas.filter((e) => e.tipoProcessoId === t.id).map(paraEtapa),
    }));
  }

  private async obterEtapa(id: number) {
    const [linha] = await this.bd
      .select({ etapa, tipo: tipoProcesso.tipo })
      .from(etapa)
      .innerJoin(tipoProcesso, eq(tipoProcesso.id, etapa.tipoProcessoId))
      .where(eq(etapa.id, id))
      .limit(1);
    if (!linha) throw erros.naoEncontrado();
    return linha;
  }

  /** Ajustar (Supervisor): nome, ordem, rótulo, visibilidade e prazo. O papel nunca muda. */
  async ajustar(ator: Ator, id: number, dados: CorpoAjustarEtapa): Promise<EtapaDoFluxo> {
    const { etapa: antes, tipo } = await this.obterEtapa(id);
    if (tipo !== 'demanda' && (dados.rotuloPublico || dados.visivelPublico)) {
      throw erros.requisicaoInvalida();
    }

    const mudancas: Partial<typeof etapa.$inferInsert> = {};
    if (dados.nomeInterno !== undefined) mudancas.nomeInterno = dados.nomeInterno;
    if (dados.ordem !== undefined) mudancas.ordem = dados.ordem;
    if (dados.rotuloPublico !== undefined) mudancas.rotuloPublico = dados.rotuloPublico;
    if (dados.visivelPublico !== undefined) mudancas.visivelPublico = dados.visivelPublico;
    if (dados.prazoPadraoDias !== undefined) mudancas.prazoPadraoDias = dados.prazoPadraoDias;

    try {
      const [depois] = await this.bd.transaction(async (tx) => {
        const salvo = await tx.update(etapa).set(mudancas).where(eq(etapa.id, id)).returning();
        await registrarTrilha(tx, {
          origem: 'usuario',
          autorId: ator.usuarioId,
          operacao: 'fluxo.ajustar_etapa',
          entidade: 'etapa',
          registroId: id,
          valorAnterior: paraEtapa(antes),
          valorNovo: mudancas,
        });
        return salvo;
      });
      return paraEtapa(depois as Linha);
    } catch (erro) {
      this.traduzir(erro);
    }
  }

  /** Estruturar (Administrador): criar etapa Intermediária ou de Conclusão. */
  async criar(ator: Ator, tipo: string, dados: CorpoNovaEtapa): Promise<EtapaDoFluxo> {
    const [fluxo] = await this.bd
      .select()
      .from(tipoProcesso)
      .where(eq(tipoProcesso.tipo, tipo as never))
      .limit(1);
    if (!fluxo) throw erros.naoEncontrado();
    if (fluxo.tipo !== 'demanda' && (dados.rotuloPublico || dados.visivelPublico)) {
      throw erros.requisicaoInvalida();
    }

    try {
      const criada = await this.bd.transaction(async (tx) => {
        const [maior] = await tx
          .select({ ordem: max(etapa.ordem) })
          .from(etapa)
          .where(eq(etapa.tipoProcessoId, fluxo.id));
        const [nova] = await tx
          .insert(etapa)
          .values({
            tipoProcessoId: fluxo.id,
            nomeInterno: dados.nomeInterno,
            ordem: dados.ordem ?? (maior?.ordem ?? 0) + 1,
            papel: dados.papel,
            rotuloPublico: dados.rotuloPublico ?? null,
            visivelPublico: dados.visivelPublico ?? false,
            prazoPadraoDias: dados.prazoPadraoDias ?? null,
          })
          .returning();
        await registrarTrilha(tx, {
          origem: 'usuario',
          autorId: ator.usuarioId,
          operacao: 'fluxo.criar_etapa',
          entidade: 'etapa',
          registroId: (nova as Linha).id,
          valorNovo: { tipo: fluxo.tipo, ...paraEtapa(nova as Linha) },
        });
        return nova as Linha;
      });
      return paraEtapa(criada);
    } catch (erro) {
      this.traduzir(erro);
    }
  }

  /** Estruturar (Administrador): ativar ou desativar. O banco recusa o que quebra o fluxo. */
  async alterarSituacao(
    ator: Ator,
    id: number,
    situacao: 'ativa' | 'inativa',
  ): Promise<EtapaDoFluxo> {
    const { etapa: antes } = await this.obterEtapa(id);
    try {
      const [depois] = await this.bd.transaction(async (tx) => {
        const salvo = await tx.update(etapa).set({ situacao }).where(eq(etapa.id, id)).returning();
        await registrarTrilha(tx, {
          origem: 'usuario',
          autorId: ator.usuarioId,
          operacao: 'fluxo.alterar_situacao_etapa',
          entidade: 'etapa',
          registroId: id,
          valorAnterior: { situacao: antes.situacao },
          valorNovo: { situacao },
        });
        return salvo;
      });
      return paraEtapa(depois as Linha);
    } catch (erro) {
      this.traduzir(erro);
    }
  }

  /** Traduz as regras do banco (RN-FLU-01 a RN-FLU-03) em mensagens que o usuário entende. */
  private traduzir(erro: unknown): never {
    if (
      codigoDoPostgres(erro) === '23505' &&
      restricaoViolada(erro) === 'etapa_nome_unico_ativas'
    ) {
      throw erros.conflito('Já existe uma etapa ativa com esse nome neste fluxo.');
    }
    const mensagem = mensagemDoPostgres(erro);
    const regras = ['Entrada', 'Arquivamento', 'Conclusão', 'registros', 'Rótulo', 'papel'];
    if (
      regras.some((r) => mensagem.includes(r)) &&
      ['23000', '23514'].includes(codigoDoPostgres(erro) ?? '')
    ) {
      throw erros.conflito(mensagem.replace(/^.*?: /, ''));
    }
    throw erro;
  }
}
