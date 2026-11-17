import type { Perfil, RespostaDaSessao } from '@gabinete/compartilhado';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { normalizarDinheiroDigitado } from './componentes/campo-de-dinheiro';
import { renderizar, sessaoDe, simularApi } from './teste/auxiliares';

const sessao = (perfil: Perfil, habilitacoes: readonly string[]): RespostaDaSessao => {
  const base = sessaoDe(perfil);
  return { ...base, usuario: { ...base.usuario, habilitacoes: habilitacoes as never } };
};

const valores = {
  disponibilizado: '100000.00',
  comprometido: '75000.00',
  utilizado: '20000.00',
  disponivel: '25000.00',
  aExecutar: '55000.00',
};

const emenda = (extra: object = {}) => ({
  id: 1,
  identificacao: 'EMD 2026/0001',
  exercicio: 2026,
  tipo: { id: 5, nome: 'Individual' },
  finalidade: 'Ambulância para o município',
  etapa: { id: 1, nome: 'Disponível', papel: 'entrada' },
  status: 'em_andamento',
  responsavel: { id: 1, nome: 'Fulano de Tal' },
  prazoDestinacao: null,
  prazoEmpenho: null,
  prazoExecucao: '2026-12-31',
  atrasada: false,
  valores,
  criadoEm: '2026-11-01T12:00:00.000Z',
  ...extra,
});

const fichaDeEmenda = (extra: object = {}) => ({
  ...emenda(),
  criador: 'Fulano de Tal',
  destinacoes: [
    {
      id: 9,
      beneficiario: { id: 2, nome: 'Prefeitura de Goiânia', cnpj: '11222333000181' },
      valor: '75000.00',
      finalidade: 'Ambulância',
      etapa: { id: 2, nome: 'Indicada', papel: 'intermediaria' },
      executado: '20000.00',
      aExecutar: '55000.00',
      cancelada: false,
      justificativaCancelamento: null,
      criadaPor: 'Fulano de Tal',
      criadaEm: '2026-11-02T12:00:00.000Z',
      execucoes: [
        {
          id: 1,
          valor: '20000.00',
          data: '2026-11-05',
          observacao: null,
          registradoPor: 'Fulano de Tal',
          registradoEm: '2026-11-05T12:00:00.000Z',
        },
      ],
    },
  ],
  historicoDoValor: [{ valor: '100000.00', em: '2026-11-01T12:00:00.000Z', por: 'Fulano de Tal' }],
  canceladaEm: null,
  justificativaCancelamento: null,
  movimentacoes: [
    {
      id: 1,
      de: null,
      para: 'Disponível',
      papelDoDestino: 'entrada',
      autor: 'Fulano de Tal',
      criadaEm: '2026-11-01T12:00:00.000Z',
      observacao: null,
    },
  ],
  ...extra,
});

const baseEmendas = (s: RespostaDaSessao) => ({
  'GET /api/acesso/sessao': { corpo: s },
  'GET /api/gabinete': { status: 404, corpo: { codigo: 'nao_encontrado', mensagem: 'x' } },
  'GET /api/equipe': { corpo: [] },
  'GET /api/emendas/etapas': {
    corpo: [
      { id: 1, nome: 'Disponível', papel: 'entrada', ordem: 1 },
      { id: 2, nome: 'Indicada', papel: 'intermediaria', ordem: 2 },
    ],
  },
  'GET /api/emendas/tipos': {
    corpo: [{ id: 5, natureza: 'tipo_emenda', nome: 'Individual', situacao: 'ativa' }],
  },
  'GET /api/emendas/consolidado': {
    corpo: {
      emAndamento: 3,
      atrasadas: 1,
      concluidas: 0,
      arquivadas: 0,
      canceladas: 0,
      minhasEmAndamento: 2,
      valores,
      porEtapa: [],
    },
  },
  'GET /api/emendas?pagina=1&porPagina=100': {
    corpo: { itens: [emenda()], total: 1, pagina: 1, porPagina: 100 },
  },
  'GET /api/emendas/1': { corpo: fichaDeEmenda() },
});

describe('dinheiro digitado', () => {
  it('normaliza "1.234,56" e "1234.56" para o texto da API', () => {
    expect(normalizarDinheiroDigitado('1.234,56')).toBe('1234.56');
    expect(normalizarDinheiroDigitado('R$ 75.000,5')).toBe('75000.5');
    expect(normalizarDinheiroDigitado('1234.56')).toBe('1234.56');
  });
});

