import {
  habilitacao,
  usuario,
  type NovoAviso,
  type TipoDeRegistroDeAviso,
  type Transacao,
} from '@gabinete/banco';
import { perfisComTodasAsHabilitacoes, type Area } from '@gabinete/compartilhado';
import { and, eq, inArray } from 'drizzle-orm';

type Leitor = Pick<Transacao, 'select'>;

/**
 * Menções a colegas (@Nome) num texto livre: descrição, observação, comentário. Vira um aviso para cada
 * mencionado, na mesma transação do ato. O aviso não leva o texto: diz quem mencionou e aponta para o
 * registro (o título dele é o contexto). Só são avisados:
 * - usuários ativos que a API reconhece pelo id, e que o texto de fato cita (`@Nome`);
 * - quem tem a habilitação da área do registro (ou perfil com todas), se houver `area`;
 * - quem ainda não estava citado no texto anterior (editar um texto não avisa de novo quem já constava).
 * Quem não alcança o registro não vê o aviso na caixa (a leitura confere o alcance).
 */
export async function avisosDeMencao(
  bd: Leitor,
  o: {
    autorId: number;
    ids: readonly number[];
    texto: string | null | undefined;
    anterior?: string | null | undefined;
    area?: Area;
    registroTipo: TipoDeRegistroDeAviso;
    registroId: number;
    geradoEm: Date;
  },
): Promise<NovoAviso[]> {
  const ids = [...new Set(o.ids)].filter((id) => id !== o.autorId);
  if (ids.length === 0 || !o.texto) return [];

  const ativos = await bd
    .select({ id: usuario.id, nome: usuario.nome, perfil: usuario.perfil })
    .from(usuario)
    .where(and(inArray(usuario.id, ids), eq(usuario.situacao, 'ativo')));

  let permitidos = new Set(ativos.map((u) => u.id));
  if (o.area && ativos.length > 0) {
    const comArea = new Set(
      (
        await bd
          .select({ usuarioId: habilitacao.usuarioId })
          .from(habilitacao)
          .where(
            and(
              inArray(
                habilitacao.usuarioId,
                ativos.map((u) => u.id),
              ),
              eq(habilitacao.area, o.area),
            ),
          )
      ).map((h) => h.usuarioId),
    );
    permitidos = new Set(
      ativos
        .filter((u) => perfisComTodasAsHabilitacoes.includes(u.perfil) || comArea.has(u.id))
        .map((u) => u.id),
    );
  }

  return ativos
    .filter((u) => permitidos.has(u.id))
    .filter((u) => o.texto?.includes(`@${u.nome}`) === true)
    .filter((u) => !(o.anterior ?? '').includes(`@${u.nome}`))
    .map((u) => ({
      destinatarioId: u.id,
      natureza: 'mencao' as const,
      registroTipo: o.registroTipo,
      registroId: o.registroId,
      geradoEm: o.geradoEm,
    }));
}
