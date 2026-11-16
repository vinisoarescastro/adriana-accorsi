import { exigirInvariantes } from '@gabinete/banco';
import { esquemaWorker, validarAmbiente } from '@gabinete/compartilhado';
import postgres from 'postgres';
import { CanalResend, CanalSmtp, type CanalDeNotificacao } from './canal.js';
import { GeradorDeAvisosDePrazo } from './prazos.js';
import { ProcessadorDeEnvios } from './processador.js';

const nomeDoRemetente = 'Gabinete da Deputada Adriana Accorsi';

/**
 * Ponto de entrada do worker. Recebe só a conexão do papel `app_worker`, o segredo da aplicação
 * (para montar o link do acompanhamento) e a configuração do canal de e-mail.
 */
async function iniciar(): Promise<void> {
  // Em produção cada processo recebe só o que é seu (arquivos de ambiente separados) e RECUSA o resto.
  // Em desenvolvimento há um único .env com tudo, então a recusa só vale em produção.
  const emProducao = process.env.NODE_ENV === 'production';
  const ambiente = validarAmbiente(esquemaWorker, process.env, {
    proibidas: emProducao
      ? ['DATABASE_URL_ADMIN', 'DATABASE_URL_MIGRACAO', 'DATABASE_URL_API']
      : [],
  });
  const sql = postgres(ambiente.DATABASE_URL_WORKER, { max: 3, onnotice: () => undefined });

  try {
    await exigirInvariantes(sql);

    const canal: CanalDeNotificacao =
      ambiente.EMAIL_PROVEDOR === 'resend'
        ? new CanalResend(
            ambiente.EMAIL_API_KEY as string,
            ambiente.EMAIL_REMETENTE,
            nomeDoRemetente,
          )
        : new CanalSmtp(
            ambiente.SMTP_HOST as string,
            ambiente.SMTP_PORTA,
            ambiente.EMAIL_REMETENTE,
            nomeDoRemetente,
          );
    const processador = new ProcessadorDeEnvios({
      sql,
      canal,
      segredoDaAplicacao: ambiente.SESSAO_SEGREDO,
      hostnamePublico: ambiente.HOSTNAME_PUBLICO,
      limitePorHora: ambiente.LIMITE_EMAILS_POR_HORA,
    });

    const prazos = new GeradorDeAvisosDePrazo({
      sql,
      registrar: (mensagem) => console.error(mensagem),
    });

    let parar = false;
    const encerrar = () => {
      parar = true;
    };
    process.once('SIGINT', encerrar);
    process.once('SIGTERM', encerrar);

    console.log(`worker no ar (canal: ${ambiente.EMAIL_PROVEDOR})`);
    while (!parar) {
      let cheio = false;
      try {
        const resumo = await processador.processarLote();
        if (resumo.reivindicados > 0) {
          console.log(
            `lote: ${resumo.enviados} enviado(s), ${resumo.cancelados} cancelado(s), ${resumo.adiados} adiado(s), ${resumo.falhas} falha(s)`,
          );
        }
        if (resumo.limitado) console.warn('limite de envio por hora atingido: aguardando');
        cheio = resumo.reivindicados >= 20;
      } catch (erro) {
        // Uma passagem que falha não derruba o processo (o banco pode ter piscado).
        console.error('falha ao processar a fila:', erro instanceof Error ? erro.message : erro);
      }
      // Prazos: de hora em hora. Falhar aqui nunca derruba o processo nem atrasa os e-mails.
      const resumoDePrazos = await prazos.passarSeDevido();
      if (resumoDePrazos) {
        console.log(
          `prazos: ${resumoDePrazos.proximos} próximo(s), ${resumoDePrazos.vencidos} vencido(s), ${resumoDePrazos.expurgados} expurgado(s), ${resumoDePrazos.falhas} falha(s)`,
        );
      }
      if (!cheio)
        await new Promise((r) => setTimeout(r, ambiente.INTERVALO_DO_WORKER_SEGUNDOS * 1000));
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}

await iniciar().catch((erro: unknown) => {
  console.error(erro instanceof Error ? erro.message : erro);
  process.exitCode = 1;
});
