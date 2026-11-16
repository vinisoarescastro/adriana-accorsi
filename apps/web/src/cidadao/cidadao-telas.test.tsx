import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderizar, sessaoDe, simularApi } from '../teste/auxiliares';
import { base, ficha, type Perfil } from './auxiliares';

describe('nova demanda com consentimento', () => {
  const abrir = async () => {
    const usuario = userEvent.setup();
    renderizar('/g/demandas');
    await usuario.click(await screen.findByRole('button', { name: 'Nova demanda' }));
    await usuario.type(screen.getByLabelText('Telefone do solicitante'), '(67) 99999-0000');
    await usuario.tab();
    await usuario.type(await screen.findByLabelText('Nome completo'), 'Maria da Silva');
    await usuario.type(screen.getByLabelText('Título'), 'Poda de árvore');
    return usuario;
  };
  const rotas = (extra: Record<string, unknown> = {}) =>
    base('assessor_interno', {
      'GET /api/pessoas/por-telefone?telefone=(67)%2099999-0000': { corpo: { pessoa: null } },
      'POST /api/demandas': {
        status: 201,
        corpo: {
          demanda: ficha(),
          linkDeAcompanhamento: 'https://acompanhe.exemplo.test/a/x',
          pessoaCriada: true,
        },
      },
      ...extra,
    });

  it('o consentimento só aparece com e-mail e começa desmarcado; sem marcar, vai sem consentimento', async () => {
    const chamadas = simularApi(rotas());
    const usuario = await abrir();
    expect(screen.queryByLabelText(/Li o texto ao cidadão/)).not.toBeInTheDocument();

    await usuario.type(screen.getByLabelText('E-mail'), 'maria@exemplo.test');
    const caixa = screen.getByLabelText(/Li o texto ao cidadão/);
    expect(caixa).not.toBeChecked();
    await usuario.click(screen.getByRole('button', { name: 'Registrar demanda' }));
    await screen.findByText(/Demanda registrada/);
    const corpo = chamadas.find((c) => c.metodo === 'POST')?.corpo as {
      solicitante: Record<string, unknown>;
    };
    expect(corpo.solicitante).toEqual({
      nome: 'Maria da Silva',
      telefone: '(67) 99999-0000',
      email: 'maria@exemplo.test',
    });
  });

  it('marcado: envia o consentimento com a versão do texto e a origem', async () => {
    const chamadas = simularApi(rotas());
    const usuario = await abrir();
    await usuario.type(screen.getByLabelText('E-mail'), 'maria@exemplo.test');
    await usuario.click(screen.getByLabelText(/Li o texto ao cidadão/));
    await usuario.click(screen.getByRole('button', { name: 'Registrar demanda' }));
    await screen.findByText(/Demanda registrada/);
    const corpo = chamadas.find((c) => c.metodo === 'POST')?.corpo as {
      solicitante: Record<string, unknown>;
    };
    expect(corpo.solicitante.consentimento).toEqual({
      consentido: true,
      origem: 'atendimento_telefonico',
      versaoTexto: 1,
    });
  });

  it('apagar o e-mail desfaz o consentimento marcado', async () => {
    const chamadas = simularApi(rotas());
    const usuario = await abrir();
    await usuario.type(screen.getByLabelText('E-mail'), 'maria@exemplo.test');
    await usuario.click(screen.getByLabelText(/Li o texto ao cidadão/));
    await usuario.clear(screen.getByLabelText('E-mail'));
    await usuario.click(screen.getByRole('button', { name: 'Registrar demanda' }));
    await screen.findByText(/Demanda registrada/);
    const corpo = chamadas.find((c) => c.metodo === 'POST')?.corpo as {
      solicitante: Record<string, unknown>;
    };
    expect(corpo.solicitante).toEqual({ nome: 'Maria da Silva', telefone: '(67) 99999-0000' });
  });
});

