import type { Perfil, RespostaDaSessao } from '@gabinete/compartilhado';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderizar, sessaoDe, simularApi } from '../teste/auxiliares';

const pontos = Array.from({ length: 30 }, (_, i) => ({
  dia: `2026-10-${String(14 + i).padStart(2, '0')}`.replace(/-(3[2-9]|[4-9]\d)$/, '-30'),
  recebidas: i === 29 ? 3 : 0,
  concluidas: i === 29 ? 1 : 0,
}));

const sessao = (perfil: Perfil, habilitacoes: readonly string[]): RespostaDaSessao => {
  const base = sessaoDe(perfil);
  return { ...base, usuario: { ...base.usuario, habilitacoes: habilitacoes as never } };
};

const rotas = (s: RespostaDaSessao, extras: Record<string, unknown> = {}) => ({
  'GET /api/acesso/sessao': { corpo: s },
  'GET /api/gabinete': { status: 404, corpo: { codigo: 'nao_encontrado', mensagem: 'x' } },
  'GET /api/equipe': { corpo: [] },
  'GET /api/avisos': { corpo: { itens: [], naoLidos: 0 } },
  'GET /api/painel/atividade': { corpo: [] },
  'GET /api/painel/tarefas': {
    corpo: { abertas: 5, atrasadas: 2, minhasAbertas: 3, minhasAtrasadas: 1 },
  },
  'GET /api/painel/atendimento': {
    corpo: {
      abertas: 12,
      atrasadas: 3,
      paradas: 2,
      limiteParadoDias: 14,
      novasNaSemana: 5,
      concluidasNoMes: 7,
      minhasAbertas: 4,
      porEtapa: [
        { id: 1, nome: 'Recebida', papel: 'entrada', total: 8 },
        { id: 2, nome: 'Em andamento', papel: 'intermediaria', total: 4 },
      ],
    },
  },
  'GET /api/painel/atendimento/tendencia': {
    corpo: { dias: 30, pontos, totalRecebidas: 3, totalConcluidas: 1 },
  },
  'GET /api/painel/pendencias': {
    corpo: {
      tarefas: [],
      totalDeTarefas: 0,
      demandas: [
        {
          id: 9,
          protocolo: 'AB12-CD34-EF56',
          titulo: 'Aposentadoria parada no INSS',
          prazo: '2026-11-01',
          atrasada: true,
          etapa: 'Em andamento',
        },
      ],
      totalDeDemandas: 1,
    },
  },
  'GET /api/agenda/proximos?limite=5': {
    corpo: {
      itens: [
        {
          tipo: 'compromisso',
          id: 4,
          titulo: 'Sessão do Plenário',
          descricao: null,
          local: 'Câmara dos Deputados',
          inicio: '2026-11-23T11:30:00.000Z',
          fim: '2026-11-23T13:00:00.000Z',
          diaInteiro: false,
          visibilidade: 'aberto',
          envolveParlamentar: true,
          criador: 'Alguém',
          cancelado: false,
          participantesInternos: [],
          participantesExternos: [],
          minhaResposta: null,
        },
        {
          tipo: 'ocupado',
          inicio: '2026-11-24T14:00:00.000Z',
          fim: '2026-11-24T15:00:00.000Z',
          diaInteiro: false,
        },
      ],
    },
  },
  'GET /api/projetos/consolidado': {
    corpo: {
      emAndamento: 6,
      atrasados: 1,
      concluidos: 2,
      arquivados: 0,
      cancelados: 1,
      minhasEmAndamento: 2,
      porEtapa: [
        { etapaId: 1, nome: 'Em redação', papel: 'entrada', ordem: 1, total: 4 },
        { etapaId: 2, nome: 'Protocolado', papel: 'intermediaria', ordem: 2, total: 0 },
      ],
    },
  },
  'GET /api/painel/financeiro': {
    corpo: {
      saldo: {
        ano: 2026,
        em: '2026-11-12',
        mesDeReferencia: 11,
        meses: [],
        saldoAtual: '10900.00',
        aguardandoAnalise: 2,
        limiteDeAlerta: null,
        abaixoDoLimite: false,
        mesesSemCota: [],
        porCategoria: [],
        porStatus: [],
      },
      emendas: {
        disponibilizado: '100000.00',
        comprometido: '60000.00',
        disponivel: '40000.00',
        utilizado: '20000.00',
        aExecutar: '40000.00',
      },
    },
  },
  'GET /api/painel/equipe': {
    corpo: {
      periodoDias: 30,
      pessoas: [
        {
          id: 1,
          nome: 'Camila Albuquerque',
          perfil: 'supervisor',
          demandasAbertas: 3,
          tarefasAbertas: 2,
          atrasadas: 1,
          concluidasNoPeriodo: 4,
        },
      ],
      porPerfil: [{ perfil: 'supervisor', total: 1 }],
    },
  },
  ...extras,
});

const todas = ['AT', 'AG', 'LG', 'FI'];

