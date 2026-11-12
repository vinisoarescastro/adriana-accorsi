/** Roda um comando de linha: imprime a mensagem do erro (sem pilha) e sai com código 1. */
export async function executar(comando: () => Promise<void>): Promise<void> {
  try {
    await comando();
  } catch (erro) {
    console.error(erro instanceof Error ? erro.message : String(erro));
    process.exitCode = 1;
  }
}
