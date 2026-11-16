import { expiracaoSemLer } from '@gabinete/banco';
import type postgres from 'postgres';

const hora = 60 * 60 * 1000;
const cincoMinutos = 5 * 60 * 1000;
const fusoDoGabinete = 'America/Sao_Paulo';

export interface OpcoesDoGeradorDePrazos {
  /** Conexão com o papel `app_worker`: só lê a visão de prazos e insere em `aviso`. */
  readonly sql: postgres.Sql;
  readonly agora?: () => Date;
  /** Para onde vão os registros de falha. */
  readonly registrar?: (mensagem: string) => void;
}

export interface ResumoDePrazos {
  readonly proximos: number;
  readonly vencidos: number;
  readonly expurgados: number;
  /** Itens que não puderam receber aviso nesta passagem (a passagem seguiu para os demais). */
  readonly falhas: number;
}

/** A data de hoje (AAAA-MM-DD) no fuso do gabinete, não no do servidor. */
export function hojeNoGabinete(agora: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: fusoDoGabinete,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(agora);
}

interface Prazo {
  registro_tipo: 'tarefa' | 'demanda';
  registro_id: string;
  responsavel_id: string;
  prazo: string;
}

/**
 * O worker de prazos (RN-AVI-04): de hora em hora, avisa o responsável de prazo próximo e de prazo
 * vencido, UMA vez por dia por prazo (a chave única do aviso leva a data), e expurga os avisos
 * expirados. Só gera aviso: nenhuma automação decide nada (princípio 6). O papel do banco só
 * consegue inserir em `aviso`, ler a visão de prazos e chamar duas funções.
 */
export class GeradorDeAvisosDePrazo {
  private proximaPassagem = 0;

  constructor(private readonly o: OpcoesDoGeradorDePrazos) {}

  private agora(): Date {
    return (this.o.agora ?? (() => new Date()))();
  }

  /** Uma passagem completa. Cada aviso é independente: o que falhar não impede os outros. */
  async passar(): Promise<ResumoDePrazos> {
    const sql = this.o.sql;
    const agora = this.agora();
    const hoje = hojeNoGabinete(agora);
    const [{ dias } = { dias: 3 }] = await sql<
      { dias: number }[]
    >`SELECT antecedencia_do_aviso_de_prazo() AS dias`;

    // Aberto e com prazo até hoje + antecedência: os vencidos e os que vencem logo.
    const prazos = await sql<Prazo[]>`
      SELECT registro_tipo, registro_id, responsavel_id, prazo::text AS prazo
      FROM vw_prazo_aberto
      WHERE prazo <= ${hoje}::date + ${dias}::int
      ORDER BY prazo, registro_tipo, registro_id`;

    const expiraEm = expiracaoSemLer(agora).toISOString();
    let proximos = 0;
    let vencidos = 0;
    let falhas = 0;
    for (const p of prazos) {
      const natureza = p.prazo < hoje ? 'prazo_vencido' : 'prazo_proximo';
      const chave = `${natureza}:${p.registro_tipo}:${p.registro_id}:${hoje}`;
      try {
        // Sem RETURNING: o papel só insere, não lê `aviso`. O que foi inserido vem na contagem.
        const criado = await sql`
          INSERT INTO aviso (destinatario_id, natureza, registro_tipo, registro_id, gerado_em, expira_em, chave_unica)
          VALUES (${p.responsavel_id}, ${natureza}, ${p.registro_tipo}, ${p.registro_id},
                  ${agora.toISOString()}::timestamptz, ${expiraEm}::timestamptz, ${chave})
          ON CONFLICT DO NOTHING`;
        if (criado.count > 0) {
          if (natureza === 'prazo_vencido') vencidos += 1;
          else proximos += 1;
        }
      } catch (erro) {
        falhas += 1;
        this.o.registrar?.(
          `aviso de prazo não gerado (${p.registro_tipo} ${p.registro_id}): ${
            erro instanceof Error ? erro.message : String(erro)
          }`,
        );
      }
    }

    const [{ apagados } = { apagados: 0 }] = await sql<
      { apagados: number }[]
    >`SELECT expurgar_avisos(${agora.toISOString()}::timestamptz) AS apagados`;
    return { proximos, vencidos, expurgados: Number(apagados), falhas };
  }

  /**
   * Passa no máximo uma vez por hora. Uma passagem que falha NÃO derruba o processo: o erro é
   * registrado e a passagem é repetida em 5 minutos. Devolve `null` se ainda não é a hora.
   */
  async passarSeDevido(): Promise<ResumoDePrazos | null> {
    const agora = this.agora().getTime();
    if (agora < this.proximaPassagem) return null;
    try {
      const resumo = await this.passar();
      this.proximaPassagem = agora + hora;
      return resumo;
    } catch (erro) {
      this.proximaPassagem = agora + cincoMinutos;
      this.o.registrar?.(
        `falha na passagem de prazos: ${erro instanceof Error ? erro.message : String(erro)}`,
      );
      return null;
    }
  }
}