describe('emendas', () => {
  it('mostra o consolidado com os valores em reais e o quadro por etapa', async () => {
    simularApi(baseEmendas(sessao('chefe', ['LG', 'FI'])));
    renderizar('/g/emendas');
    expect(
      await screen.findByRole('heading', { name: 'Emendas parlamentares' }),
    ).toBeInTheDocument();
    const grade = await screen.findByRole('group', { name: 'Consolidado das emendas' });
    expect(within(grade).getByText(/R\$\s*100\.000,00/)).toBeInTheDocument();
    expect(within(grade).getByText(/R\$\s*25\.000,00/)).toBeInTheDocument();
    const coluna = await screen.findByRole('listitem', { name: 'Disponível' });
    expect(within(coluna).getByText('EMD 2026/0001')).toBeInTheDocument();
  });

  it('a ficha mostra os valores derivados, as destinações com as execuções e o histórico do valor', async () => {
    simularApi(baseEmendas(sessao('chefe', ['LG', 'FI'])));
    renderizar('/g/emendas?emenda=1');
    const ficha = await screen.findByRole('dialog', { name: /EMD 2026\/0001/ });
    const barra = await within(ficha).findByRole('img', {
      name: /Utilizado.*20\.000,00.*a executar.*55\.000,00.*disponível.*25\.000,00/,
    });
    expect(barra).toBeInTheDocument();
    expect(within(ficha).getByText('Comprometido')).toBeInTheDocument();
    await userEvent.setup().click(within(ficha).getByRole('tab', { name: /Destinações/ }));
    expect(within(ficha).getByText('Prefeitura de Goiânia')).toBeInTheDocument();
    expect(
      within(ficha).getByText(/Executado.*20\.000,00.*a executar.*55\.000,00/),
    ).toBeInTheDocument();
  });

  it('cadastra a emenda enviando o valor em texto canônico, sem coluna de saldo', async () => {
    const chamadas = simularApi({
      ...baseEmendas(sessao('chefe', ['LG', 'FI'])),
      'POST /api/emendas': { status: 201, corpo: fichaDeEmenda() },
    });
    const usuario = userEvent.setup();
    renderizar('/g/emendas');
    await usuario.click(await screen.findByRole('button', { name: /Nova emenda/ }));
    const form = await screen.findByRole('form', { name: 'Nova emenda' });
    const enviar = within(form).getByRole('button', { name: 'Cadastrar emenda' });
    expect(enviar).toBeDisabled();
    await usuario.type(within(form).getByLabelText(/Identificação/), 'EMD 2026/0009');
    await usuario.type(within(form).getByLabelText(/Finalidade/), 'Reforma da sede');
    await usuario.type(within(form).getByLabelText(/Valor disponibilizado/), '75.000,50');
    await waitFor(() => expect(enviar).toBeEnabled());
    await usuario.click(enviar);
    await waitFor(() =>
      expect(chamadas.some((c) => c.metodo === 'POST' && c.caminho === '/api/emendas')).toBe(true),
    );
    expect(chamadas.find((c) => c.metodo === 'POST')?.corpo).toMatchObject({
      identificacao: 'EMD 2026/0009',
      valor: '75000.50',
      tipoId: 5,
      finalidade: 'Reforma da sede',
    });
  });

  it('recusa valor zero ou com mais de duas casas, e só quem tem LG cadastra; quem só tem FI consulta', async () => {
    simularApi(baseEmendas(sessao('assessor_interno', ['FI'])));
    renderizar('/g/emendas');
    await screen.findByRole('heading', { name: 'Emendas parlamentares' });
    expect(screen.queryByRole('button', { name: /Nova emenda/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Valores em uma data/ })).not.toBeInTheDocument();
  });
});

const despesa = (extra: object = {}) => ({
  id: 7,
  descricao: 'Passagem para Brasília',
  valor: '350.90',
  dataDocumento: '2026-11-05',
  competencia: { ano: 2026, mes: 11 },
  categoria: { id: 1, nome: 'Passagens aéreas' },
  fornecedor: { nome: 'Companhia Aérea', documento: '11.222.333/0001-81' },
  numeroDocumento: 'NF-123',
  etapa: { id: 2, nome: 'Em análise', papel: 'intermediaria' },
  status: 'em_analise',
  consomeSaldo: true,
  responsavel: { id: 1, nome: 'Fulano de Tal' },
  lancadaPor: { id: 2, nome: 'Beltrana' },
  decididaPor: null,
  decididaEm: null,
  decisaoPeloProprioLancador: false,
  motivoReprovacao: null,
  foraDoPrazo: false,
  quantidadeDeComprovantes: 1,
  criadaEm: '2026-11-05T12:00:00.000Z',
  ...extra,
});

const fichaDeDespesa = (extra: object = {}) => ({
  ...despesa(),
  comprovantes: [
    {
      id: 3,
      nome: 'nota.pdf',
      tipo: 'application/pdf',
      tamanho: 2048,
      enviadoPor: 'Beltrana',
      enviadoEm: '2026-11-05T12:00:00.000Z',
    },
  ],
  canceladaEm: null,
  justificativaCancelamento: null,
  competenciaEncerrada: false,
  movimentacoes: [],
  ...extra,
});

