export type Tema = 'light' | 'dark';

const chave = 'tema';

/** O tema guardado neste navegador, ou o do sistema. Nunca falha: sem armazenamento, vale o claro. */
export function temaInicial(): Tema {
  try {
    const guardado = localStorage.getItem(chave);
    if (guardado === 'light' || guardado === 'dark') return guardado;
    return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function aplicarTema(tema: Tema): void {
  document.documentElement.dataset.theme = tema;
  try {
    localStorage.setItem(chave, tema);
  } catch {
    /* sem armazenamento: o tema vale só nesta visita */
  }
}
