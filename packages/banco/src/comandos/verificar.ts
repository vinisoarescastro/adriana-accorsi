import { esquemaComandoApi, validarAmbiente } from '@gabinete/compartilhado';
import { abrirConexao } from '../conexao.js';
import { verificarInvariantes } from '../invariantes.js';
import { executar } from './executar.js';

await executar(async () => {
  const ambiente = validarAmbiente(esquemaComandoApi);
  const conexao = abrirConexao(ambiente.DATABASE_URL_API, { max: 1 });
  try {
    const resultados = await verificarInvariantes(conexao.cliente);
    for (const r of resultados) {
      console.log(
        `${r.ok ? 'ok    ' : 'FALHOU'} (${r.id}) ${r.descricao}${r.detalhe ? `: ${r.detalhe}` : ''}`,
      );
    }
    if (resultados.some((r) => !r.ok)) process.exitCode = 1;
  } finally {
    await conexao.encerrar();
  }
});
