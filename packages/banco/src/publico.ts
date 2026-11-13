import {
  formatarProtocolo,
  type AcompanhamentoPublico,
  type EstadoDeEtapaPublica,
  type SituacaoPublica,
} from '@gabinete/compartilhado';
import type postgres from 'postgres';

/**
 * Leitura da PROJEÇÃO PÚBLICA: só as três visões `vw_acompanhamento_*`. É o único caminho pelo qual
 * o app público e a pré-visualização da equipe leem o que o cidadão enxerga, então a prévia mostra
 * exatamente o que ele verá. Este arquivo não importa o resto do pacote (o app público não carrega
 * o esquema interno).
 */
export type ClienteSql = postgres.Sql;

interface LinhaDaVisao {
  protocolo: string;
  situacao: SituacaoPublica;
  criado_em: Date;
  atualizado_em: Date;
  titulo_publico: string | null;
  nome_publico: string | null;
  telefone_publico: string | null;
  gabinete_nome: string | null;
  parlamentar_nome: string | null;
  gabinete_telefone: string | null;
  gabinete_email: string | null;
}

export type ChaveDeAcompanhamento =
  { readonly segredoHash: string } | { readonly protocolo: string };

async function montar(sql: ClienteSql, linha: LinhaDaVisao): Promise<AcompanhamentoPublico> {
  const etapas = await sql<
    { rotulo: string; estado: EstadoDeEtapaPublica; data_em: Date | null }[]
  >`
    SELECT rotulo, estado, data_em FROM vw_acompanhamento_etapas
    WHERE protocolo = ${linha.protocolo} ORDER BY ordem`;
  const andamentos = await sql<{ texto: string; publicado_em: Date }[]>`
    SELECT texto, publicado_em FROM vw_acompanhamento_andamentos
    WHERE protocolo = ${linha.protocolo} ORDER BY publicado_em DESC, texto`;
  return {
    protocolo: formatarProtocolo(linha.protocolo),
    situacao: linha.situacao,
    criadoEm: new Date(linha.criado_em).toISOString(),
    atualizadoEm: new Date(linha.atualizado_em).toISOString(),
    titulo: linha.titulo_publico,
    nome: linha.nome_publico,
    telefone: linha.telefone_publico,
    etapas: etapas.map((e) => ({
      rotulo: e.rotulo,
      estado: e.estado,
      data: e.data_em ? new Date(e.data_em).toISOString() : null,
    })),
    andamentos: andamentos.map((a) => ({
      texto: a.texto,
      publicadoEm: new Date(a.publicado_em).toISOString(),
    })),
    gabinete: {
      nome: linha.gabinete_nome,
      parlamentar: linha.parlamentar_nome,
      telefone: linha.gabinete_telefone,
      email: linha.gabinete_email,
    },
  };
}

/** `null` quando não há nada a mostrar (inexistente, revogado, suspenso ou expirado: tudo igual). */
export async function lerAcompanhamento(
  sql: ClienteSql,
  chave: ChaveDeAcompanhamento,
): Promise<AcompanhamentoPublico | null> {
  const [linha] =
    'segredoHash' in chave
      ? await sql<LinhaDaVisao[]>`
          SELECT * FROM vw_acompanhamento_publico
          WHERE segredo_link_hash = ${chave.segredoHash} AND link_ativo`
      : await sql<LinhaDaVisao[]>`
          SELECT * FROM vw_acompanhamento_publico WHERE protocolo = ${chave.protocolo}`;
  return linha ? montar(sql, linha) : null;
}

/** A consulta por protocolo: o telefone do atendimento é exigido pelo próprio banco. */
export async function protocoloConfere(
  sql: ClienteSql,
  protocolo: string,
  telefoneNormalizado: string,
): Promise<boolean> {
  const [r] = await sql<{ ok: boolean }[]>`
    SELECT consultar_protocolo(${protocolo}, ${telefoneNormalizado}) AS ok`;
  return r?.ok === true;
}

export async function registrarAcessoPublico(
  sql: ClienteSql,
  protocolo: string,
  via: 'link' | 'protocolo',
): Promise<void> {
  await sql`SELECT registrar_acesso_publico(${protocolo}, ${via})`;
}

export async function descadastrarPorToken(sql: ClienteSql, tokenHash: string): Promise<boolean> {
  const [r] = await sql<{ ok: boolean }[]>`SELECT descadastrar_por_token(${tokenHash}) AS ok`;
  return r?.ok === true;
}
