import { abrirConexao, exigirInvariantes } from '@gabinete/banco';
import { esquemaApi, validarAmbiente } from '@gabinete/compartilhado';
import {
  ArmazenamentoEmDisco,
  ArmazenamentoS3,
  type Armazenamento,
} from './armazenamento/armazenamento.js';
import { AntivirusClamd, type Antivirus } from './documentos/antivirus.js';
import { construirServidor } from './servidor.js';

/**
 * Ponto de entrada. Recusa subir com configuração inválida ou com banco que viole um
 * invariante de segurança.
 */
async function iniciar(): Promise<void> {
  // A conexão administrativa só existe para o comando de papéis: o processo da API recusa tê-la.
  // Em produção cada processo recebe só o que é seu (arquivos de ambiente separados) e RECUSA o resto.
  // Em desenvolvimento há um único .env com tudo, então a recusa só vale em produção.
  const emProducao = process.env.NODE_ENV === 'production';
  const ambiente = validarAmbiente(esquemaApi, process.env, {
    proibidas: emProducao ? ['DATABASE_URL_ADMIN', 'DATABASE_URL_MIGRACAO'] : [],
  });
  const conexao = abrirConexao(ambiente.DATABASE_URL_API);

  try {
    await exigirInvariantes(conexao.cliente);

    // O disco só é aceito em desenvolvimento e só quando pedido (ARMAZENAMENTO_LOCAL=1).
    // Fora de development o processo usa o S3 e se recusa a subir de outra forma.
    let armazenamento: Armazenamento;
    if (ambiente.NODE_ENV === 'development' && process.env.ARMAZENAMENTO_LOCAL === '1') {
      armazenamento = new ArmazenamentoEmDisco('.dados/armazenamento');
    } else {
      const s3 = new ArmazenamentoS3({
        endpoint: ambiente.S3_ENDPOINT,
        bucket: ambiente.S3_BUCKET,
        chaveDeAcesso: ambiente.S3_ACCESS_KEY,
        chaveSecreta: ambiente.S3_SECRET_KEY,
      });
      if (ambiente.NODE_ENV !== 'production') await s3.garantirBucket();
      armazenamento = s3;
    }

    // Em produção o antivírus é obrigatório: sem ele, um ZIP pode conter qualquer coisa.
    let antivirus: Antivirus | undefined;
    if (ambiente.CLAMAV_HOST) {
      antivirus = new AntivirusClamd(ambiente.CLAMAV_HOST, ambiente.CLAMAV_PORTA);
    } else if (ambiente.NODE_ENV === 'production') {
      throw new Error('Em produção o antivírus é obrigatório: defina CLAMAV_HOST.');
    }

    const app = await construirServidor({
      ambiente,
      conexao,
      armazenamento,
      ...(antivirus ? { antivirus } : {}),
      logger: true,
    });

    const encerrar = async () => {
      await app.close();
      await conexao.encerrar();
    };
    process.once('SIGINT', () => void encerrar());
    process.once('SIGTERM', () => void encerrar());

    await app.listen({ host: ambiente.HOST_API, port: ambiente.PORTA_API });
  } catch (erro) {
    console.error(erro instanceof Error ? erro.message : erro);
    await conexao.encerrar();
    process.exitCode = 1;
  }
}

await iniciar().catch((erro: unknown) => {
  // Configuração inválida ou banco fora do padrão: mensagem clara, sem pilha, e saída com erro.
  console.error(erro instanceof Error ? erro.message : erro);
  process.exitCode = 1;
});
