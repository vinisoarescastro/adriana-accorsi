import type postgres from 'postgres';
import { afterEach, beforeEach, describe, expect, inject, it } from 'vitest';
import { criarBancoDeTeste, type BancoDeTeste } from '../teste/auxiliares.js';

let banco: BancoDeTeste;
let api: postgres.Sql;
let dono: postgres.Sql;
let publico: postgres.Sql;
let usuarioId: number;
let contador = 0;

beforeEach(async () => {
  banco = await criarBancoDeTeste(inject('urlAdminDeTeste'));
  api = banco.conectar('api').cliente;
  dono = banco.conectar('migracao').cliente;
  publico = banco.conectar('publico').cliente;
  const [conta] = await api<{ id: number }[]>`
    INSERT INTO conta_acesso (email, verificador_senha) VALUES ('a@exemplo.test', 'h') RETURNING id`;
  const [u] = await api<{ id: number }[]>`
    INSERT INTO usuario (conta_id, nome, perfil) VALUES (${conta!.id}, 'A', 'administrador') RETURNING id`;
  usuarioId = Number(u!.id);
});

afterEach(async () => {
  await banco.encerrar();
});

const etapaDe = async (papel: string, ordem?: number) => {
  const [e] = await api<{ id: number }[]>`
    SELECT e.id FROM etapa e JOIN tipo_processo t ON t.id = e.tipo_processo_id
    WHERE t.tipo = 'demanda' AND e.papel = ${papel} AND e.ordem = coalesce(${ordem ?? null}, e.ordem)
    ORDER BY e.ordem LIMIT 1`;
  return Number(e!.id);
};

async function novaDemanda(extra: { nome?: string; email?: string | null; segredo?: string } = {}) {
  contador += 1;
  const alfabeto = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  const protocolo = `K7M2${[...String(contador).padStart(8, '0')].map((c) => alfabeto[Number(c)]).join('')}`;
  const telefone = `679${String(contador).padStart(8, '0')}`;
  const [p] = await api<{ id: number }[]>`
    INSERT INTO pessoa (nome_completo, telefone_normalizado, email)
    VALUES (${extra.nome ?? 'Maria da Silva'}, ${telefone}, ${extra.email ?? null}) RETURNING id`;
  await api`INSERT INTO protocolo_emitido (protocolo) VALUES (${protocolo})`;
  const entrada = await etapaDe('entrada');
  const [d] = await api<{ id: number }[]>`
    INSERT INTO demanda (protocolo, segredo_link_hash, segredo_link_cifrado, solicitante_id, responsavel_id, autor_id, titulo, etapa_atual_id)
    VALUES (${protocolo}, ${extra.segredo ?? `hash-${contador}`}, 'cifrado', ${p!.id}, ${usuarioId}, ${usuarioId}, 'Poda de árvore na Rua das Flores', ${entrada}) RETURNING id`;
  const id = Number(d!.id);
  await mover(id, entrada, null);
  return {
    id,
    protocolo,
    telefone,
    pessoaId: Number(p!.id),
    segredo: extra.segredo ?? `hash-${contador}`,
  };
}

async function mover(demandaId: number, para: number, de: number | null, quando?: string) {
  await api`UPDATE demanda SET etapa_atual_id = ${para} WHERE id = ${demandaId}`;
  const [t] = await api<{ id: number }[]>`SELECT id FROM tipo_processo WHERE tipo = 'demanda'`;
  await api`
    INSERT INTO movimentacao (registro_tipo, registro_id, tipo_processo_id, etapa_origem_id, etapa_destino_id, autor_id, criada_em)
    VALUES ('demanda', ${demandaId}, ${t!.id}, ${de}, ${para}, ${usuarioId}, coalesce(${quando ?? null}::timestamptz, now()))`;
}