const saldo = {
  ano: 2026,
  em: '2026-11-12',
  mesDeReferencia: 11,
  meses: Array.from({ length: 12 }, (_, i) => ({
    mes: i + 1,
    cota: '1000.00',
    consumido: i === 10 ? '350.90' : '0.00',
    cotaAcumulada: `${(i + 1) * 1000}.00`,
    consumidoAcumulado: i === 10 ? '350.90' : '0.00',
    saldo: `${(i + 1) * 1000 - (i === 10 ? 350.9 : 0)}.00`,
    encerrada: false,
  })),
  saldoAtual: '10649.10',
  aguardandoAnalise: 1,
  limiteDeAlerta: null,
  abaixoDoLimite: false,
  mesesSemCota: [],
  porCategoria: [
    { categoriaId: 1, nome: 'Passagens aéreas', consumido: '350.90', tetoMensal: null },
  ],
  porStatus: [],
};

const baseCeap = (s: RespostaDaSessao) => ({
  'GET /api/acesso/sessao': { corpo: s },
  'GET /api/gabinete': { status: 404, corpo: { codigo: 'nao_encontrado', mensagem: 'x' } },
  'GET /api/equipe': { corpo: [] },
  'GET /api/ceap/saldo?ano=2026': { corpo: saldo },
  'GET /api/ceap/etapas': {
    corpo: [
      { id: 3, nome: 'Aprovada', papel: 'intermediaria', ordem: 3 },
      { id: 4, nome: 'Apresentada à Câmara', papel: 'intermediaria', ordem: 4 },
    ],
  },
  'GET /api/ceap/despesas/7': { corpo: fichaDeDespesa() },
});

