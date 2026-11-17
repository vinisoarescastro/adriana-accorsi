import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { BancoDeDados } from '@gabinete/banco';
import { sql } from 'drizzle-orm';

/** O que é dado de uso (some) e o que é estrutura ou configuração (fica). */
const tabelasDeDados = [
  'andamento_publicado',
  'aviso',
  'beneficiario',
  'bloqueio_indisponibilidade',
  'comentario_interno',
  'comentario_mencao',
  'compromisso',
  'consentimento_notificacao',
  'demanda',
  'demanda_responsavel',
  'documento',
  'envio_notificacao',
  'evento',
  'movimentacao',
  'participacao_evento',
  'participante_externo',
  'participante_interno',
  'pessoa',
  'projeto_assunto',
  'projeto_coautor',
  'projeto_lei',
  'protocolo_emitido',
  'tarefa',
  'tarefa_responsavel',
  'tramitacao_comissao',
  'vinculo',
  'votacao_projeto',
] as const;

/** Entidades da trilha que pertencem aos dados apagados. O resto (usuários, acesso, fluxos) fica. */
const entidadesDaTrilha = [
  'beneficiario',
  'compromisso',
  'demanda',
  'evento',
  'pessoa',
  'projeto_lei',
  'tarefa',
] as const;

/**
 * Apaga os dados de uso, numa transação. Várias tabelas são imutáveis por gatilho (trilha,
 * movimentações, consentimentos): por isso a limpeza desliga os gatilhos de USUÁRIO só dentro desta
 * transação e só no banco local (quem chama confere). Fica intacto: usuários, contas, habilitações,
 * sessões, identidade do gabinete, parâmetros, fluxos (tipos e etapas), política de publicação e
 * migrações. Os arquivos dos documentos apagados também saem do armazenamento.
 */
export async function limpar(bd: BancoDeDados, pastaDeArquivos: string): Promise<void> {
  await bd.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL session_replication_role = replica`);
    await tx.execute(sql.raw(`TRUNCATE TABLE ${tabelasDeDados.join(', ')} RESTART IDENTITY`));
    await tx.execute(
      sql.raw(
        `DELETE FROM trilha WHERE entidade IN (${entidadesDaTrilha.map((e) => `'${e}'`).join(', ')})`,
      ),
    );
  });
  await rm(resolve(pastaDeArquivos, 'documentos'), { recursive: true, force: true });
}
