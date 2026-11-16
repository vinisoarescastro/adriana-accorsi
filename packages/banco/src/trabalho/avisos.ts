import type { Transacao } from '../conexao.js';
import { aviso, type NaturezaDeAviso, type TipoDeRegistroDeAviso } from '../esquema/index.js';

const UM_DIA = 24 * 60 * 60 * 1000;

/** Aviso não lido expira em 60 dias; lido, 30 dias depois da leitura (RN-AVI-06). */
export const diasParaExpirarSemLer = 60;
export const diasParaExpirarDepoisDeLer = 30;

export const expiracaoSemLer = (geradoEm: Date): Date =>
  new Date(geradoEm.getTime() + diasParaExpirarSemLer * UM_DIA);

export const expiracaoDepoisDeLer = (lidoEm: Date): Date =>
  new Date(lidoEm.getTime() + diasParaExpirarDepoisDeLer * UM_DIA);

export interface NovoAviso {
  readonly destinatarioId: number;
  readonly natureza: NaturezaDeAviso;
  readonly registroTipo: TipoDeRegistroDeAviso;
  readonly registroId: number;
  readonly geradoEm: Date;
}

/**
 * Cria avisos DENTRO da transação do ato (RN-AVI-02): o aviso nasce com o ato ou não nasce.
 * Nunca avisa quem praticou o ato. O aviso não leva texto, dado pessoal nem valor: só aponta
 * para o registro, e quem não o alcança deixa de vê-lo (a leitura confere o alcance).
 */
export async function criarAvisos(
  tx: Pick<Transacao, 'insert'>,
  autorId: number,
  novos: readonly NovoAviso[],
): Promise<void> {
  const validos = novos.filter((n) => n.destinatarioId !== autorId);
  if (validos.length === 0) return;
  await tx.insert(aviso).values(
    validos.map((n) => ({
      destinatarioId: n.destinatarioId,
      natureza: n.natureza,
      registroTipo: n.registroTipo,
      registroId: n.registroId,
      geradoEm: n.geradoEm,
      expiraEm: expiracaoSemLer(n.geradoEm),
    })),
  );
}
