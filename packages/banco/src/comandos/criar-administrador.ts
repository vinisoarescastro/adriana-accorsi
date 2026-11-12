import { parseArgs } from 'node:util';
import { esquemaComandoApi, validarAmbiente } from '@gabinete/compartilhado';
import { eq } from 'drizzle-orm';
import { abrirConexao } from '../conexao.js';
import { usuario } from '../esquema/index.js';
import { criarUsuarioPorComando } from '../provisionamento/usuarios.js';
import { executar } from './executar.js';

/**
 * Cria o primeiro administrador. Recusa se já existir um: este comando não é
 * um meio de entrar no sistema depois da instalação.
 * Uso: npm run banco:criar-administrador -- --email fulano@dominio --nome "Nome Completo"
 */
await executar(async () => {
  const { values } = parseArgs({
    options: { email: { type: 'string' }, nome: { type: 'string' } },
  });
  if (!values.email || !values.nome) {
    throw new Error('Uso: --email <e-mail> --nome "<nome completo>"');
  }

  const ambiente = validarAmbiente(esquemaComandoApi);
  const conexao = abrirConexao(ambiente.DATABASE_URL_API, { max: 1 });
  try {
    const existentes = await conexao.bd
      .select({ id: usuario.id })
      .from(usuario)
      .where(eq(usuario.perfil, 'administrador'))
      .limit(1);
    if (existentes.length > 0) {
      throw new Error('Recusado: já existe um administrador. Este comando só cria o primeiro.');
    }

    const nome = values.nome;
    const email = values.email;
    const criado = await conexao.bd.transaction((tx) =>
      criarUsuarioPorComando(tx, { email, nome, perfil: 'administrador' }),
    );

    console.log(`Administrador criado: ${criado.email}`);
    console.log(
      `Senha inicial (mostrada uma única vez, de uso único, 72 h): ${criado.senhaInicial}`,
    );
    console.log('A troca da senha é obrigatória no primeiro acesso.');
  } finally {
    await conexao.encerrar();
  }
});
