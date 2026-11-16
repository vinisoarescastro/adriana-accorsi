import {
  contaAcesso,
  gerarVerificador,
  habilitacao,
  usuario,
  type BancoDeDados,
} from '@gabinete/banco';
import { perfisComTodasAsHabilitacoes, type Area, type Perfil } from '@gabinete/compartilhado';
import { areas } from '@gabinete/compartilhado';
import { contar, registrarNaTrilha, semAcento, type Colega, type Contexto } from './contexto.js';

/** Senha única das contas de demonstração (só vale no banco local; as contas antigas mantêm a delas). */
export const senhaDaDemonstracao = 'Gabinete2026Demo';

interface NovoUsuario {
  readonly nome: string;
  readonly perfil: Perfil;
  readonly habilitacoes: readonly Area[];
  readonly ativo?: boolean;
  readonly telefone: string;
}

const novos: readonly NovoUsuario[] = [
  {
    nome: 'Helena Vasconcelos',
    perfil: 'chefe',
    habilitacoes: ['AT', 'AG', 'LG', 'FI'],
    telefone: '(67) 99811-2001',
  },
  {
    nome: 'Rafael Nogueira',
    perfil: 'supervisor',
    habilitacoes: ['AT', 'AG', 'LG'],
    telefone: '(67) 99811-2002',
  },
  {
    nome: 'Camila Albuquerque',
    perfil: 'supervisor',
    habilitacoes: ['AT', 'AG', 'FI'],
    telefone: '(67) 99811-2003',
  },
  {
    nome: 'Beatriz Montenegro',
    perfil: 'assessor_interno',
    habilitacoes: ['AT', 'AG'],
    telefone: '(67) 99811-2004',
  },
  {
    nome: 'Diego Faria',
    perfil: 'assessor_interno',
    habilitacoes: ['AT'],
    telefone: '(67) 99811-2005',
  },
  {
    nome: 'Larissa Teixeira',
    perfil: 'assessor_interno',
    habilitacoes: ['AT', 'AG', 'LG'],
    telefone: '(67) 99811-2006',
  },
  {
    nome: 'Marcos Vinícius Prado',
    perfil: 'assessor_interno',
    habilitacoes: ['AT', 'FI'],
    telefone: '(67) 99811-2007',
  },
  {
    nome: 'Patrícia Duarte',
    perfil: 'assessor_interno',
    habilitacoes: ['AT', 'AG'],
    telefone: '(67) 99811-2008',
  },
  {
    nome: 'Sandra Medeiros',
    perfil: 'assessor_interno',
    habilitacoes: ['AG'],
    telefone: '(67) 99811-2009',
  },
  {
    nome: 'Tiago Bezerra',
    perfil: 'assessor_externo',
    habilitacoes: ['AT'],
    telefone: '(67) 99811-2010',
  },
  {
    nome: 'Juliana Ortiz',
    perfil: 'assessor_externo',
    habilitacoes: ['AT'],
    telefone: '(67) 99811-2011',
  },
  {
    nome: 'Eduardo Quintana',
    perfil: 'assessor_externo',
    habilitacoes: ['AT'],
    telefone: '(67) 99811-2012',
  },
  {
    nome: 'Renata Siqueira',
    perfil: 'assessor_externo',
    habilitacoes: ['AT'],
    telefone: '(67) 99811-2013',
  },
  {
    nome: 'Gustavo Pimentel',
    perfil: 'assessor_interno',
    habilitacoes: ['AT'],
    ativo: false,
    telefone: '(67) 99811-2014',
  },
  {
    nome: 'Aline Caetano',
    perfil: 'assessor_externo',
    habilitacoes: ['AT'],
    ativo: false,
    telefone: '(67) 99811-2015',
  },
];

/** Lê os usuários que já existem (ficam como estão) e cria os de demonstração. */
export async function popularUsuarios(ctx: Contexto, bd: BancoDeDados): Promise<void> {
  const existentes = await bd.select().from(usuario);
  const habs = await bd.select().from(habilitacao);
  for (const u of existentes) {
    ctx.colegas.push({
      id: u.id,
      nome: u.nome,
      perfil: u.perfil,
      habilitacoes: habs.filter((h) => h.usuarioId === u.id).map((h) => h.area),
      ativo: u.situacao === 'ativo',
    });
  }

  const verificador = await gerarVerificador(senhaDaDemonstracao);
  const criadoEm = ctx.relogio.diasAtras(150);
  const nomesExistentes = new Set(existentes.map((u) => u.nome));
  let criados = 0;
  for (const n of novos) {
    // Repetível: se uma execução anterior já criou este usuário, ele é reaproveitado.
    if (nomesExistentes.has(n.nome)) continue;
    criados += 1;
    const email = `${semAcento(n.nome)}@exemplo.test`;
    const [conta] = await bd
      .insert(contaAcesso)
      .values({ email, verificadorSenha: verificador, senhaTrocaObrigatoria: false, criadoEm })
      .returning({ id: contaAcesso.id });
    const [criado] = await bd
      .insert(usuario)
      .values({
        contaId: conta!.id,
        nome: n.nome,
        contato: n.telefone,
        perfil: n.perfil,
        situacao: n.ativo === false ? 'inativo' : 'ativo',
        criadoEm,
      })
      .returning({ id: usuario.id });
    const concedidas: readonly Area[] = perfisComTodasAsHabilitacoes.includes(n.perfil)
      ? areas
      : n.habilitacoes;
    if (concedidas.length > 0) {
      await bd
        .insert(habilitacao)
        .values(concedidas.map((area) => ({ usuarioId: criado!.id, area })));
    }
    const colega: Colega = {
      id: criado!.id,
      nome: n.nome,
      perfil: n.perfil,
      habilitacoes: concedidas,
      ativo: n.ativo !== false,
    };
    ctx.colegas.push(colega);
    registrarNaTrilha(ctx, {
      ocorridaEm: criadoEm,
      autorId: null,
      origem: 'comando',
      operacao: 'usuario.criar',
      entidade: 'usuario',
      registroId: String(criado!.id),
      valorNovo: { email, nome: n.nome, perfil: n.perfil, habilitacoes: concedidas },
    });
  }
  contar(ctx, 'Usuários criados (demonstração)', novos.length);
  contar(ctx, 'Usuários anteriores preservados', existentes.length - (novos.length - criados));
}