describe('o papel público só enxerga as visões', () => {
  it('não lê nenhuma tabela interna, nem escreve em nada', async () => {
    for (const tabela of [
      'demanda',
      'pessoa',
      'andamento_publicado',
      'comentario_interno',
      'documento',
      'usuario',
      'trilha',
      'envio_notificacao',
      'consentimento_notificacao',
      'politica_publicacao',
    ]) {
      await expect(publico.unsafe(`SELECT * FROM ${tabela}`), tabela).rejects.toThrow(
        /permission denied/,
      );
    }
    await expect(
      publico`INSERT INTO trilha (origem, operacao, entidade) VALUES ('publico', 'x', 'y')`,
    ).rejects.toThrow(/permission denied/);
    await expect(publico`SELECT * FROM vw_acompanhamento_publico`).resolves.toBeDefined();
  });

  it('a visão pública tem EXATAMENTE as colunas publicáveis (nada de prioridade, responsável, id...)', async () => {
    const colunas = await publico<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_name IN ('vw_acompanhamento_publico', 'vw_acompanhamento_etapas', 'vw_acompanhamento_andamentos')
      ORDER BY table_name, ordinal_position`;
    const nomes = (
      await dono<{ table_name: string; column_name: string }[]>`
        SELECT table_name, column_name FROM information_schema.columns
        WHERE table_name IN ('vw_acompanhamento_publico', 'vw_acompanhamento_etapas', 'vw_acompanhamento_andamentos')
        ORDER BY table_name, ordinal_position`
    ).map((c) => `${c.table_name}.${c.column_name}`);
    expect([...nomes].sort()).toEqual(
      [
        'vw_acompanhamento_andamentos.protocolo',
        'vw_acompanhamento_andamentos.texto',
        'vw_acompanhamento_andamentos.publicado_em',
        'vw_acompanhamento_etapas.protocolo',
        'vw_acompanhamento_etapas.ordem',
        'vw_acompanhamento_etapas.rotulo',
        'vw_acompanhamento_etapas.estado',
        'vw_acompanhamento_etapas.data_em',
        'vw_acompanhamento_publico.protocolo',
        'vw_acompanhamento_publico.segredo_link_hash',
        'vw_acompanhamento_publico.link_ativo',
        'vw_acompanhamento_publico.criado_em',
        'vw_acompanhamento_publico.atualizado_em',
        'vw_acompanhamento_publico.situacao',
        'vw_acompanhamento_publico.titulo_publico',
        'vw_acompanhamento_publico.nome_publico',
        'vw_acompanhamento_publico.telefone_publico',
        'vw_acompanhamento_publico.gabinete_nome',
        'vw_acompanhamento_publico.parlamentar_nome',
        'vw_acompanhamento_publico.gabinete_telefone',
        'vw_acompanhamento_publico.gabinete_email',
      ].sort(),
    );
    expect(colunas.length).toBeGreaterThan(0);
  });
});

describe('política de publicação (RN-PUB-02, 03)', () => {
  it('a versão inicial é a mais restritiva: sem título, primeiro nome, sem telefone', async () => {
    const d = await novaDemanda();
    const [v] = await publico<Record<string, unknown>[]>`
      SELECT * FROM vw_acompanhamento_publico WHERE protocolo = ${d.protocolo}`;
    expect(v).toMatchObject({
      titulo_publico: null,
      nome_publico: 'Maria',
      telefone_publico: null,
    });
  });

  it('a política vigente decide o que a visão mostra (título, nome completo, telefone mascarado)', async () => {
    const d = await novaDemanda();
    await api`UPDATE politica_publicacao SET vigente_ate = now() WHERE vigente_ate IS NULL`;
    await api`INSERT INTO politica_publicacao (exibir_titulo, exibicao_nome, exibicao_telefone, expiracao_dias, criado_por)
              VALUES (true, 'completo', 'mascarado', 30, ${usuarioId})`;
    const [v] = await publico<Record<string, unknown>[]>`
      SELECT * FROM vw_acompanhamento_publico WHERE protocolo = ${d.protocolo}`;
    expect(v).toMatchObject({
      titulo_publico: 'Poda de árvore na Rua das Flores',
      nome_publico: 'Maria da Silva',
    });
    expect(String(v!.telefone_publico)).toMatch(/^67\*{5}\d{2}$/);
    // O nome "não exibir" some de vez.
    await api`UPDATE politica_publicacao SET vigente_ate = now() WHERE vigente_ate IS NULL`;
    await api`INSERT INTO politica_publicacao (exibicao_nome) VALUES ('nao_exibir')`;
    const [w] = await publico<Record<string, unknown>[]>`
      SELECT nome_publico FROM vw_acompanhamento_publico WHERE protocolo = ${d.protocolo}`;
    expect(w!.nome_publico).toBeNull();
  });

  it('há uma só versão vigente; versão encerrada não muda; nada se apaga; expiração entre 7 e 1825 dias', async () => {
    await expect(api`INSERT INTO politica_publicacao (expiracao_dias) VALUES (30)`).rejects.toThrow(
      /politica_publicacao_uma_vigente/,
    );
    await expect(
      api`UPDATE politica_publicacao SET expiracao_dias = 10 WHERE vigente_ate IS NULL`,
    ).rejects.toThrow(/só pode ser encerrada/);
    await expect(dono`DELETE FROM politica_publicacao`).rejects.toThrow(/não se apaga/);
    await api`UPDATE politica_publicacao SET vigente_ate = now() WHERE vigente_ate IS NULL`;
    await expect(api`INSERT INTO politica_publicacao (expiracao_dias) VALUES (6)`).rejects.toThrow(
      /politica_expiracao_valida/,
    );
    await expect(
      api`INSERT INTO politica_publicacao (expiracao_dias) VALUES (1826)`,
    ).rejects.toThrow(/politica_expiracao_valida/);
    await api`INSERT INTO politica_publicacao (expiracao_dias) VALUES (7)`;
  });
});

describe('quem aparece na área pública (RN-PUB-05, 06, 11)', () => {
  const aparece = async (protocolo: string) =>
    (await publico`SELECT 1 FROM vw_acompanhamento_publico WHERE protocolo = ${protocolo}`)
      .length === 1;

  it('suspensa fecha as duas vias; revogada fecha o link mas deixa o protocolo; regenerar reabre', async () => {
    const d = await novaDemanda();
    expect(await aparece(d.protocolo)).toBe(true);

    await api`UPDATE demanda SET publicacao_link = 'suspensa' WHERE id = ${d.id}`;
    expect(await aparece(d.protocolo)).toBe(false);
    expect(
      (await publico`SELECT consultar_protocolo(${d.protocolo}, ${d.telefone}) AS ok`)[0]!.ok,
    ).toBe(false);

    await api`UPDATE demanda SET publicacao_link = 'revogada', segredo_link_hash = 'revogado-1' WHERE id = ${d.id}`;
    const [v] = await publico<{ link_ativo: boolean; segredo_link_hash: string | null }[]>`
      SELECT link_ativo, segredo_link_hash FROM vw_acompanhamento_publico WHERE protocolo = ${d.protocolo}`;
    expect(v).toEqual({ link_ativo: false, segredo_link_hash: null });
    expect(
      (await publico`SELECT consultar_protocolo(${d.protocolo}, ${d.telefone}) AS ok`)[0]!.ok,
    ).toBe(true);

    await api`UPDATE demanda SET publicacao_link = 'ativa', segredo_link_hash = 'novo-hash' WHERE id = ${d.id}`;
    const [n] = await publico<{ segredo_link_hash: string }[]>`
      SELECT segredo_link_hash FROM vw_acompanhamento_publico WHERE protocolo = ${d.protocolo}`;
    expect(n!.segredo_link_hash).toBe('novo-hash');
  });

  it('o link expira dias após o desfecho (aplicado de verdade), e não antes', async () => {
    const d = await novaDemanda();
    const conclusao = await etapaDe('conclusao');
    const entrada = await etapaDe('entrada');
    // Concluída há 10 dias, com expiração padrão de 90: ainda vale.
    await mover(d.id, conclusao, entrada, new Date(Date.now() - 10 * 86_400_000).toISOString());
    expect(await aparece(d.protocolo)).toBe(true);

    // Política de 7 dias: o mesmo desfecho agora já expirou.
    await api`UPDATE politica_publicacao SET vigente_ate = now() WHERE vigente_ate IS NULL`;
    await api`INSERT INTO politica_publicacao (expiracao_dias) VALUES (7)`;
    expect(await aparece(d.protocolo)).toBe(false);
    expect(
      (await publico`SELECT consultar_protocolo(${d.protocolo}, ${d.telefone}) AS ok`)[0]!.ok,
    ).toBe(false);

    // Demanda em andamento nunca expira.
    const aberta = await novaDemanda();
    expect(await aparece(aberta.protocolo)).toBe(true);
  });

  it('a consulta por protocolo exige o telefone certo e a pessoa ativa', async () => {
    const d = await novaDemanda();
    const ok = (p: string, t: string) => publico`SELECT consultar_protocolo(${p}, ${t}) AS ok`;
    expect((await ok(d.protocolo, d.telefone))[0]!.ok).toBe(true);
    expect((await ok(d.protocolo, '67900000000'))[0]!.ok).toBe(false);
    expect((await ok('K7M2ZZZZZZZZ', d.telefone))[0]!.ok).toBe(false);
  });
});

describe('etapas visíveis ao cidadão (3.6)', () => {
  it('só as de rótulo público, sem o nome interno; concluídas com data, previstas sem data', async () => {
    const d = await novaDemanda();
    await dono`UPDATE etapa SET visivel_publico = false, rotulo_publico = NULL`;
    const t = await api<{ id: number }[]>`
      SELECT e.id FROM etapa e JOIN tipo_processo tp ON tp.id = e.tipo_processo_id
      WHERE tp.tipo = 'demanda' ORDER BY e.ordem`;
    expect(t.length).toBeGreaterThanOrEqual(4);
    const [primeira, , terceira, quarta] = t.map((x) => Number(x.id)) as [
      number,
      number,
      number,
      number,
    ];
    await dono`UPDATE etapa SET visivel_publico = true, rotulo_publico = 'Recebida' WHERE id = ${primeira}`;
    await dono`UPDATE etapa SET visivel_publico = true, rotulo_publico = 'Em análise' WHERE id = ${terceira}`;
    await dono`UPDATE etapa SET visivel_publico = true, rotulo_publico = 'Encerrada' WHERE id = ${quarta}`;

    const linhas = () =>
      publico<{ rotulo: string; estado: string; data_em: Date | null }[]>`
        SELECT rotulo, estado, data_em FROM vw_acompanhamento_etapas WHERE protocolo = ${d.protocolo} ORDER BY ordem`;
    const inicial = await linhas();
    expect(inicial.map((l) => [l.rotulo, l.estado])).toEqual([
      ['Recebida', 'atual'],
      ['Em análise', 'prevista'],
      ['Encerrada', 'prevista'],
    ]);
    expect(inicial[0]!.data_em).not.toBeNull();
    expect(inicial[1]!.data_em).toBeNull();

    // Vai para uma etapa OCULTA (a segunda): a "atual" continua sendo a última visível já alcançada.
    const segunda = Number(t[1]!.id);
    await mover(d.id, segunda, primeira);
    expect((await linhas()).map((l) => [l.rotulo, l.estado])).toEqual([
      ['Recebida', 'atual'],
      ['Em análise', 'prevista'],
      ['Encerrada', 'prevista'],
    ]);

    await mover(d.id, terceira, segunda);
    expect((await linhas()).map((l) => [l.rotulo, l.estado])).toEqual([
      ['Recebida', 'concluida'],
      ['Em análise', 'atual'],
      ['Encerrada', 'prevista'],
    ]);

    // Cancelada: nada de "previsto".
    await api`UPDATE demanda SET cancelada_em = now(), cancelada_por = ${usuarioId}, justificativa_cancelamento = 'Pedido duplicado do cidadão' WHERE id = ${d.id}`;
    expect((await linhas()).every((l) => l.estado !== 'prevista')).toBe(true);
    const [v] = await publico<{ situacao: string }[]>`
      SELECT situacao FROM vw_acompanhamento_publico WHERE protocolo = ${d.protocolo}`;
    expect(v!.situacao).toBe('cancelada');
  });
});

describe('andamentos publicados', () => {
  it('só os publicados aparecem; remover marca e esconde, mas a linha e o texto ficam', async () => {
    const d = await novaDemanda();
    const [a] = await api<{ id: number }[]>`
      INSERT INTO andamento_publicado (demanda_id, texto, autor_id) VALUES (${d.id}, 'Equipe vistoriou o local.', ${usuarioId}) RETURNING id`;
    await api`INSERT INTO andamento_publicado (demanda_id, texto, autor_id) VALUES (${d.id}, 'Poda agendada.', ${usuarioId})`;
    const lista = () =>
      publico<
        { texto: string }[]
      >`SELECT texto FROM vw_acompanhamento_andamentos WHERE protocolo = ${d.protocolo} ORDER BY publicado_em, texto`;
    expect((await lista()).map((x) => x.texto)).toHaveLength(2);

    await expect(
      api`UPDATE andamento_publicado SET texto = 'outro' WHERE id = ${a!.id}`,
    ).rejects.toThrow(/só pode ser marcado como removido/);
    await expect(dono`DELETE FROM andamento_publicado`).rejects.toThrow(/não se apaga/);
    await api`UPDATE andamento_publicado SET situacao = 'removido', removido_por = ${usuarioId}, removido_em = now() WHERE id = ${a!.id}`;
    expect((await lista()).map((x) => x.texto)).toEqual(['Poda agendada.']);
    const [guardado] = await api<
      { texto: string }[]
    >`SELECT texto FROM andamento_publicado WHERE id = ${a!.id}`;
    expect(guardado!.texto).toBe('Equipe vistoriou o local.');
    await expect(
      api`UPDATE andamento_publicado SET situacao = 'publicado', removido_por = NULL, removido_em = NULL WHERE id = ${a!.id}`,
    ).rejects.toThrow(/só pode ser marcado como removido/);
  });
});

describe('acesso do cidadão na trilha e descadastro (3.10, 3.13)', () => {
  it('cada acesso vira ocorrência na trilha, sem dado do visitante, e o público não escreve na trilha', async () => {
    const d = await novaDemanda();
    await publico`SELECT registrar_acesso_publico(${d.protocolo}, 'link')`;
    await publico`SELECT registrar_acesso_publico(${d.protocolo}, 'invalido')`;
    const linhas = await api<
      { origem: string; operacao: string; autor_id: string | null; valor_novo: unknown }[]
    >`
      SELECT origem, operacao, autor_id, valor_novo FROM trilha WHERE operacao = 'publico.acompanhar'`;
    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toMatchObject({
      origem: 'publico',
      autor_id: null,
      valor_novo: { via: 'link' },
    });
  });

  it('o descadastro cancela o consentimento, cancela os envios pendentes e deixa registro', async () => {
    const d = await novaDemanda({ email: 'maria@exemplo.test' });
    await api`INSERT INTO consentimento_notificacao (pessoa_id, consentido, registrado_por, origem, versao_texto)
              VALUES (${d.pessoaId}, true, ${usuarioId}, 'atendimento_telefonico', 1)`;
    await api`INSERT INTO envio_notificacao (pessoa_id, demanda_id, evento, descadastro_hash) VALUES (${d.pessoaId}, ${d.id}, 'andamento_publicado', 'tok-1')`;
    await api`INSERT INTO envio_notificacao (pessoa_id, demanda_id, evento, descadastro_hash, estado, enviado_em) VALUES (${d.pessoaId}, ${d.id}, 'conclusao', 'tok-0', 'enviado', now())`;

    expect((await publico`SELECT descadastrar_por_token('inexistente') AS ok`)[0]!.ok).toBe(false);
    expect((await publico`SELECT descadastrar_por_token('tok-1') AS ok`)[0]!.ok).toBe(true);
    expect((await publico`SELECT descadastrar_por_token('tok-1') AS ok`)[0]!.ok).toBe(true); // idempotente

    const historico = await api<{ consentido: boolean; origem: string }[]>`
      SELECT consentido, origem FROM consentimento_notificacao WHERE pessoa_id = ${d.pessoaId} ORDER BY id`;
    expect(historico).toEqual([
      { consentido: true, origem: 'atendimento_telefonico' },
      { consentido: false, origem: 'descadastro_cidadao' },
    ]);
    const estados = await api<
      { estado: string }[]
    >`SELECT estado FROM envio_notificacao ORDER BY id`;
    expect(estados.map((e) => e.estado)).toEqual(['cancelado', 'enviado']);
    expect(
      await api`SELECT 1 FROM trilha WHERE operacao = 'consentimento.descadastrar' AND origem = 'publico'`,
    ).toHaveLength(1);
  });
});

describe('consentimento e fila de envio', () => {
  it('o histórico só acrescenta; "sim" exige versão do texto e quem registrou', async () => {
    const d = await novaDemanda();
    await expect(
      api`INSERT INTO consentimento_notificacao (pessoa_id, consentido, origem) VALUES (${d.pessoaId}, true, 'atendimento_telefonico')`,
    ).rejects.toThrow(/consentimento_sim_completo/);
    await api`INSERT INTO consentimento_notificacao (pessoa_id, consentido, registrado_por, origem, versao_texto)
              VALUES (${d.pessoaId}, true, ${usuarioId}, 'atendimento_presencial', 1)`;
    await expect(dono`UPDATE consentimento_notificacao SET consentido = false`).rejects.toThrow(
      /só aceita acréscimos/,
    );
    await expect(dono`DELETE FROM consentimento_notificacao`).rejects.toThrow(
      /só aceita acréscimos/,
    );
  });

  it('o worker só atualiza o envio; não lê pessoa nem demanda, e vê pela visão', async () => {
    const worker = banco.conectar('worker').cliente;
    const d = await novaDemanda({ email: 'maria@exemplo.test' });
    await api`INSERT INTO envio_notificacao (pessoa_id, demanda_id, evento, descadastro_hash) VALUES (${d.pessoaId}, ${d.id}, 'conclusao', 'tok-w')`;
    await expect(worker`SELECT * FROM pessoa`).rejects.toThrow(/permission denied/);
    await expect(worker`SELECT * FROM demanda`).rejects.toThrow(/permission denied/);
    await expect(worker`DELETE FROM envio_notificacao`).rejects.toThrow(/permission denied/);
    const [v] = await worker<
      { email: string; primeiro_nome: string; consentimento_vigente: boolean }[]
    >`
      SELECT email, primeiro_nome, consentimento_vigente FROM vw_envio_para_enviar`;
    expect(v).toEqual({
      email: 'maria@exemplo.test',
      primeiro_nome: 'Maria',
      consentimento_vigente: false,
    });
    await worker`UPDATE envio_notificacao SET estado = 'enviando', tentativas = 1`;
    await worker`SELECT marcar_email_invalido(${d.pessoaId})`;
    const [p] = await api<
      { email_invalido: boolean }[]
    >`SELECT email_invalido FROM pessoa WHERE id = ${d.pessoaId}`;
    expect(p!.email_invalido).toBe(true);
  });
});

describe('demanda cancelada e o link', () => {
  it('a gestão do link continua possível depois do cancelamento; o resto não', async () => {
    const d = await novaDemanda();
    await api`UPDATE demanda SET cancelada_em = now(), cancelada_por = ${usuarioId}, justificativa_cancelamento = 'Pedido duplicado do cidadão' WHERE id = ${d.id}`;
    await api`UPDATE demanda SET publicacao_link = 'revogada', segredo_link_hash = 'rev-x' WHERE id = ${d.id}`;
    await expect(api`UPDATE demanda SET titulo = 'Outro' WHERE id = ${d.id}`).rejects.toThrow(
      /Demanda cancelada/,
    );
  });
});
