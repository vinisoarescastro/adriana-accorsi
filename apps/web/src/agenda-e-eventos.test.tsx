import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { hojeNoGabinete } from './formatos';
import { renderizar, simularApi } from './teste/auxiliares';
import { base, compromisso, urlDaAgenda } from './teste/dados-da-agenda';

describe('agenda', () => {
  it('mostra o compromisso inteiro, o horário ocupado e o bloqueio, cada um em texto', async () => {
    const itens = [
      compromisso(1),
      {
        tipo: 'ocupado',
        inicio: `${hojeNoGabinete()}T15:00:00.000Z`,
        fim: `${hojeNoGabinete()}T16:00:00.000Z`,
        diaInteiro: false,
      },
      {
        tipo: 'bloqueio',
        id: 4,
        inicio: `${hojeNoGabinete()}T17:00:00.000Z`,
        fim: `${hojeNoGabinete()}T18:00:00.000Z`,
      },
    ];
    simularApi({
      ...base(),
      [`GET ${urlDaAgenda(hojeNoGabinete())}`]: { corpo: { itens } },
    });
    renderizar('/g/agenda');
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Semana' }));

    expect(await screen.findByRole('button', { name: 'Reunião 1' })).toBeInTheDocument();
    expect(screen.getByText('Horário ocupado')).toBeInTheDocument();
    expect(screen.getByText('Indisponível')).toBeInTheDocument();
    // O horário ocupado não revela título nem local.
    expect(screen.getAllByText(/Reunião/)).toHaveLength(1);
    expect(screen.getAllByText('Câmara')).toHaveLength(1);
  });

  it('o Assessor Externo consulta, mas não vê como marcar nem bloquear', async () => {
    simularApi({
      ...base('assessor_externo'),
      [`GET ${urlDaAgenda(hojeNoGabinete())}`]: { corpo: { itens: [] } },
    });
    renderizar('/g/agenda');
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Semana' }));
    expect(await screen.findByText('Nada marcado neste período.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Novo compromisso' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Bloquear horário' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Minha agenda' })).toBeInTheDocument();
  });

  it('"Minha agenda" pede ao servidor a visão pessoal', async () => {
    const chamadas = simularApi({
      ...base(),
      [`GET ${urlDaAgenda(hojeNoGabinete())}`]: { corpo: { itens: [] } },
      [`GET ${urlDaAgenda(hojeNoGabinete(), true)}`]: { corpo: { itens: [compromisso(3)] } },
    });
    const usuario = userEvent.setup();
    renderizar('/g/agenda');
    await usuario.click(await screen.findByRole('button', { name: 'Semana' }));
    await screen.findByText('Nada marcado neste período.');
    await usuario.click(screen.getByRole('button', { name: 'Minha agenda' }));
    expect(await screen.findByRole('button', { name: 'Reunião 3' })).toBeInTheDocument();
    expect(chamadas.some((c) => c.caminho.includes('minha=true'))).toBe(true);
  });

  it('novo compromisso: nasce envolvendo a Parlamentar, e o Interno não vê a opção Restrito', async () => {
    const chamadas = simularApi({
      ...base(),
      [`GET ${urlDaAgenda(hojeNoGabinete())}`]: { corpo: { itens: [] } },
      'POST /api/agenda/compromissos': {
        status: 201,
        corpo: { compromisso: compromisso(8), conflitos: [] },
      },
      'GET /api/agenda/compromissos/8': { corpo: compromisso(8) },
    });
    const usuario = userEvent.setup();
    renderizar('/g/agenda');
    await usuario.click(await screen.findByRole('button', { name: 'Novo compromisso' }));
    const form = await screen.findByRole('form', { name: 'Novo compromisso' });

    expect(within(form).getByLabelText(/Envolve a Parlamentar/)).toBeChecked();
    // O Interno não vê a opção Restrito (é do Supervisor em diante).
    expect(within(form).queryByRole('option', { name: /Restrito/ })).not.toBeInTheDocument();

    await usuario.type(within(form).getByLabelText('Título'), 'Reunião com o prefeito');
    await usuario.type(
      within(form).getByLabelText('Descrição (opcional)'),
      'Pauta: orçamento da saúde.',
    );
    await usuario.click(within(form).getByRole('button', { name: /Participantes da equipe/ }));
    // O menu abre fora do formulário (portal) e a busca filtra pelo nome.
    await usuario.type(screen.getByRole('searchbox'), 'belt');
    expect(screen.queryByRole('checkbox', { name: /Fulano/ })).not.toBeInTheDocument();
    await usuario.click(screen.getByRole('checkbox', { name: /Beltrana/ }));
    expect(within(form).getByRole('button', { name: 'Retirar Beltrana' })).toBeInTheDocument();
    await usuario.click(within(form).getByRole('button', { name: 'Marcar compromisso' }));

    await waitFor(() => expect(chamadas.some((c) => c.metodo === 'POST')).toBe(true));
    const corpo = chamadas.find((c) => c.metodo === 'POST')?.corpo as Record<string, unknown>;
    expect(corpo).toMatchObject({
      titulo: 'Reunião com o prefeito',
      descricao: 'Pauta: orçamento da saúde.',
      visibilidade: 'participantes',
      envolveParlamentar: true,
      participantesInternos: [2],
    });
    expect(String(corpo.inicio)).toMatch(/T09:00:00-03:00$/);
  });

  it('o Supervisor pode escolher Restrito', async () => {
    simularApi({
      ...base('supervisor'),
      [`GET ${urlDaAgenda(hojeNoGabinete())}`]: { corpo: { itens: [] } },
    });
    const usuario = userEvent.setup();
    renderizar('/g/agenda');
    await usuario.click(await screen.findByRole('button', { name: 'Novo compromisso' }));
    const form = await screen.findByRole('form', { name: 'Novo compromisso' });
    expect(within(form).getByRole('option', { name: /Restrito/ })).toBeEnabled();
  });

  it('o participante responde, e a tela explica que a resposta é só informativa', async () => {
    let resposta = 'sem_resposta';
    const chamadas = simularApi({
      ...base(),
      [`GET ${urlDaAgenda(hojeNoGabinete())}`]: { corpo: { itens: [compromisso(5)] } },
      'GET /api/agenda/compromissos/5': () => ({
        corpo: compromisso(5, { minhaResposta: resposta }),
      }),
      'POST /api/agenda/compromissos/5/resposta': () => {
        resposta = 'recusado';
        return {
          corpo: { compromisso: compromisso(5, { minhaResposta: resposta }), conflitos: [] },
        };
      },
    });
    const usuario = userEvent.setup();
    renderizar('/g/agenda?compromisso=5');
    const gaveta = await screen.findByRole('dialog');
    expect(await within(gaveta).findByText(/só informativa/)).toBeInTheDocument();
    await usuario.click(within(gaveta).getByRole('button', { name: 'Recusar' }));
    await waitFor(() =>
      expect(chamadas.some((c) => c.caminho === '/api/agenda/compromissos/5/resposta')).toBe(true),
    );
    expect(chamadas.find((c) => c.caminho.endsWith('/resposta'))?.corpo).toEqual({
      resposta: 'recusado',
    });
    expect(await within(gaveta).findByText(/Resposta atual: Recusado/)).toBeInTheDocument();
  });
});

