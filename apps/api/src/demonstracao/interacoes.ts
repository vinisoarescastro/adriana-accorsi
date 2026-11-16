import { createHash, randomBytes, randomUUID } from 'node:crypto';
import {
  andamentoPublicado,
  comentarioInterno,
  comentarioMencao,
  documento,
  envioNotificacao,
} from '@gabinete/banco';
import { arquivos, comentarios } from './conteudo.js';
import { gerarPdf, gerarPng, gerarZip, sha256 } from './arquivos.js';
import {
  avisar,
  comArea,
  contar,
  preencher,
  registrarNaTrilha,
  type Contexto,
} from './contexto.js';
import type { DemandaCriada } from './demandas.js';

const dentroDoPrazo = (d: DemandaCriada) => d.passos[d.passos.length - 1]!.quando;

/**
 * O que as pessoas fazem em torno de uma demanda: conversam nos comentários (com menções @ a colegas,
 * que viram avisos), publicam novidades para o cidadão e anexam documentos. Gera também o e-mail
 * fictício que cada novidade dispara (sem enviar nada: tudo é @exemplo.test e fica só no banco).
 */
export async function popularInteracoes(
  ctx: Contexto,
  demandas: readonly DemandaCriada[],
): Promise<void> {
  const { sorteio, relogio } = ctx;
  const atendentes = comArea(ctx, 'AT');
  const internos = atendentes.filter((c) => c.perfil !== 'assessor_externo');
  const supervisores = internos.filter((c) => ['supervisor', 'chefe'].includes(c.perfil));

  // ---- Comentários internos e menções
  let totalComentarios = 0;
  let totalMencoes = 0;
  for (const d of demandas) {
    if (!sorteio.chance(0.72)) continue;
    const fim = d.cancelada || d.encerrada ? dentroDoPrazo(d) : relogio.agora;
    const quantidade = sorteio.ponderado([
      [1, 28],
      [2, 30],
      [3, 22],
      [4, 12],
      [5, 8],
    ]);
    // Quem conversa: o responsável, quem registrou e mais um ou dois colegas (externo só na própria demanda).
    const participantes = [d.responsavel, d.autor, ...sorteio.amostra(internos, 2)].filter(
      (c, i, todos) => todos.findIndex((x) => x.id === c.id) === i,
    );
    let momento = d.criadoEm;
    for (let k = 0; k < quantidade; k += 1) {
      momento = relogio.depois(momento, sorteio.inteiro(0, 5));
      if (momento > fim) break;
      const autor = sorteio.escolher(participantes);
      const colegas = sorteio.amostra(
        internos.filter((c) => c.id !== autor.id),
        2,
      );
      const texto = preencher(sorteio.escolher(comentarios), {
        A: colegas[0]!.nome,
        B: colegas[1]!.nome,
      });
      const removido = sorteio.chance(0.06);
      const [criado] = await ctx.bd
        .insert(comentarioInterno)
        .values({
          registroTipo: 'demanda',
          registroId: d.id,
          autorId: autor.id,
          texto,
          criadoEm: momento,
          ...(removido
            ? {
                situacao: 'removido' as const,
                removidoPor: autor.id,
                removidoEm: relogio.limitar(relogio.depois(momento, 1)),
              }
            : {}),
        })
        .returning({ id: comentarioInterno.id });
      totalComentarios += 1;
      const mencionados = colegas.filter((c) => texto.includes(`@${c.nome}`));
      if (mencionados.length > 0) {
        await ctx.bd
          .insert(comentarioMencao)
          .values(mencionados.map((c) => ({ comentarioId: criado!.id, usuarioId: c.id })));
        for (const m of mencionados) {
          totalMencoes += 1;
          avisar(ctx, {
            destinatarioId: m.id,
            natureza: 'mencao',
            registroTipo: 'demanda',
            registroId: d.id,
            origemId: autor.id,
            geradoEm: momento,
          });
        }
      }
      registrarNaTrilha(ctx, {
        ocorridaEm: momento,
        autorId: autor.id,
        origem: 'usuario',
        operacao: 'demanda.comentar',
        entidade: 'demanda',
        registroId: String(d.id),
        valorNovo: { comentarioId: criado!.id, mencionados: mencionados.map((m) => m.id) },
      });
    }
  }
  contar(ctx, 'Comentários internos (com menções @)', totalComentarios);
  contar(ctx, 'Menções a colegas nos comentários', totalMencoes);

  // ---- Novidades para o cidadão e os e-mails que elas disparam
  const envios: (typeof envioNotificacao.$inferInsert)[] = [];
  let totalAndamentos = 0;
  for (const d of demandas) {
    if (d.cancelada || !sorteio.chance(0.5)) continue;
    const podeAvisar = d.pessoa.consentimento && d.pessoa.emailValido && d.link === 'ativa';
    const quantidade = sorteio.inteiro(1, 3);
    let momento = d.criadoEm;
    for (let k = 0; k < quantidade; k += 1) {
      momento = relogio.depois(momento, sorteio.inteiro(1, 8));
      if (momento > relogio.agora) break;
      const texto =
        k === quantidade - 1 && d.encerrada
          ? sorteio.escolher(d.tema.conclusoes)
          : sorteio.escolher(d.tema.andamentos);
      const autor = sorteio.escolher([d.responsavel, ...supervisores]);
      const removido = sorteio.chance(0.07);
      await ctx.bd.insert(andamentoPublicado).values({
        demandaId: d.id,
        texto,
        autorId: autor.id,
        publicadoEm: momento,
        ...(removido
          ? {
              situacao: 'removido' as const,
              removidoPor: autor.id,
              removidoEm: relogio.limitar(relogio.depois(momento, 1)),
            }
          : {}),
      });
      totalAndamentos += 1;
      registrarNaTrilha(ctx, {
        ocorridaEm: momento,
        autorId: autor.id,
        origem: 'usuario',
        operacao: 'andamento.publicar',
        entidade: 'demanda',
        registroId: String(d.id),
      });
      if (podeAvisar && !removido && d.pessoa.email) {
        const token = randomBytes(32).toString('base64url');
        const recente = relogio.agora.getTime() - momento.getTime() < 3 * 3_600_000;
        const estado = recente
          ? 'pendente'
          : sorteio.ponderado([
              ['enviado', 90],
              ['falhou', 7],
              ['cancelado', 3],
            ] as const);
        envios.push({
          pessoaId: d.pessoa.id,
          demandaId: d.id,
          evento:
            d.encerrada && k === quantidade - 1
              ? ('conclusao' as const)
              : ('andamento_publicado' as const),
          payload: { texto, rotulo: d.etapaFinal, descadastro: token },
          descadastroHash: createHash('sha256').update(token).digest('hex'),
          estado,
          tentativas: estado === 'falhou' ? 3 : estado === 'pendente' ? 0 : 1,
          proximaTentativaEm: momento,
          provedorIdMensagem: estado === 'enviado' ? `demo-${randomUUID()}@exemplo.test` : null,
          erro:
            estado === 'falhou'
              ? 'Caixa de entrada cheia (550 5.2.2)'
              : estado === 'cancelado'
                ? 'Consentimento retirado pelo cidadão'
                : null,
          criadoEm: momento,
          enviadoEm: estado === 'enviado' ? new Date(momento.getTime() + 90_000) : null,
        });
      }
    }
  }
  if (envios.length > 0) await ctx.bd.insert(envioNotificacao).values(envios);
  contar(ctx, 'Novidades publicadas para o cidadão', totalAndamentos);
  contar(ctx, 'E-mails ao cidadão (fila e histórico)', envios.length);

  // ---- Documentos (arquivos de verdade, para abrir e baixar na aba Documentos)
  const alvos = demandas.filter((d) => !d.cancelada);
  const linhas: (typeof documento.$inferInsert)[] = [];
  for (let i = 0; i < 56; i += 1) {
    const d = sorteio.escolher(alvos);
    const modelo = sorteio.escolher(arquivos);
    const autor = sorteio.escolher([d.responsavel, d.autor, ...internos]);
    const enviadoEm = relogio.limitar(relogio.depois(d.criadoEm, sorteio.inteiro(0, 14)));
    const bytes =
      modelo.tipo === 'pdf'
        ? gerarPdf(modelo.titulo, [
            `Protocolo: ${d.protocolo}`,
            `Assunto: ${d.titulo}`,
            `Solicitante: ${d.pessoa.nome ?? 'Dados eliminados'}`,
            'Documento fictício gerado para demonstração do sistema.',
            `Emitido em ${enviadoEm.toISOString().slice(0, 10)}.`,
          ])
        : modelo.tipo === 'png'
          ? gerarPng(320, 200, i)
          : gerarZip([
              { nome: 'identidade-frente.txt', texto: 'Arquivo fictício de demonstração.' },
              { nome: 'comprovante.txt', texto: `Protocolo ${d.protocolo}. Conteúdo fictício.` },
            ]);
    const tipo =
      modelo.tipo === 'pdf'
        ? 'application/pdf'
        : modelo.tipo === 'png'
          ? 'image/png'
          : 'application/zip';
    const chave = `documentos/demandas/${d.id}/${randomUUID()}.${modelo.tipo}`;
    await ctx.armazenamento.guardar(chave, bytes, tipo);
    const removido = i % 17 === 5;
    linhas.push({
      registroTipo: 'demanda' as const,
      registroId: d.id,
      natureza: modelo.natureza,
      nome: modelo.nome,
      tipoReal: tipo,
      tamanho: bytes.length,
      chaveArmazenamento: chave,
      hashSha256: sha256(bytes),
      varredura: 'limpo' as const,
      autorEnvio: autor.id,
      enviadoEm,
      ...(removido
        ? {
            situacao: 'removido' as const,
            removidoPor: autor.id,
            removidoEm: relogio.limitar(relogio.depois(enviadoEm, 2)),
          }
        : {}),
    });
    registrarNaTrilha(ctx, {
      ocorridaEm: enviadoEm,
      autorId: autor.id,
      origem: 'usuario',
      operacao: 'demanda.anexar_documento',
      entidade: 'demanda',
      registroId: String(d.id),
      valorNovo: { nome: modelo.nome, natureza: modelo.natureza },
    });
  }
  await ctx.bd.insert(documento).values(linhas);
  contar(ctx, 'Documentos anexados (arquivos reais)', linhas.length);
}