describe('política de publicação (Configurações)', () => {
  const politica = (extra: object = {}) => ({
    vigente: {
      id: 2,
      exibirTitulo: false,
      exibicaoNome: 'primeiro_nome',
      exibicaoTelefone: 'nao_exibir',
      expiracaoDias: 90,
      vigenteDesde: '2026-11-12T15:00:00.000Z',
      vigenteAte: null,
      criadoPor: null,
    },
    anteriores: [
      {
        id: 1,
        exibirTitulo: true,
        exibicaoNome: 'completo',
        exibicaoTelefone: 'mascarado',
        expiracaoDias: 30,
        vigenteDesde: '2026-11-01T15:00:00.000Z',
        vigenteAte: '2026-11-12T15:00:00.000Z',
        criadoPor: 'Fulano de Tal',
      },
    ],
    ...extra,
  });
  const rotas = (perfil: Perfil, extra: Record<string, unknown> = {}) => ({
    ...base(perfil),
    'GET /api/publicacao/politica': { corpo: politica() },
    ...extra,
  });

  it('o Administrador altera: valida o intervalo de dias e envia a nova versão', async () => {
    const chamadas = simularApi(
      rotas('administrador', { 'PUT /api/publicacao/politica': { corpo: politica() } }),
    );
    const usuario = userEvent.setup();
    renderizar('/g/configuracoes?secao=politica');
    const secao = (await screen.findByRole('heading', { name: 'Política de publicação' })).closest(
      'section',
    ) as HTMLElement;
    expect(await within(secao).findByText(/título oculto/)).toBeInTheDocument();

    const dias = within(secao).getByLabelText(/Dias de validade/);
    const salvar = within(secao).getByRole('button', { name: 'Salvar nova versão da política' });
    await usuario.clear(dias);
    await usuario.type(dias, '3');
    expect(salvar).toBeDisabled();
    expect(
      within(secao).getByText('Informe um número inteiro dentro do intervalo.'),
    ).toBeInTheDocument();
    await usuario.clear(dias);
    await usuario.type(dias, '30');
    await usuario.selectOptions(
      within(secao).getByLabelText('Nome do solicitante na página pública'),
      'completo',
    );
    await usuario.click(within(secao).getByLabelText(/Mostrar o título/));
    expect(salvar).toBeEnabled();
    await usuario.click(salvar);
    await waitFor(() => expect(chamadas.find((c) => c.metodo === 'PUT')).toBeDefined());
    expect(chamadas.find((c) => c.metodo === 'PUT')?.corpo).toEqual({
      exibirTitulo: true,
      exibicaoNome: 'completo',
      exibicaoTelefone: 'nao_exibir',
      expiracaoDias: 30,
    });
  });

  it('o Assessor Interno só consulta, com o histórico de versões', async () => {
    simularApi(rotas('assessor_interno'));
    renderizar('/g/configuracoes?secao=politica');
    const secao = (await screen.findByRole('heading', { name: 'Política de publicação' })).closest(
      'section',
    ) as HTMLElement;
    expect(
      await within(secao).findByText('Só o Administrador altera a política.'),
    ).toBeInTheDocument();
    expect(
      within(secao).queryByRole('button', { name: /Salvar nova versão/ }),
    ).not.toBeInTheDocument();
    expect(within(secao).getByText('Versões anteriores (1)')).toBeInTheDocument();
  });

  it('o Assessor Externo não vê a política', async () => {
    simularApi(rotas('assessor_externo'));
    renderizar('/g/configuracoes');
    await screen.findByRole('heading', { name: /Configurações|Gabinete/ });
    expect(screen.queryByText('Política de publicação')).not.toBeInTheDocument();
  });
});

