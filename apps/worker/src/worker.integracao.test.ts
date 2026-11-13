import { randomBytes } from 'node:crypto';
import { cifrarSegredoDeLink, hashDoSegredoDeLink } from '@gabinete/banco';
import { criarBancoDeTeste, type BancoDeTeste } from '@gabinete/banco/teste';
import type postgres from 'postgres';
import { afterEach, beforeEach, describe, expect, inject, it } from 'vitest';
import { ErroDeEnvio, type CanalDeNotificacao, type MensagemDeEmail } from './canal.js';
import { ProcessadorDeEnvios } from './processador.js';

declare module 'vitest' {
  export interface ProvidedContext {
    urlAdminDeTeste: string;
  }
}

const segredoDaAplicacao = 'segredo-de-teste-com-mais-de-32-caracteres!!';
const alfabeto = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

let banco: BancoDeTeste;
let api: postgres.Sql;
let sql: postgres.Sql;
let usuarioId: number;
let contador = 0;
let relogio = new Date('2026-11-12T15:00:00Z');

class CanalDeTeste implements CanalDeNotificacao {
  readonly enviadas: MensagemDeEmail[] = [];
  falhas: ErroDeEnvio[] = [];
  async enviar(m: MensagemDeEmail) {
    const falha = this.falhas.shift();
    if (falha) throw falha;
    this.enviadas.push(m);
    return { idNoProvedor: `prov-${m.idDoEnvio}` };
  }
}

let canal: CanalDeTeste;

const processador = (extra: { limitePorHora?: number } = {}) =>
  new ProcessadorDeEnvios({
    sql,
    canal,
    segredoDaAplicacao,
    hostnamePublico: 'acompanhe.exemplo.test',
    limitePorHora: extra.limitePorHora ?? 100,
    agora: () => relogio,
  });

beforeEach(async () => {
  relogio = new Date('2026-11-12T15:00:00Z');
  canal = new CanalDeTeste();
  banco = await criarBancoDeTeste(inject('urlAdminDeTeste'));
  api = banco.conectar('api').cliente;
  sql = banco.conectar('worker').cliente;
  const [conta] = await api<{ id: number }[]>`
    INSERT INTO conta_acesso (email, verificador_senha) VALUES ('a@exemplo.test', 'h') RETURNING id`;
  const [u] = await api<{ id: number }[]>`
    INSERT INTO usuario (conta_id, nome, perfil) VALUES (${conta!.id}, 'A', 'administrador') RETURNING id`;
  usuarioId = Number(u!.id);
});

afterEach(async () => {
  await banco.encerrar();
});

/** Uma demanda de pessoa com e-mail e consentimento, e UM envio pendente. */
async function envio(opcoes: { consentido?: boolean; evento?: string; payload?: object } = {}) {
  contador += 1;
  const protocolo = `K7M2${[...String(contador).padStart(8, '0')].map((c) => alfabeto[Number(c)]).join('')}`;
  const segredo = randomBytes(32).toString('base64url');
  const [p] = await api<{ id: number }[]>`
    INSERT INTO pessoa (nome_completo, telefone_normalizado, email)
    VALUES ('Maria da Silva', ${`679${String(contador).padStart(8, '0')}`}, 'maria@exemplo.test') RETURNING id`;
  if (opcoes.consentido ?? true) {
    await api`INSERT INTO consentimento_notificacao (pessoa_id, consentido, registrado_por, origem, versao_texto)
              VALUES (${p!.id}, true, ${usuarioId}, 'atendimento_telefonico', 1)`;
  }
  await api`INSERT INTO protocolo_emitido (protocolo) VALUES (${protocolo})`;
  const [e] = await api<{ id: number }[]>`
    SELECT e.id FROM etapa e JOIN tipo_processo t ON t.id = e.tipo_processo_id
    WHERE t.tipo = 'demanda' AND e.papel = 'entrada'`;
  const [d] = await api<{ id: number }[]>`
    INSERT INTO demanda (protocolo, segredo_link_hash, segredo_link_cifrado, solicitante_id, responsavel_id, autor_id, titulo, etapa_atual_id)
    VALUES (${protocolo}, ${hashDoSegredoDeLink(segredo)}, ${cifrarSegredoDeLink(segredo, segredoDaAplicacao)},
            ${p!.id}, ${usuarioId}, ${usuarioId}, 'TITULO-INTERNO-SECRETO', ${e!.id}) RETURNING id`;
  const token = randomBytes(32).toString('base64url');
  const payload = {
    rotulo: 'Em análise',
    texto: 'Equipe vistoriou o local.',
    descadastro: token,
    ...opcoes.payload,
  };
  const [en] = await api<{ id: number }[]>`
    INSERT INTO envio_notificacao (pessoa_id, demanda_id, evento, payload, descadastro_hash, proxima_tentativa_em)
    VALUES (${p!.id}, ${d!.id}, ${opcoes.evento ?? 'andamento_publicado'}, ${JSON.stringify(payload)}::jsonb, ${hashDoSegredoDeLink(token)}, ${relogio.toISOString()}::timestamptz)
    RETURNING id`;
  return {
    envioId: Number(en!.id),
    pessoaId: Number(p!.id),
    demandaId: Number(d!.id),
    segredo,
    token,
    protocolo,
  };
}