describe('painel: o que cada perfil vê', () => {
  it('o Chefe vê os números, os gráficos, a carga da equipe e os atalhos de gestão', async () => {
    simularApi(rotas(sessao('chefe', todas)));
    renderizar('/g/painel');

    expect(await screen.findByRole('heading', { name: 'Painel' })).toBeInTheDocument();
    for (const nome of ['Atendimento', 'Tarefas', 'Projetos de lei']) {
      expect(await screen.findByRole('region', { name: nome })).toBeInTheDocument();
    }
    expect(screen.getByText('Atendimento por dia')).toBeInTheDocument();
    expect(screen.getByText('Projetos por etapa')).toBeInTheDocument();
    expect(await screen.findByText('Carga da equipe')).toBeInTheDocument();
    expect(
      screen.getByRole('list', { name: 'Demandas e tarefas em andamento por pessoa' }),
    ).toBeInTheDocument();

    const atalhos = screen.getByRole('group', { name: 'Atalhos rápidos' });
    expect(
      within(atalhos)
        .getAllByRole('link')
        .map((l) => l.textContent),
    ).toEqual(['Nova demanda', 'Nova tarefa', 'Marcar compromisso', 'Novo projeto de lei']);
    expect(within(atalhos).getByRole('link', { name: 'Novo projeto de lei' })).toHaveAttribute(
      'href',
      '/g/projetos?novo=1',
    );
  });

  it('o Assessor Externo vê só o que é dele: sem projetos, sem carga da equipe, e o atalho de presença primeiro', async () => {
    simularApi(rotas(sessao('assessor_externo', ['AT'])));
    renderizar('/g/painel');

    expect(await screen.findByRole('region', { name: 'Tarefas' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Projetos de lei' })).not.toBeInTheDocument();
    expect(screen.queryByText('Carga da equipe')).not.toBeInTheDocument();
    expect(screen.queryByText('Próximos compromissos')).not.toBeInTheDocument();
    const atalhos = screen.getByRole('group', { name: 'Atalhos rápidos' });
    expect(within(atalhos).getAllByRole('link')[0]).toHaveTextContent('Registrar presença');
    expect(within(atalhos).queryByRole('link', { name: /projeto/i })).not.toBeInTheDocument();
  });

  it('sem a habilitação de atendimento, não há bloco nem gráfico de demandas', async () => {
    simularApi(rotas(sessao('assessor_interno', ['AG'])));
    renderizar('/g/painel');

    expect(await screen.findByRole('region', { name: 'Tarefas' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Atendimento' })).not.toBeInTheDocument();
    expect(screen.queryByText('Atendimento por dia')).not.toBeInTheDocument();
    expect(screen.queryByText('Demandas por etapa')).not.toBeInTheDocument();
    expect(await screen.findByText('Próximos compromissos')).toBeInTheDocument();
  });

  it('cada grupo traz sempre quatro indicadores, e os que pedem atenção ficam marcados', async () => {
    simularApi(rotas(sessao('chefe', todas)));
    renderizar('/g/painel');
    for (const nome of ['Atendimento', 'Tarefas', 'Projetos de lei']) {
      const secao = await screen.findByRole('region', { name: nome });
      await waitFor(() => expect(within(secao).getAllByRole('link'), nome).toHaveLength(4));
    }
    const atendimento = screen.getByRole('region', { name: 'Atendimento' });
    expect(within(atendimento).getByRole('link', { name: /Atrasadas/ })).toHaveClass(
      'indicador--alerta',
    );
    expect(
      within(atendimento).getByRole('link', { name: /Demandas em andamento/ }),
    ).not.toHaveClass('indicador--alerta');
  });
});

describe('painel: pendências, agenda e gráfico', () => {
  it('abre na aba que tem o que fazer e mostra a demanda atrasada em texto', async () => {
    simularApi(rotas(sessao('assessor_interno', todas)));
    renderizar('/g/painel');
    const demanda = await screen.findByRole('link', { name: /Aposentadoria parada no INSS/ });
    expect(demanda).toHaveAttribute('href', '/g/demandas?demanda=9');
    expect(demanda).toHaveTextContent('(atrasada)');
    expect(demanda).toHaveTextContent('AB12-CD34-EF56');
  });

  it('a agenda mostra o compromisso visível e, do que não se vê, só o horário ocupado', async () => {
    simularApi(rotas(sessao('supervisor', todas)));
    renderizar('/g/painel');
    expect(await screen.findByRole('link', { name: /Sessão do Plenário/ })).toHaveAttribute(
      'href',
      '/g/agenda?compromisso=4',
    );
    expect(screen.getByText('Horário ocupado')).toBeInTheDocument();
  });

  it('o gráfico de tendência tem legenda com os totais e os mesmos números em tabela', async () => {
    simularApi(rotas(sessao('supervisor', todas)));
    renderizar('/g/painel');
    const legenda = await screen.findByRole('list', { name: 'Legenda' });
    expect(within(legenda).getByText('Recebidas')).toBeInTheDocument();
    expect(within(legenda).getByText('3')).toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Ver como tabela' }));
    const tabela = screen.getByRole('table');
    expect(within(tabela).getAllByRole('row')).toHaveLength(31); // o cabeçalho e os 30 dias
    expect(screen.getByRole('button', { name: 'Ver o gráfico' })).toBeInTheDocument();
  });

  it('as barras de projetos mostram só as etapas com projeto, com o número em texto', async () => {
    simularApi(rotas(sessao('chefe', todas)));
    renderizar('/g/painel');
    const barras = await screen.findByRole('list', { name: 'Projetos por etapa' });
    expect(within(barras).getAllByRole('listitem')).toHaveLength(1);
    expect(within(barras).getByText('Em redação').closest('li')).toHaveTextContent('4');
  });
});