describe('fila de e-mails', () => {
  const fila = {
    itens: [
      {
        id: 3,
        protocolo: 'K7M2-9PQ4-XA37',
        evento: 'andamento_publicado',
        estado: 'pendente',
        tentativas: 1,
        proximaTentativa: '2026-11-12T16:00:00.000Z',
        erro: 'O provedor respondeu 503.',
        criadoEm: '2026-11-12T15:00:00.000Z',
        enviadoEm: null,
      },
      {
        id: 2,
        protocolo: 'K7M2-9PQ4-XA38',
        evento: 'conclusao',
        estado: 'enviado',
        tentativas: 1,
        proximaTentativa: null,
        erro: null,
        criadoEm: '2026-11-12T14:00:00.000Z',
        enviadoEm: '2026-11-12T14:01:00.000Z',
      },
      {
        id: 1,
        protocolo: 'K7M2-9PQ4-XA39',
        evento: 'cancelamento',
        estado: 'falhou',
        tentativas: 5,
        proximaTentativa: null,
        erro: 'O provedor respondeu 422.',
        criadoEm: '2026-11-12T13:00:00.000Z',
        enviadoEm: null,
      },
    ],
    total: 3,
    pagina: 1,
    porPagina: 25,
    porEstado: { pendente: 1, enviando: 0, enviado: 1, falhou: 1, cancelado: 0 },
  };

  it('mostra o resumo por situação e as linhas em TEXTO, sem endereço de e-mail', async () => {
    simularApi({
      ...base('supervisor'),
      'GET /api/notificacoes?pagina=1&porPagina=25': { corpo: fila },
    });
    renderizar('/g/emails');
    const tabela = await screen.findByRole('table');
    expect(within(tabela).getByText(/3 e-mail\(s\), página 1 de 1/)).toBeInTheDocument();
    expect(within(tabela).getByText('Na fila')).toBeInTheDocument();
    expect(within(tabela).getByText('Enviado')).toBeInTheDocument();
    expect(within(tabela).getByText('Falhou')).toBeInTheDocument();
    expect(within(tabela).getByText('O provedor respondeu 422.')).toBeInTheDocument();
    expect(within(tabela).getByText('Cancelamento')).toBeInTheDocument();
    expect(screen.getByLabelText('Resumo por situação')).toHaveTextContent(/Falhou\s*1/);
    expect(document.body).not.toHaveTextContent('@');
  });

  it('filtrar por situação pede ao servidor', async () => {
    const chamadas = simularApi({
      ...base('supervisor'),
      'GET /api/notificacoes?pagina=1&porPagina=25': { corpo: fila },
      'GET /api/notificacoes?pagina=1&porPagina=25&estado=falhou': {
        corpo: { ...fila, itens: [fila.itens[2]], total: 1 },
      },
    });
    const usuario = userEvent.setup();
    renderizar('/g/emails');
    await screen.findByRole('table');
    await usuario.selectOptions(screen.getByLabelText('Situação'), 'falhou');
    await waitFor(() =>
      expect(chamadas.some((c) => c.caminho.includes('estado=falhou'))).toBe(true),
    );
  });

  it('o Assessor Interno não vê a página (nem o item de menu)', async () => {
    // O servidor já não devolve a página para este perfil; o front não a abre.
    simularApi(
      base('assessor_interno', {
        'GET /api/acesso/sessao': {
          corpo: sessaoDe('assessor_interno', { paginas: ['painel', 'demandas', 'pessoas'] }),
        },
      }),
    );
    renderizar('/g/emails');
    expect(
      await screen.findByRole('heading', { name: 'Página não encontrada' }),
    ).toBeInTheDocument();
  });
});

describe('pessoas: avisos por e-mail', () => {
  it('a coluna diz em texto se os avisos estão ativados, desativados, sem e-mail ou recusados', async () => {
    const pessoa = (id: number, extra: object) => ({
      id,
      nomeCompleto: `Pessoa ${id}`,
      telefone: '(67) 99999-0000',
      email: 'p@exemplo.test',
      emailInvalido: false,
      consentimento: false,
      contatos: null,
      endereco: null,
      situacao: 'ativa',
      criadoEm: '2026-11-12T15:00:00.000Z',
      ...extra,
    });
    simularApi({
      ...base('assessor_interno'),
      'GET /api/pessoas?pagina=1&porPagina=25': {
        corpo: {
          itens: [
            pessoa(1, { consentimento: true }),
            pessoa(2, {}),
            pessoa(3, { email: null }),
            pessoa(4, { emailInvalido: true }),
          ],
          total: 4,
          pagina: 1,
          porPagina: 25,
        },
      },
    });
    renderizar('/g/pessoas');
    const tabela = await screen.findByRole('table');
    for (const texto of ['Ativados', 'Desativados', 'Sem e-mail', 'E-mail recusado']) {
      expect(within(tabela).getByText(texto), texto).toBeInTheDocument();
    }
  });
});