const evento = (id: number, extra: object = {}) => ({
  id,
  nome: `Audiência ${id}`,
  inicio: '2026-11-20T22:00:00.000Z',
  local: 'Câmara',
  situacao: 'aberto',
  encerradoEm: null,
  criador: 'Fulano de Tal',
  presentes: 0,
  ...extra,
});

const fichaDoEvento = (id: number, extra: object = {}) => ({
  ...evento(id),
  presencas: [],
  listaNominalCompleta: false,
  ...extra,
});

const paginaDeEventos = (itens: object[]) => ({
  corpo: { itens, total: itens.length, pagina: 1, porPagina: 25 },
});

describe('eventos e presença', () => {
  it('lista os eventos abertos, com a contagem de presentes', async () => {
    simularApi({
      ...base(),
      'GET /api/eventos?pagina=1&porPagina=25&situacao=aberto': paginaDeEventos([
        evento(1, { presentes: 12 }),
      ]),
    });
    renderizar('/g/eventos');
    const tabela = await screen.findByRole('table');
    expect(within(tabela).getByText('Audiência 1')).toBeInTheDocument();
    expect(within(tabela).getByText('12')).toBeInTheDocument();
    expect(within(tabela).getByText('Aberto')).toBeInTheDocument();
  });

  it('presença de pessoa cadastrada: telefone e um toque (2 toques no total)', async () => {
    const chamadas = simularApi({
      ...base('assessor_externo'),
      'GET /api/eventos?pagina=1&porPagina=25&situacao=aberto': paginaDeEventos([evento(1)]),
      'GET /api/eventos/1': { corpo: fichaDoEvento(1) },
      'POST /api/eventos/1/presencas': {
        status: 201,
        corpo: {
          evento: fichaDoEvento(1, { presentes: 1 }),
          pessoaCriada: false,
        },
      },
    });
    const usuario = userEvent.setup();
    renderizar('/g/eventos?evento=1');
    const gaveta = await screen.findByRole('dialog');

    // Toque 1: o campo de telefone. Toque 2: registrar.
    await usuario.click(await within(gaveta).findByLabelText('Telefone com DDD'));
    await usuario.keyboard('(67) 99999-0000');
    await usuario.click(within(gaveta).getByRole('button', { name: 'Registrar presença' }));

    await waitFor(() => expect(chamadas.some((c) => c.metodo === 'POST')).toBe(true));
    expect(chamadas.find((c) => c.metodo === 'POST')?.corpo).toEqual({
      telefone: '(67) 99999-0000',
    });
    expect(await within(gaveta).findByText(/Presença registrada\./)).toBeInTheDocument();
    // Pronto para o próximo: o campo volta vazio.
    expect(within(gaveta).getByLabelText('Telefone com DDD')).toHaveValue('');
  });

  it('pessoa não cadastrada: a API pede o nome e a tela o mostra (3 toques no total)', async () => {
    let tentativas = 0;
    const chamadas = simularApi({
      ...base('assessor_externo'),
      'GET /api/eventos?pagina=1&porPagina=25&situacao=aberto': paginaDeEventos([evento(1)]),
      'GET /api/eventos/1': { corpo: fichaDoEvento(1) },
      'POST /api/eventos/1/presencas': () => {
        tentativas += 1;
        return tentativas === 1
          ? {
              status: 409,
              corpo: {
                codigo: 'conflito',
                mensagem: 'Pessoa não cadastrada: informe o nome.',
                detalhes: ['nome'],
              },
            }
          : {
              status: 201,
              corpo: { evento: fichaDoEvento(1, { presentes: 1 }), pessoaCriada: true },
            };
      },
    });
    const usuario = userEvent.setup();
    renderizar('/g/eventos?evento=1');
    const gaveta = await screen.findByRole('dialog');

    await usuario.click(await within(gaveta).findByLabelText('Telefone com DDD')); // toque 1
    await usuario.keyboard('67999990000');
    await usuario.click(within(gaveta).getByRole('button', { name: 'Registrar presença' })); // toque 2

    // O campo do nome aparece JÁ com o foco: dá para digitar sem tocar nele.
    const nome = await within(gaveta).findByLabelText('Nome completo');
    await waitFor(() => expect(nome).toHaveFocus());
    await usuario.keyboard('Maria da Silva');
    await usuario.click(within(gaveta).getByRole('button', { name: 'Registrar presença' })); // toque 3

    await waitFor(() => expect(tentativas).toBe(2));
    expect(chamadas.filter((c) => c.metodo === 'POST').at(-1)?.corpo).toEqual({
      telefone: '67999990000',
      nome: 'Maria da Silva',
    });
    expect(await within(gaveta).findByText(/Pessoa nova cadastrada/)).toBeInTheDocument();
  });

  it('o Assessor Externo vê só as presenças que registrou, sem remover nem encerrar', async () => {
    simularApi({
      ...base('assessor_externo'),
      'GET /api/eventos?pagina=1&porPagina=25&situacao=aberto': paginaDeEventos([evento(1)]),
      'GET /api/eventos/1': {
        corpo: fichaDoEvento(1, {
          presentes: 5,
          presencas: [
            {
              pessoaId: 3,
              nome: 'Ana',
              telefone: '(67) 91111-0000',
              observacao: null,
              registradoPor: 'Fulano de Tal',
              registradoEm: '2026-11-12T15:00:00.000Z',
              corrigivel: true,
            },
          ],
        }),
      },
    });
    renderizar('/g/eventos?evento=1');
    const gaveta = await screen.findByRole('dialog');
    expect(await within(gaveta).findByText('Presenças que você registrou')).toBeInTheDocument();
    expect(within(gaveta).getByText('Ana')).toBeInTheDocument();
    expect(within(gaveta).getByRole('button', { name: 'Corrigir' })).toBeInTheDocument();
    expect(within(gaveta).queryByRole('button', { name: 'Remover' })).not.toBeInTheDocument();
    expect(
      within(gaveta).queryByRole('button', { name: 'Encerrar evento' }),
    ).not.toBeInTheDocument();
  });

  it('o Supervisor remove com motivo de 10 caracteres e encerra o evento', async () => {
    simularApi({
      ...base('supervisor'),
      'GET /api/eventos?pagina=1&porPagina=25&situacao=aberto': paginaDeEventos([evento(1)]),
      'GET /api/eventos/1': {
        corpo: fichaDoEvento(1, {
          presentes: 1,
          listaNominalCompleta: true,
          presencas: [
            {
              pessoaId: 3,
              nome: 'Ana',
              telefone: '(67) 91111-0000',
              observacao: null,
              registradoPor: 'Beltrana',
              registradoEm: '2026-11-12T15:00:00.000Z',
              corrigivel: true,
            },
          ],
        }),
      },
    });
    const usuario = userEvent.setup();
    renderizar('/g/eventos?evento=1');
    const gaveta = await screen.findByRole('dialog');
    expect(await within(gaveta).findByText('Lista de presença')).toBeInTheDocument();
    await usuario.click(within(gaveta).getByRole('button', { name: 'Remover' }));
    const confirmar = within(gaveta).getByRole('button', { name: 'Confirmar a remoção' });
    expect(confirmar).toBeDisabled();
    await usuario.type(within(gaveta).getByLabelText(/Motivo da remoção/), 'Registrada por engano');
    expect(confirmar).toBeEnabled();
    expect(within(gaveta).getByRole('button', { name: 'Encerrar evento' })).toBeInTheDocument();
  });

  it('evento encerrado: a lista não muda mais, e não há formulário de presença', async () => {
    simularApi({
      ...base('supervisor'),
      'GET /api/eventos?pagina=1&porPagina=25&situacao=aberto': paginaDeEventos([]),
      'GET /api/eventos/1': {
        corpo: fichaDoEvento(1, { situacao: 'encerrado', encerradoEm: '2026-11-21T00:00:00.000Z' }),
      },
    });
    renderizar('/g/eventos?evento=1');
    const gaveta = await screen.findByRole('dialog');
    expect(await within(gaveta).findByText(/Evento encerrado/)).toBeInTheDocument();
    expect(within(gaveta).queryByLabelText('Telefone com DDD')).not.toBeInTheDocument();
  });
});
