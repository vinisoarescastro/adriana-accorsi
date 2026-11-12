import { count } from 'drizzle-orm';
import type { Area, Perfil } from '@gabinete/compartilhado';
import type { BancoDeDados } from '../conexao.js';
import { gabinete, usuario } from '../esquema/index.js';
import { criarUsuarioPorComando, type UsuarioCriado } from './usuarios.js';

export class ErroDeSemeadura extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'ErroDeSemeadura';
  }
}

const hostsLocais = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

/** A semeadura recusa qualquer banco que não seja local. */
export function exigirBancoLocal(url: string): void {
  const { hostname } = new URL(url);
  if (!hostsLocais.has(hostname)) {
    throw new ErroDeSemeadura(
      `Recusado: a semeadura só roda em banco local (host ${hostname} não é local).`,
    );
  }
}

const equipeDeExemplo: ReadonlyArray<{
  email: string;
  nome: string;
  perfil: Perfil;
  habilitacoes: readonly Area[];
}> = [
  {
    email: 'parlamentar@exemplo.test',
    nome: 'Parlamentar de Exemplo',
    perfil: 'parlamentar',
    habilitacoes: [],
  },
  {
    email: 'administrador@exemplo.test',
    nome: 'Administrador de Exemplo',
    perfil: 'administrador',
    habilitacoes: [],
  },
  {
    email: 'chefe@exemplo.test',
    nome: 'Chefe de Exemplo',
    perfil: 'chefe',
    habilitacoes: ['AT', 'AG', 'LG', 'FI'],
  },
  {
    email: 'supervisor@exemplo.test',
    nome: 'Supervisor de Exemplo',
    perfil: 'supervisor',
    habilitacoes: ['AT', 'AG', 'LG', 'FI'],
  },
  {
    email: 'interno@exemplo.test',
    nome: 'Assessor Interno de Exemplo',
    perfil: 'assessor_interno',
    habilitacoes: ['AT', 'AG'],
  },
  {
    email: 'externo@exemplo.test',
    nome: 'Assessor Externo de Exemplo',
    perfil: 'assessor_externo',
    habilitacoes: ['AT'],
  },
];

/**
 * Semeia dados FICTÍCIOS para desenvolvimento. Recusa banco que já tenha usuários.
 * A recusa de banco não local é feita por quem chama, com `exigirBancoLocal`.
 */
export async function semear(bd: BancoDeDados): Promise<UsuarioCriado[]> {
  const [existentes] = await bd.select({ total: count() }).from(usuario);
  if ((existentes?.total ?? 0) > 0) {
    throw new ErroDeSemeadura('Recusado: o banco já tem usuários.');
  }

  return bd.transaction(async (tx) => {
    await tx.insert(gabinete).values({
      nome: 'Gabinete de Exemplo (desenvolvimento)',
      parlamentarNome: 'Parlamentar de Exemplo',
      cargo: 'Deputado(a) Federal',
      partido: 'SIGLA',
      mandato: '2027 a 2031',
    });

    const criados: UsuarioCriado[] = [];
    for (const dados of equipeDeExemplo) {
      criados.push(await criarUsuarioPorComando(tx, dados));
    }
    return criados;
  });
}
