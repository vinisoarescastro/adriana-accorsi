import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { abrirGuia, renderizar, sessaoDe, simularApi } from '../teste/auxiliares';

const naoEncontrado = {
  status: 404,
  corpo: { codigo: 'nao_encontrado', mensagem: 'Não encontrado.' },
};

const resumo = (id: number, extra: object = {}) => ({
  id,
  protocolo: `K7M2-9PQ4-XA3${id}`,
  titulo: `Poda de árvore ${id}`,
  prioridade: 'media',
  prazo: null,
  etapa: { id: 1, nome: 'Recebida', papel: 'entrada' },
  status: 'em_andamento',
  atrasada: false,
  solicitante: { id: 10, nome: 'Maria da Silva' },
  responsavel: { id: 1, nome: 'Fulano de Tal' },
  criadoEm: '2026-11-12T15:00:00.000Z',
  ...extra,
});

const ficha = (id: number, extra: object = {}) => ({
  ...resumo(id),
  descricao: 'Galho caindo na calçada',
  autor: 'Fulano de Tal',
  solicitanteTelefone: '(67) 99999-0000',
  canceladaEm: null,
  justificativaCancelamento: null,
  completa: true,
  comentarios: [
    {
      id: 1,
      autor: { id: 1, nome: 'Fulano de Tal' },
      texto: 'Liguei para a prefeitura',
      criadoEm: '2026-11-12T15:00:00.000Z',
      removido: false,
      removidoPor: null,
      removidoEm: null,
      mencoes: [],
    },
    {
      id: 2,
      autor: { id: 2, nome: 'Beltrana' },
      texto: null,
      criadoEm: '2026-11-12T16:00:00.000Z',
      removido: true,
      removidoPor: 'Fulano de Tal',
      removidoEm: '2026-11-12T17:00:00.000Z',
      mencoes: [],
    },
  ],
  documentos: [
    {
      id: 5,
      nome: 'comprovante.pdf',
      natureza: 'comprovante',
      tipo: 'application/pdf',
      tamanho: 2048,
      enviadoPor: 'Fulano de Tal',
      enviadoEm: '2026-11-12T15:00:00.000Z',
      removido: false,
      removidoEm: null,
    },
  ],
  movimentacoes: [
    {
      id: 1,
      de: null,
      para: 'Recebida',
      papelDoDestino: 'entrada',
      autor: 'Fulano de Tal',
      observacao: null,
      criadaEm: '2026-11-12T15:00:00.000Z',
    },
  ],
  ...extra,
});

const fluxos = [
  {
    tipo: 'demanda',
    nome: 'Demanda',
    etapas: [
      {
        id: 1,
        nomeInterno: 'Recebida',
        ordem: 1,
        papel: 'entrada',
        rotuloPublico: 'Recebida',
        visivelPublico: true,
        prazoPadraoDias: null,
        situacao: 'ativa',
      },
      {
        id: 2,
        nomeInterno: 'Em andamento',
        ordem: 3,
        papel: 'intermediaria',
        rotuloPublico: 'Em andamento',
        visivelPublico: true,
        prazoPadraoDias: 15,
        situacao: 'ativa',
      },
    ],
  },
];

const base = (perfil: 'chefe' | 'assessor_externo' = 'chefe') => ({
  'GET /api/acesso/sessao': { corpo: sessaoDe(perfil) },
  'GET /api/gabinete': naoEncontrado,
  'GET /api/equipe': { corpo: [] },
  'GET /api/fluxos': { corpo: fluxos },
});

const pagina = (itens: object[], total = itens.length) => ({
  corpo: { itens, total, pagina: 1, porPagina: 25 },
});