describe('CEAP', () => {
  it('mostra o saldo derivado, a cota do mês e as despesas em análise', async () => {
    simularApi(baseCeap(sessao('chefe', ['FI'])));
    renderizar('/g/ceap');
    expect(await screen.findByRole('heading', { name: 'CEAP' })).toBeInTheDocument();
    const grade = await screen.findByRole('group', { name: 'Saldo da CEAP' });
    expect(within(grade).getByText(/R\$\s*10\.649,10/)).toBeInTheDocument();
    expect(within(grade).getByText('Aguardando análise')).toBeInTheDocument();
    const tabela = screen.getByRole('table', { name: /Mês a mês em 2026/ });
    expect(within(tabela).getByText('novembro')).toBeInTheDocument();
  });

  it('avisa quando faltam meses sem cota: o saldo não cresce sem cota vigente', async () => {
    simularApi({
      ...baseCeap(sessao('chefe', ['FI'])),
      'GET /api/ceap/saldo?ano=2026': { corpo: { ...saldo, mesesSemCota: [1, 2] } },
    });
    renderizar('/g/ceap');
    expect(await screen.findByText(/A cota mensal não cobre todo o exercício/)).toBeInTheDocument();
    expect(screen.getByText(/janeiro, fevereiro/)).toBeInTheDocument();
  });

  it('as abas de parâmetros e de relatório aparecem só para quem pode', async () => {
    simularApi(baseCeap(sessao('supervisor', ['FI'])));
    renderizar('/g/ceap');
    await screen.findByRole('heading', { name: 'CEAP' });
    expect(screen.queryByRole('button', { name: 'Parâmetros' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Relatório' })).not.toBeInTheDocument();
  });

  it('o Chefe vê o relatório e os parâmetros', async () => {
    simularApi(baseCeap(sessao('chefe', ['FI'])));
    renderizar('/g/ceap');
    await screen.findByRole('heading', { name: 'CEAP' });
    expect(screen.getByRole('button', { name: 'Relatório' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Parâmetros' })).toBeInTheDocument();
  });

  it('quem lançou a despesa não vê "Aprovar": o Supervisor é orientado a pedir a outra pessoa', async () => {
    simularApi({
      ...baseCeap(sessao('supervisor', ['FI'])),
      'GET /api/ceap/despesas/7': {
        corpo: fichaDeDespesa({ lancadaPor: { id: 1, nome: 'Fulano de Tal' } }),
      },
    });
    renderizar('/g/ceap?despesa=7');
    const ficha = await screen.findByRole('dialog', { name: /Passagem para Brasília/ });
    await userEvent.setup().click(await within(ficha).findByRole('tab', { name: /Ações/ }));
    expect(within(ficha).getByText(/Você lançou esta despesa\./)).toBeInTheDocument();
    expect(within(ficha).queryByRole('button', { name: 'Aprovar' })).not.toBeInTheDocument();
  });

  it('Chefe, Administrador e Parlamentar aprovam a própria despesa, com o aviso de que ficará marcada', async () => {
    const chamadas = simularApi({
      ...baseCeap(sessao('chefe', ['FI'])),
      'GET /api/ceap/despesas/7': {
        corpo: fichaDeDespesa({ lancadaPor: { id: 1, nome: 'Fulano de Tal' } }),
      },
      'POST /api/ceap/despesas/7/decidir': {
        corpo: fichaDeDespesa({ status: 'aprovada', decisaoPeloProprioLancador: true }),
      },
    });
    const usuario = userEvent.setup();
    renderizar('/g/ceap?despesa=7');
    const ficha = await screen.findByRole('dialog', { name: /Passagem para Brasília/ });
    await usuario.click(await within(ficha).findByRole('tab', { name: /Ações/ }));
    expect(within(ficha).getByText(/pelo próprio lançador/)).toBeInTheDocument();
    await usuario.click(within(ficha).getByRole('button', { name: 'Aprovar' }));
    await waitFor(() =>
      expect(chamadas.some((c) => c.caminho === '/api/ceap/despesas/7/decidir')).toBe(true),
    );
    expect(chamadas.find((c) => c.caminho === '/api/ceap/despesas/7/decidir')?.corpo).toEqual({
      decisao: 'aprovar',
    });
  });

  it('reprovar exige o motivo de 10 caracteres', async () => {
    simularApi(baseCeap(sessao('supervisor', ['FI'])));
    const usuario = userEvent.setup();
    renderizar('/g/ceap?despesa=7');
    const ficha = await screen.findByRole('dialog', { name: /Passagem para Brasília/ });
    await usuario.click(await within(ficha).findByRole('tab', { name: /Ações/ }));
    await usuario.click(within(ficha).getByRole('button', { name: 'Reprovar' }));
    const confirmar = within(ficha).getByRole('button', { name: 'Confirmar a reprovação' });
    expect(confirmar).toBeDisabled();
    await usuario.type(within(ficha).getByLabelText(/Motivo da reprovação/), 'curto');
    expect(confirmar).toBeDisabled();
    await usuario.type(within(ficha).getByLabelText(/Motivo da reprovação/), ' agora é longo');
    expect(confirmar).toBeEnabled();
  });

  it('lançar despesa valida o CPF ou CNPJ do fornecedor e envia os caracteres sem pontuação', async () => {
    const chamadas = simularApi({
      ...baseCeap(sessao('assessor_interno', ['FI'])),
      'GET /api/ceap/categorias': {
        corpo: [
          {
            id: 1,
            nome: 'Passagens aéreas',
            itemNorma: null,
            tetoMensal: null,
            comprovanteObrigatorio: true,
            situacao: 'ativa',
          },
        ],
      },
      'GET /api/ceap/despesas?pagina=1&porPagina=25&ano=2026': {
        corpo: { itens: [], total: 0, pagina: 1, porPagina: 25 },
      },
      'POST /api/ceap/despesas': {
        status: 201,
        corpo: fichaDeDespesa({ status: 'lancada', consomeSaldo: false }),
      },
    });
    const usuario = userEvent.setup();
    renderizar('/g/ceap');
    await usuario.click(await screen.findByRole('button', { name: 'Despesas' }));
    await usuario.click(await screen.findByRole('button', { name: /Lançar despesa/ }));
    const form = await screen.findByRole('form', { name: 'Nova despesa' });
    const lancar = within(form).getByRole('button', { name: 'Lançar despesa' });
    await usuario.type(within(form).getByLabelText(/^Valor/), '350,90');
    await usuario.type(within(form).getByLabelText(/Descrição/), 'Passagem para Brasília');
    await usuario.type(within(form).getByLabelText(/^Fornecedor/), 'Companhia Aérea');
    await usuario.type(within(form).getByLabelText(/Número do documento/), 'NF-123');
    await usuario.type(within(form).getByLabelText(/CPF ou CNPJ/), '11.222.333/0001-82');
    await usuario.tab();
    expect(await within(form).findByText(/CPF ou CNPJ inválido/)).toBeInTheDocument();
    expect(lancar).toBeDisabled();
    await usuario.clear(within(form).getByLabelText(/CPF ou CNPJ/));
    await usuario.type(within(form).getByLabelText(/CPF ou CNPJ/), '11.222.333/0001-81');
    await waitFor(() => expect(lancar).toBeEnabled());
    await usuario.click(lancar);
    await waitFor(() =>
      expect(chamadas.some((c) => c.metodo === 'POST' && c.caminho === '/api/ceap/despesas')).toBe(
        true,
      ),
    );
    expect(chamadas.find((c) => c.metodo === 'POST')?.corpo).toMatchObject({
      valor: '350.90',
      fornecedorDocumento: '11222333000181',
      categoriaId: 1,
    });
  });
});