const estadoDe = async (id: number) =>
  (
    await api<
      {
        estado: string;
        tentativas: number;
        erro: string | null;
        proxima_tentativa_em: Date;
        provedor_id_mensagem: string | null;
      }[]
    >`
    SELECT estado, tentativas, erro, proxima_tentativa_em, provedor_id_mensagem FROM envio_notificacao WHERE id = ${id}`
  )[0]!;

describe('envio (critérios 8 e 10)', () => {
  it('envia o e-mail com protocolo, links e texto do andamento, e marca como enviado', async () => {
    const e = await envio();
    const r = await processador().processarLote();
    expect(r).toMatchObject({ reivindicados: 1, enviados: 1, falhas: 0, limitado: false });

    expect(canal.enviadas).toHaveLength(1);
    const m = canal.enviadas[0]!;
    expect(m.para).toBe('maria@exemplo.test');
    expect(m.idDoEnvio).toBe(e.envioId);
    expect(m.texto).toContain(`https://acompanhe.exemplo.test/a/${e.segredo}`);
    expect(m.texto).toContain(`https://acompanhe.exemplo.test/d/${e.token}`);
    expect(m.linkDeDescadastro).toBe(`https://acompanhe.exemplo.test/d/${e.token}`);
    expect(m.texto).toContain('Equipe vistoriou o local.');
    expect(m.texto).toContain(
      `${e.protocolo.slice(0, 4)}-${e.protocolo.slice(4, 8)}-${e.protocolo.slice(8)}`,
    );
    expect(m.texto + m.html + m.assunto).not.toContain('TITULO-INTERNO-SECRETO');

    expect(await estadoDe(e.envioId)).toMatchObject({
      estado: 'enviado',
      tentativas: 1,
      provedor_id_mensagem: `prov-${e.envioId}`,
    });
  });

  it('não reenvia o que já foi enviado, nem o que ainda não venceu', async () => {
    const e = await envio();
    await processador().processarLote();
    await processador().processarLote();
    expect(canal.enviadas).toHaveLength(1);

    const futuro = await envio();
    await api`UPDATE envio_notificacao SET proxima_tentativa_em = ${new Date(relogio.getTime() + 3_600_000).toISOString()}::timestamptz WHERE id = ${futuro.envioId}`;
    await processador().processarLote();
    expect(canal.enviadas).toHaveLength(1);
    expect((await estadoDe(e.envioId)).estado).toBe('enviado');
    expect((await estadoDe(futuro.envioId)).estado).toBe('pendente');
  });

  it('reconfere no último instante: consentimento cancelado depois do ato → cancelado, nada sai', async () => {
    const e = await envio();
    await api`INSERT INTO consentimento_notificacao (pessoa_id, consentido, registrado_por, origem)
              VALUES (${e.pessoaId}, false, ${usuarioId}, 'pedido_ao_gabinete')`;
    const r = await processador().processarLote();
    expect(r).toMatchObject({ cancelados: 1, enviados: 0 });
    expect(canal.enviadas).toEqual([]);
    expect(await estadoDe(e.envioId)).toMatchObject({
      estado: 'cancelado',
      erro: 'Consentimento cancelado',
    });
  });

  it('link suspenso ou revogado, e e-mail inválido, também cancelam', async () => {
    const suspenso = await envio();
    await api`UPDATE demanda SET publicacao_link = 'suspensa' WHERE id = ${suspenso.demandaId}`;
    const invalido = await envio();
    await api`UPDATE pessoa SET email_invalido = true WHERE id = ${invalido.pessoaId}`;
    await processador().processarLote();
    expect((await estadoDe(suspenso.envioId)).erro).toBe('O link de acompanhamento não está ativo');
    expect((await estadoDe(invalido.envioId)).erro).toBe('E-mail marcado como inválido');
    expect(canal.enviadas).toEqual([]);
  });
});

