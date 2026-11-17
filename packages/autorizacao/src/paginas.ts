import { pode, type Autoridade } from './decisor.js';
import type { NomeDeOperacao } from './operacoes.js';

/**
 * Páginas da área interna e a operação que cada uma exige. A barra de navegação usa
 * o MESMO decisor das rotas: página sem permissão não aparece, nem vazia nem bloqueada.
 */
export const paginas = {
  painel: { caminho: '/g/painel', titulo: 'Painel', operacao: 'painel.abrir' },
  demandas: { caminho: '/g/demandas', titulo: 'Demandas', operacao: 'demandas.consultar' },
  tarefas: { caminho: '/g/tarefas', titulo: 'Tarefas', operacao: 'tarefas.consultar' },
  agenda: { caminho: '/g/agenda', titulo: 'Agenda', operacao: 'agenda.consultar' },
  eventos: { caminho: '/g/eventos', titulo: 'Eventos', operacao: 'eventos.consultar' },
  projetos: { caminho: '/g/projetos', titulo: 'Projetos de lei', operacao: 'projetos.consultar' },
  beneficiarios: {
    caminho: '/g/beneficiarios',
    titulo: 'Beneficiários',
    operacao: 'beneficiarios.consultar',
  },
  emendas: { caminho: '/g/emendas', titulo: 'Emendas', operacao: 'emendas.consultar' },
  ceap: { caminho: '/g/ceap', titulo: 'CEAP', operacao: 'ceap.consultar' },
  pessoas: { caminho: '/g/pessoas', titulo: 'Pessoas', operacao: 'pessoas.consultar' },
  emails: {
    caminho: '/g/emails',
    titulo: 'E-mails',
    operacao: 'notificacoes.consultar_fila',
  },
  equipe: { caminho: '/g/equipe', titulo: 'Equipe', operacao: 'equipe.ver' },
  fluxos: { caminho: '/g/fluxos', titulo: 'Fluxos', operacao: 'fluxos.consultar' },
  auditoria: {
    caminho: '/g/auditoria',
    titulo: 'Auditoria',
    operacao: 'auditoria.consultar_gabinete',
  },
  configuracoes: {
    caminho: '/g/configuracoes',
    titulo: 'Configurações',
    operacao: 'gabinete.consultar',
  },
} as const satisfies Record<string, { caminho: string; titulo: string; operacao: NomeDeOperacao }>;

export type IdDePagina = keyof typeof paginas;

/** Falha fechada: só aparece o que está declarado e permitido. */
export function paginasAlcancaveis(autoridade: Autoridade): IdDePagina[] {
  return (Object.keys(paginas) as IdDePagina[]).filter((id) =>
    pode(paginas[id].operacao, autoridade),
  );
}