describe('lista de demandas', () => {
  it('mostra protocolo, situação e atraso em TEXTO (nunca só cor), e o total', async () => {
    simularApi({
      ...base(),
      'GET /api/demandas?pagina=1&porPagina=25': pagina(
        [
          resumo(1),
          resumo(2, { atrasada: true, prioridade: 'urgente', status: 'em_andamento' }),
          resumo(3, { status: 'cancelada' }),
        ],
        3,
      ),
    });
    renderizar('/g/demandas?visao=lista');

    const tabela = await screen.findByRole('table');
    expect(within(tabela).getByText(/3 demanda\(s\), página 1 de 1/)).toBeInTheDocument();
    expect(within(tabela).getByText('K7M2-9PQ4-XA31')).toBeInTheDocument();
    expect(within(tabela).getByText('Atrasada')).toBeInTheDocument();
    expect(within(tabela).getByText('Urgente')).toBeInTheDocument();
    expect(within(tabela).getByText('Cancelada')).toBeInTheDocument();
  });

  it('aplica a busca e o filtro no servidor (a tela não filtra sozinha)', async () => {
    const chamadas = simularApi({
      ...base(),
      'GET /api/demandas?pagina=1&porPagina=25': pagina([resumo(1)]),
      'GET /api/demandas?pagina=1&porPagina=25&busca=poda&status=concluido': pagina([]),
    });
    const usuario = userEvent.setup();
    renderizar('/g/demandas?visao=lista');
    await screen.findByRole('table');

    await usuario.selectOptions(screen.getByLabelText('Situação'), 'concluido');
    await usuario.type(screen.getByLabelText('Buscar'), 'poda{Enter}');

    expect(await screen.findByText('Nenhuma demanda encontrada.')).toBeInTheDocument();
    expect(
      chamadas.some(
        (c) => c.caminho.includes('busca=poda') && c.caminho.includes('status=concluido'),
      ),
    ).toBe(true);
  });

  it('o quadro é a visão padrão e mostra uma coluna por etapa, com o total', async () => {
    simularApi({
      ...base(),
      'GET /api/demandas?pagina=1&porPagina=25': pagina([]),
      'GET /api/demandas/quadro': {
        corpo: {
          limitePorColuna: 30,
          colunas: [
            {
              etapa: { id: 1, nome: 'Recebida', papel: 'entrada', ordem: 1 },
              total: 1,
              itens: [resumo(1)],
            },
            {
              etapa: { id: 2, nome: 'Em andamento', papel: 'intermediaria', ordem: 3 },
              total: 0,
              itens: [],
            },
          ],
        },
      },
    });
    renderizar('/g/demandas');

    // O quadro é a visão padrão.
    const quadro = await screen.findByRole('list', { name: 'Quadro de demandas por etapa' });
    expect(within(quadro).getAllByRole('listitem')).toHaveLength(2);
    expect(within(quadro).getByText('Poda de árvore 1')).toBeInTheDocument();
  });
});

