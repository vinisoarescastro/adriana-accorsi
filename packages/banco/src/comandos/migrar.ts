import { esquemaMigracao, validarAmbiente } from '@gabinete/compartilhado';
import { migrar } from '../migrar.js';
import { executar } from './executar.js';

await executar(async () => {
  const ambiente = validarAmbiente(esquemaMigracao);
  const { aplicadas, jaAplicadas } = await migrar(ambiente.DATABASE_URL_MIGRACAO);

  for (const nome of aplicadas) console.log(`aplicada: ${nome}`);
  console.log(
    aplicadas.length === 0
      ? `Nada a aplicar (${jaAplicadas.length} já aplicadas).`
      : `${aplicadas.length} migração(ões) aplicada(s).`,
  );
});