describe('falha do provedor não impede nada e o envio é repetido (critério 10)', () => {
  it('falha temporária: volta para a fila com recuo exponencial, e depois de 5 tentativas falha de vez', async () => {
    const e = await envio();
    const tentarComFalha = async () => {
      canal.falhas = [new ErroDeEnvio('O provedor respondeu 503.', 'temporario')];
      await processador().processarLote();
    };

    await tentarComFalha();
    let s = await estadoDe(e.envioId);
    expect(s).toMatchObject({
      estado: 'pendente',
      tentativas: 1,
      erro: 'O provedor respondeu 503.',
    });
    expect(new Date(s.proxima_tentativa_em).getTime()).toBe(relogio.getTime() + 1 * 60_000);

    // Antes do prazo, nada acontece.
    await processador().processarLote();
    expect((await estadoDe(e.envioId)).tentativas).toBe(1);

    for (const [tentativa, minutos] of [
      [2, 2],
      [3, 4],
      [4, 8],
    ] as const) {
      relogio = new Date(relogio.getTime() + 61 * 60_000);
      await tentarComFalha();
      s = await estadoDe(e.envioId);
      expect(s).toMatchObject({ estado: 'pendente', tentativas: tentativa });
      expect(new Date(s.proxima_tentativa_em).getTime()).toBe(relogio.getTime() + minutos * 60_000);
    }
    relogio = new Date(relogio.getTime() + 61 * 60_000);
    await tentarComFalha();
    expect(await estadoDe(e.envioId)).toMatchObject({ estado: 'falhou', tentativas: 5 });
    expect(canal.enviadas).toEqual([]);
  });

  it('depois de uma falha temporária, o envio acontece no retorno do provedor', async () => {
    const e = await envio();
    canal.falhas = [new ErroDeEnvio('rede', 'temporario')];
    await processador().processarLote();
    relogio = new Date(relogio.getTime() + 2 * 60_000);
    const r = await processador().processarLote();
    expect(r.enviados).toBe(1);
    expect(await estadoDe(e.envioId)).toMatchObject({ estado: 'enviado', tentativas: 2 });
  });

  it('falha permanente: o envio falha, o e-mail da pessoa fica marcado como inválido, e não se tenta mais', async () => {
    const e = await envio();
    canal.falhas = [new ErroDeEnvio('O provedor respondeu 422.', 'permanente')];
    const r = await processador().processarLote();
    expect(r.falhas).toBe(1);
    expect(await estadoDe(e.envioId)).toMatchObject({
      estado: 'falhou',
      erro: 'O provedor respondeu 422.',
    });
    const [p] = await api<
      { email_invalido: boolean }[]
    >`SELECT email_invalido FROM pessoa WHERE id = ${e.pessoaId}`;
    expect(p!.email_invalido).toBe(true);
    relogio = new Date(relogio.getTime() + 3_600_000);
    await processador().processarLote();
    expect(canal.enviadas).toEqual([]);
  });

  it('erro inesperado do canal conta como temporário e não vaza detalhe', async () => {
    const e = await envio();
    canal.enviar = async () => {
      throw new Error('segredo-interno do provedor');
    };
    await processador().processarLote();
    expect(await estadoDe(e.envioId)).toMatchObject({
      estado: 'pendente',
      erro: 'Erro inesperado no envio.',
    });
  });
});

describe('limite de envio por hora (RN-NOT-07) e recuperação', () => {
  it('não envia além do limite por hora; libera quando a hora passa', async () => {
    const ids = [await envio(), await envio(), await envio()];
    const r = await processador({ limitePorHora: 2 }).processarLote();
    expect(r.enviados).toBe(2);
    expect(canal.enviadas).toHaveLength(2);

    const bloqueado = await processador({ limitePorHora: 2 }).processarLote();
    expect(bloqueado).toMatchObject({ limitado: true, enviados: 0 });
    expect((await estadoDe(ids[2]!.envioId)).estado).toBe('pendente');

    relogio = new Date(relogio.getTime() + 61 * 60_000);
    expect((await processador({ limitePorHora: 2 }).processarLote()).enviados).toBe(1);
    expect(canal.enviadas).toHaveLength(3);
  });

  it('envio que ficou "enviando" (processo caiu) volta para a fila depois do prazo', async () => {
    const e = await envio();
    await api`UPDATE envio_notificacao SET estado = 'enviando', tentativas = 1, proxima_tentativa_em = ${new Date(relogio.getTime() + 600_000).toISOString()}::timestamptz WHERE id = ${e.envioId}`;
    await processador().processarLote();
    expect(canal.enviadas).toHaveLength(0); // ainda dentro do prazo de 10 minutos

    relogio = new Date(relogio.getTime() + 11 * 60_000);
    await processador().processarLote();
    expect(canal.enviadas).toHaveLength(1);
    expect((await estadoDe(e.envioId)).estado).toBe('enviado');
  });

  it('dois workers ao mesmo tempo não enviam o mesmo e-mail duas vezes', async () => {
    for (let i = 0; i < 6; i += 1) await envio();
    await Promise.all([processador().processarLote(), processador().processarLote()]);
    const ids = canal.enviadas.map((m) => m.idDoEnvio);
    expect(ids).toHaveLength(6);
    expect(new Set(ids).size).toBe(6);
  });
});