describe('registrar (Maria liga pedindo a poda de uma árvore)', () => {
  it('pessoa nova: busca o telefone, pede o nome, registra e mostra o protocolo', async () => {
    const chamadas = simularApi({
      ...base(),
      'GET /api/demandas?pagina=1&porPagina=25': pagina([]),
      'GET /api/pessoas/por-telefone?telefone=(67)%2099999-0000': { corpo: { pessoa: null } },
      'POST /api/demandas': {
        status: 201,
        corpo: {
          demanda: ficha(7),
          linkDeAcompanhamento: 'https://publico.exemplo.test/a/segredo',
          pessoaCriada: true,
        },
      },
    });
    const usuario = userEvent.setup();
    renderizar('/g/demandas');
    await usuario.click(await screen.findByRole('button', { name: 'Nova demanda' }));

    const telefone = screen.getByLabelText('Telefone do solicitante');
    await usuario.type(telefone, '(67) 99999-0000');
    await usuario.tab();

    await usuario.type(await screen.findByLabelText('Nome completo'), 'Maria da Silva');
    await usuario.type(screen.getByLabelText('Título'), 'Poda de árvore na Rua das Flores');
    await usuario.click(screen.getByRole('button', { name: 'Registrar demanda' }));

    expect(await screen.findByText('K7M2-9PQ4-XA37')).toBeInTheDocument();
    expect(screen.getByText('Demanda registrada.', { exact: false })).toBeInTheDocument();
    const envio = chamadas.find((c) => c.metodo === 'POST' && c.caminho === '/api/demandas');
    expect(envio?.corpo).toMatchObject({
      solicitante: { nome: 'Maria da Silva', telefone: '(67) 99999-0000' },
      titulo: 'Poda de árvore na Rua das Flores',
      prioridade: 'media',
    });
  });

  it('pessoa já cadastrada: usa o cadastro e não pede o nome', async () => {
    const chamadas = simularApi({
      ...base(),
      'GET /api/demandas?pagina=1&porPagina=25': pagina([]),
      'GET /api/pessoas/por-telefone?telefone=67999990000': {
        corpo: {
          pessoa: {
            id: 10,
            nomeCompleto: 'Maria da Silva',
            telefone: '(67) 99999-0000',
            email: null,
            contatos: null,
            endereco: null,
            situacao: 'ativa',
            criadoEm: '2026-11-12T15:00:00.000Z',
          },
        },
      },
      'POST /api/demandas': {
        status: 201,
        corpo: {
          demanda: ficha(8),
          linkDeAcompanhamento: 'https://publico.exemplo.test/a/x',
          pessoaCriada: false,
        },
      },
    });
    const usuario = userEvent.setup();
    renderizar('/g/demandas');
    await usuario.click(await screen.findByRole('button', { name: 'Nova demanda' }));
    await usuario.type(screen.getByLabelText('Telefone do solicitante'), '67999990000');
    await usuario.tab();

    expect(await screen.findByText(/Pessoa já cadastrada: Maria da Silva/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Nome completo')).not.toBeInTheDocument();

    await usuario.type(screen.getByLabelText('Título'), 'Buraco na rua');
    await usuario.click(screen.getByRole('button', { name: 'Registrar demanda' }));
    await screen.findByText('K7M2-9PQ4-XA38');
    expect(chamadas.find((c) => c.metodo === 'POST')?.corpo).toMatchObject({
      solicitante: { pessoaId: 10 },
    });
  });

  it('o Assessor Externo não escolhe o responsável (registra em seu nome)', async () => {
    simularApi({
      ...base('assessor_externo'),
      'GET /api/demandas?pagina=1&porPagina=25': pagina([]),
    });
    const usuario = userEvent.setup();
    renderizar('/g/demandas');
    await usuario.click(await screen.findByRole('button', { name: 'Nova demanda' }));
    expect(screen.queryByLabelText('Responsável')).not.toBeInTheDocument();
  });
});

describe('ficha da demanda', () => {
  it('abre pelo endereço (?demanda=ID) e mostra dados, comentários, documentos e histórico', async () => {
    simularApi({
      ...base(),
      'GET /api/demandas?pagina=1&porPagina=25': pagina([resumo(7)]),
      'GET /api/demandas/7': { corpo: ficha(7) },
    });
    renderizar('/g/demandas?demanda=7');

    const gaveta = await screen.findByRole('dialog');
    expect(await within(gaveta).findByText('Galho caindo na calçada')).toBeInTheDocument();
    expect(within(gaveta).getByText('Liguei para a prefeitura')).toBeInTheDocument();
    expect(within(gaveta).getByText(/Comentário removido por Fulano de Tal/)).toBeInTheDocument();
    await abrirGuia(gaveta, /^Documentos/);
    expect(within(gaveta).getByRole('link', { name: 'comprovante.pdf' })).toHaveAttribute(
      'href',
      '/api/documentos/5/conteudo',
    );
    expect(within(gaveta).getByText(/Recebida em|Registrada em/)).toBeInTheDocument();
  });

  it('o Assessor Externo vê a ficha reduzida, sem comentários, documentos nem histórico', async () => {
    simularApi({
      ...base('assessor_externo'),
      'GET /api/demandas?pagina=1&porPagina=25': pagina([resumo(7)]),
      'GET /api/demandas/7': {
        corpo: ficha(7, { completa: false, comentarios: [], documentos: [], movimentacoes: [] }),
      },
    });
    renderizar('/g/demandas?demanda=7');
    const gaveta = await screen.findByRole('dialog');
    expect(await within(gaveta).findByText(/Ficha reduzida/)).toBeInTheDocument();
    expect(within(gaveta).queryByText('Comentários internos')).not.toBeInTheDocument();
    expect(within(gaveta).queryByText('Documentos')).not.toBeInTheDocument();
  });

  it('cancelar só habilita com justificativa de 10 caracteres ou mais, e a demanda cancelada não oferece ações', async () => {
    let cancelada = false;
    const chamadas = simularApi({
      ...base(),
      'GET /api/demandas?pagina=1&porPagina=25': pagina([resumo(7)]),
      'GET /api/demandas/7': () => ({
        corpo: cancelada ? ficha(7, { status: 'cancelada' }) : ficha(7),
      }),
      'POST /api/demandas/7/cancelar': () => {
        cancelada = true;
        return {
          corpo: ficha(7, { status: 'cancelada' }),
        };
      },
    });
    const usuario = userEvent.setup();
    renderizar('/g/demandas?demanda=7');
    const gaveta = await screen.findByRole('dialog');

    await within(gaveta).findByRole('tab', { name: 'Ações' });
    await abrirGuia(gaveta, 'Ações');
    await usuario.click(await within(gaveta).findByRole('button', { name: 'Cancelar demanda' }));
    const confirmar = within(gaveta).getByRole('button', { name: 'Confirmar o cancelamento' });
    expect(confirmar).toBeDisabled();
    await usuario.type(
      within(gaveta).getByLabelText('Justificativa do cancelamento', { exact: false }),
      'curta',
    );
    expect(confirmar).toBeDisabled();
    await usuario.type(
      within(gaveta).getByLabelText('Justificativa do cancelamento', { exact: false }),
      ' mas agora é suficiente',
    );
    expect(confirmar).toBeEnabled();
    await usuario.click(confirmar);

    await waitFor(() =>
      expect(
        within(gaveta).getByText(/Demanda cancelada\. Ela não se altera mais/),
      ).toBeInTheDocument(),
    );
    expect(chamadas.find((c) => c.caminho === '/api/demandas/7/cancelar')?.corpo).toMatchObject({
      justificativa: 'curta mas agora é suficiente',
    });
    expect(
      within(gaveta).queryByRole('button', { name: 'Cancelar demanda' }),
    ).not.toBeInTheDocument();
    expect(within(gaveta).queryByRole('button', { name: 'Mover' })).not.toBeInTheDocument();
    expect(within(gaveta).queryByLabelText('Novo comentário')).not.toBeInTheDocument();
    expect(
      within(gaveta).queryByLabelText('Anexar documento', { exact: false }),
    ).not.toBeInTheDocument();
  });

  it('comentar envia o texto e as menções', async () => {
    const chamadas = simularApi({
      ...base(),
      'GET /api/equipe': {
        corpo: [
          {
            id: 2,
            nome: 'Beltrana',
            email: 'b@x.test',
            contato: null,
            perfil: 'supervisor',
            situacao: 'ativo',
            habilitacoes: ['AT'],
            temFoto: false,
            criadoEm: '2026-11-12T12:00:00.000Z',
          },
        ],
      },
      'GET /api/demandas?pagina=1&porPagina=25': pagina([resumo(7)]),
      'GET /api/demandas/7': { corpo: ficha(7) },
      'POST /api/demandas/7/comentarios': { status: 201, corpo: [] },
    });
    const usuario = userEvent.setup();
    renderizar('/g/demandas?demanda=7');
    const gaveta = await screen.findByRole('dialog');

    await within(gaveta).findByRole('tab', { name: /^Comentários/ });
    await abrirGuia(gaveta, /^Comentários/);
    await usuario.type(
      await within(gaveta).findByLabelText('Novo comentário'),
      'Precisa de retorno',
    );
    // Digitar @ abre as sugestões; escolher uma insere @Nome no texto.
    await usuario.type(within(gaveta).getByLabelText('Novo comentário'), ' @Belt');
    await usuario.click(await screen.findByRole('option', { name: /Beltrana/ }));
    await usuario.click(within(gaveta).getByRole('button', { name: 'Comentar' }));

    await waitFor(() =>
      expect(chamadas.some((c) => c.caminho === '/api/demandas/7/comentarios')).toBe(true),
    );
    expect(chamadas.find((c) => c.caminho === '/api/demandas/7/comentarios')?.corpo).toEqual({
      texto: 'Precisa de retorno @Beltrana',
      mencoes: [2],
    });
  });
});
