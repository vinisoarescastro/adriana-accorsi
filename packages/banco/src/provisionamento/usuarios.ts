import {
  areas,
  perfisComTodasAsHabilitacoes,
  type Area,
  type Perfil,
} from '@gabinete/compartilhado';
import type { Transacao } from '../conexao.js';
import { contaAcesso, habilitacao, senhaInicial, usuario } from '../esquema/index.js';
import { gerarSenhaInicial, gerarVerificador } from '../senha.js';
import { registrarTrilha } from '../trilha.js';

export interface NovoUsuarioPorComando {
  readonly email: string;
  readonly nome: string;
  readonly perfil: Perfil;
  readonly habilitacoes?: readonly Area[];
  /** Validade da senha inicial. Padrão: 72 horas. */
  readonly validadeDaSenhaEmHoras?: number;
}

export interface UsuarioCriado {
  readonly usuarioId: number;
  readonly email: string;
  readonly perfil: Perfil;
  /** Mostrada uma única vez a quem rodou o comando. Nunca é gravada em claro. */
  readonly senhaInicial: string;
}

/**
 * Cria conta, usuário, habilitações, senha inicial e trilha na mesma transação.
 * Usada pelos comandos de linha (primeiro administrador e semeadura).
 * Administrador e Parlamentar recebem todas as habilitações.
 */
export async function criarUsuarioPorComando(
  tx: Transacao,
  dados: NovoUsuarioPorComando,
): Promise<UsuarioCriado> {
  const email = dados.email.trim().toLowerCase();
  const senha = gerarSenhaInicial();
  const verificador = await gerarVerificador(senha);

  const [conta] = await tx
    .insert(contaAcesso)
    .values({ email, verificadorSenha: verificador, senhaTrocaObrigatoria: true })
    .returning({ id: contaAcesso.id });
  if (!conta) throw new Error('Falha ao criar a conta de acesso.');

  const [criado] = await tx
    .insert(usuario)
    .values({ contaId: conta.id, nome: dados.nome.trim(), perfil: dados.perfil })
    .returning({ id: usuario.id });
  if (!criado) throw new Error('Falha ao criar o usuário.');

  const concedidas: readonly Area[] = perfisComTodasAsHabilitacoes.includes(dados.perfil)
    ? areas
    : (dados.habilitacoes ?? []);
  if (concedidas.length > 0) {
    await tx.insert(habilitacao).values(concedidas.map((area) => ({ usuarioId: criado.id, area })));
  }

  const horas = dados.validadeDaSenhaEmHoras ?? 72;
  await tx.insert(senhaInicial).values({
    usuarioId: criado.id,
    expiraEm: new Date(Date.now() + horas * 3_600_000),
  });

  await registrarTrilha(tx, {
    origem: 'comando',
    operacao: 'usuario.criar',
    entidade: 'usuario',
    registroId: criado.id,
    valorNovo: { email, nome: dados.nome.trim(), perfil: dados.perfil, habilitacoes: concedidas },
  });

  return { usuarioId: criado.id, email, perfil: dados.perfil, senhaInicial: senha };
}
