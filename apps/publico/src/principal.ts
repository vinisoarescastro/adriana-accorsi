import {
  esquemaPublico,
  validarAmbiente,
  variaveisProibidasNoPublico,
} from '@gabinete/compartilhado';
import postgres from 'postgres';
import { construirServidorPublico } from './servidor.js';

/**
 * Ponto de entrada do app público. Só recebe a conexão do papel `app_publico`: nada de credencial
 * administrativa, da API, do armazenamento de arquivos nem o segredo da aplicação.
 */
async function iniciar(): Promise<void> {
  // Em produção cada processo recebe só o que é seu (arquivos de ambiente separados) e RECUSA o resto.
  // Em desenvolvimento há um único .env com tudo, então a recusa só vale em produção.
  const emProducao = process.env.NODE_ENV === 'production';
  const ambiente = validarAmbiente(esquemaPublico, process.env, {
    proibidas: emProducao ? ['DATABASE_URL_ADMIN', ...variaveisProibidasNoPublico] : [],
  });
  const cliente = postgres(ambiente.DATABASE_URL_PUBLICO, { max: 5, onnotice: () => undefined });

  try {
    const app = await construirServidorPublico({
      cliente,
      // Em produção o único caminho até aqui é o Caddy, que informa o endereço de quem chegou.
      confiarNoProxy: ambiente.NODE_ENV === 'production',
      logger: true,
    });
    const encerrar = async () => {
      await app.close();
      await cliente.end({ timeout: 5 });
    };
    process.once('SIGINT', () => void encerrar());
    process.once('SIGTERM', () => void encerrar());
    await app.listen({ host: ambiente.HOST_PUBLICO, port: ambiente.PORTA_PUBLICO });
  } catch (erro) {
    console.error(erro instanceof Error ? erro.message : erro);
    await cliente.end({ timeout: 5 });
    process.exitCode = 1;
  }
}

await iniciar().catch((erro: unknown) => {
  console.error(erro instanceof Error ? erro.message : erro);
  process.exitCode = 1;
});
