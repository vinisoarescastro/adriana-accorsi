import { esquemaComandoApi, validarAmbiente } from '@gabinete/compartilhado';
import { abrirConexao } from '../conexao.js';
import { exigirBancoLocal, semear } from '../provisionamento/semear.js';
import { executar } from './executar.js';

/**
 * Semeia dados fictícios para desenvolvimento.
 * Recusa banco que não seja local e banco que já tenha usuários.
 */
await executar(async () => {
  const ambiente = validarAmbiente(esquemaComandoApi);
  exigirBancoLocal(ambiente.DATABASE_URL_API);

  const conexao = abrirConexao(ambiente.DATABASE_URL_API, { max: 1 });
  try {
    const criados = await semear(conexao.bd);
    console.log('Dados fictícios criados. Senhas iniciais (mostradas uma única vez):');
    for (const c of criados) {
      console.log(`  ${c.perfil.padEnd(17)} ${c.email.padEnd(28)} ${c.senhaInicial}`);
    }
  } finally {
    await conexao.encerrar();
  }
});
