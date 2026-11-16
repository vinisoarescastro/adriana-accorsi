import { consentimentoNotificacao, pessoa } from '@gabinete/banco';
import { bairros, nomes, ruas, sobrenomes } from './conteudo.js';
import { comArea, contar, registrarNaTrilha, semAcento, type Contexto } from './contexto.js';

export interface PessoaCriada {
  readonly id: number;
  readonly nome: string | null;
  readonly situacao: 'ativa' | 'inativa' | 'dados_eliminados';
  readonly email: string | null;
  readonly emailValido: boolean;
  /** `true` se há consentimento vigente de aviso por e-mail. */
  consentimento: boolean;
  readonly criadoEm: Date;
}

const total = 64;
const eliminadas = 3;
const inativas = 5;

function formatarTelefone(digitos: string): string {
  return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`;
}

/**
 * Cidadãos atendidos: a maioria ativa, alguns inativos e três com os dados eliminados a pedido (a
 * regra de LGPD da aplicação). Vários têm e-mail; parte deles consentiu em receber avisos, e alguns
 * retiraram o consentimento depois (o histórico fica).
 */
export async function popularPessoas(ctx: Contexto): Promise<PessoaCriada[]> {
  const { sorteio, relogio } = ctx;
  const atendentes = comArea(ctx, 'AT').filter((c) => c.perfil !== 'assessor_externo');
  const usados = new Set<string>();
  const telefones = new Set<string>();
  const linhas: Array<typeof pessoa.$inferInsert & { formatado: string }> = [];

  for (let i = 0; i < total; i += 1) {
    let nomeCompleto: string;
    do {
      nomeCompleto = `${sorteio.escolher(nomes)} ${sorteio.escolher(sobrenomes)} ${sorteio.escolher(sobrenomes)}`;
    } while (usados.has(nomeCompleto));
    usados.add(nomeCompleto);

    let digitos: string;
    do {
      digitos = `679${String(sorteio.inteiro(10000000, 99999999))}`;
    } while (telefones.has(digitos));
    telefones.add(digitos);

    const situacao: PessoaCriada['situacao'] =
      i < eliminadas ? 'dados_eliminados' : i < eliminadas + inativas ? 'inativa' : 'ativa';
    const temEmail = situacao !== 'dados_eliminados' && sorteio.chance(0.72);
    const emailValido = !(temEmail && i % 23 === 0);
    const baseDoEmail = semAcento(nomeCompleto).split('.').slice(0, 2).join('.');
    const criadoEm = relogio.diasAtras(sorteio.inteiro(8, 210));
    const bairro = sorteio.escolher(bairros);
    linhas.push({
      nomeCompleto: situacao === 'dados_eliminados' ? null : nomeCompleto,
      telefoneNormalizado: situacao === 'dados_eliminados' ? null : digitos.slice(0, 11),
      email: temEmail ? `${baseDoEmail}${i}@exemplo.test` : null,
      contatos:
        situacao !== 'dados_eliminados' && sorteio.chance(0.25)
          ? `Recado com a vizinha, ${sorteio.escolher(nomes)} (67) 3${sorteio.inteiro(100, 999)}-${sorteio.inteiro(1000, 9999)}`
          : null,
      endereco:
        situacao === 'dados_eliminados' || sorteio.chance(0.2)
          ? null
          : `Rua ${sorteio.escolher(ruas)}, ${sorteio.inteiro(12, 1480)}, ${bairro}, Campo Grande/MS`,
      situacao,
      criadoPor: sorteio.escolher(atendentes).id,
      criadoEm,
      emailInvalido: temEmail && !emailValido,
      formatado: formatarTelefone(digitos.slice(0, 11)),
    });
  }

  const inseridas = await ctx.bd
    .insert(pessoa)
    .values(linhas.map(({ formatado: _f, ...l }) => l))
    .returning({ id: pessoa.id });

  const resultado: PessoaCriada[] = inseridas.map((r, i) => {
    const l = linhas[i]!;
    return {
      id: r.id,
      nome: l.nomeCompleto ?? null,
      situacao: l.situacao as PessoaCriada['situacao'],
      email: l.email ?? null,
      emailValido: !l.emailInvalido,
      consentimento: false,
      criadoEm: l.criadoEm as Date,
    };
  });

  // Consentimentos (LGPD): quem tem e-mail válido pode ter consentido; alguns descadastraram depois.
  const consentimentos: (typeof consentimentoNotificacao.$inferInsert)[] = [];
  let descadastros = 0;
  for (const p of resultado) {
    if (p.situacao !== 'ativa' || !p.email || !p.emailValido || !sorteio.chance(0.62)) continue;
    const quando = relogio.depois(p.criadoEm, sorteio.inteiro(0, 3));
    consentimentos.push({
      pessoaId: p.id,
      consentido: true,
      registradoPor: sorteio.escolher(atendentes).id,
      registradoEm: quando,
      origem: sorteio.escolher([
        'atendimento_telefonico',
        'atendimento_presencial',
        'pedido_ao_gabinete',
      ] as const),
      versaoTexto: 1,
    });
    if (descadastros < 5 && sorteio.chance(0.12)) {
      descadastros += 1;
      consentimentos.push({
        pessoaId: p.id,
        consentido: false,
        registradoPor: null,
        registradoEm: relogio.limitar(relogio.depois(quando, sorteio.inteiro(20, 60))),
        origem: 'descadastro_cidadao' as const,
        versaoTexto: null,
      });
    } else {
      p.consentimento = true;
    }
  }
  if (consentimentos.length > 0)
    await ctx.bd.insert(consentimentoNotificacao).values(consentimentos);

  for (const p of resultado) {
    registrarNaTrilha(ctx, {
      ocorridaEm: p.criadoEm,
      autorId: sorteio.escolher(atendentes).id,
      origem: 'usuario',
      operacao: 'pessoa.criar',
      entidade: 'pessoa',
      registroId: String(p.id),
    });
    if (p.situacao === 'dados_eliminados') {
      registrarNaTrilha(ctx, {
        ocorridaEm: relogio.depois(p.criadoEm, 40),
        autorId: atendentes[0]!.id,
        origem: 'usuario',
        operacao: 'pessoa.eliminar_dados',
        entidade: 'pessoa',
        registroId: String(p.id),
        justificativa: 'Pedido da própria pessoa (LGPD).',
      });
    }
  }
  contar(ctx, 'Pessoas (cidadãos)', resultado.length);
  contar(ctx, 'Registros de consentimento por e-mail', consentimentos.length);
  return resultado;
}
