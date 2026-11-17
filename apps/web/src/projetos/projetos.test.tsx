import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { abrirGuia, renderizar, sessaoDe, simularApi } from '../teste/auxiliares';
import {
  categorias,
  consolidado,
  etapasDeProjeto,
  fichaDeProjeto,
  resumoDeProjeto,
} from './dados-de-projetos';

const pagina = (itens: object[]) => ({ itens, total: itens.length, pagina: 1, porPagina: 100 });

const base = (perfil: 'chefe' | 'assessor_interno' = 'chefe') => ({
  'GET /api/acesso/sessao': { corpo: sessaoDe(perfil) },
  'GET /api/gabinete': { status: 404, corpo: { codigo: 'nao_encontrado', mensagem: 'x' } },
  'GET /api/equipe': {
    corpo: [
      {
        id: 1,
        nome: 'Fulano de Tal',
        email: 'a@x.test',
        contato: null,
        perfil,
        situacao: 'ativo',
        habilitacoes: ['LG'],
        temFoto: false,
        criadoEm: '2026-11-01T12:00:00.000Z',
      },
    ],
  },
  'GET /api/projetos/etapas': { corpo: etapasDeProjeto },
  'GET /api/projetos/consolidado': { corpo: consolidado },
  'GET /api/legislativo/categorias': { corpo: categorias },
  'GET /api/projetos?pagina=1&porPagina=100': { corpo: pagina([resumoDeProjeto()]) },
  'GET /api/projetos/1': { corpo: fichaDeProjeto() },
});

describe('página de projetos de lei', () => {
  it('mostra o consolidado e o quadro por etapa, com o projeto na etapa certa', async () => {
    simularApi(base());
    renderizar('/g/projetos');

    expect(await screen.findByRole('heading', { name: 'Projetos de lei' })).toBeInTheDocument();
    const grade = await screen.findByRole('group', { name: 'Consolidado dos projetos' });
    expect(within(grade).getByText('Atrasados')).toBeInTheDocument();
    expect(within(grade).getByText('3')).toBeInTheDocument();
    expect(within(grade).getByText('2 sob a sua responsabilidade')).toBeInTheDocument();

    const emRedacao = await screen.findByRole('listitem', { name: 'Em redação' });
    expect(within(emRedacao).getByText('Programa de poda segura')).toBeInTheDocument();
    expect(within(emRedacao).getByText('PL 100/2026 · Projeto de lei')).toBeInTheDocument();
    const protocolado = screen.getByRole('listitem', { name: 'Protocolado' });
    expect(within(protocolado).getByText('Nenhum projeto nesta etapa.')).toBeInTheDocument();
  });

  it('cadastra o projeto com título, ementa e autoria, e abre a ficha', async () => {
    const chamadas = simularApi({
      ...base(),
      'POST /api/projetos': { status: 201, corpo: fichaDeProjeto() },
    });
    const usuario = userEvent.setup();
    renderizar('/g/projetos');
    await usuario.click(await screen.findByRole('button', { name: /Novo projeto/ }));

    const formulario = await screen.findByRole('form', { name: 'Novo projeto de lei' });
    const enviar = within(formulario).getByRole('button', { name: 'Cadastrar projeto' });
    expect(enviar).toBeDisabled();

    await usuario.type(within(formulario).getByLabelText(/Título/), 'Programa de poda segura');
    await usuario.type(within(formulario).getByLabelText(/Ementa/), 'Institui o programa.');
    await usuario.type(within(formulario).getByLabelText(/Autoria/), 'Dep. Adriana Accorsi');
    await waitFor(() => expect(enviar).toBeEnabled());
    await usuario.click(within(formulario).getByLabelText('Saúde'));
    await usuario.click(enviar);

    await waitFor(() =>
      expect(
        chamadas.find((c) => c.metodo === 'POST' && c.caminho === '/api/projetos'),
      ).toBeTruthy(),
    );
    const envio = chamadas.find((c) => c.metodo === 'POST')?.corpo;
    expect(envio).toMatchObject({
      titulo: 'Programa de poda segura',
      ementa: 'Institui o programa.',
      autoria: 'Dep. Adriana Accorsi',
      tipoProposicaoId: 10,
      assuntos: [20],
      coautores: [],
    });
    expect(envio).not.toHaveProperty('numero');
  });
});

describe('ficha do projeto', () => {
  it('mostra os detalhes, a tramitação por comissão e as votações, e o histórico', async () => {
    simularApi(base());
    renderizar('/g/projetos?projeto=1');

    const ficha = await screen.findByRole('dialog', { name: /Programa de poda segura/ });
    expect(
      await within(ficha).findByText('Institui o programa municipal de poda segura.'),
    ).toBeInTheDocument();
    expect(within(ficha).getByText('Beltrano da Silva')).toBeInTheDocument();

    await abrirGuia(ficha, /Tramitação/);
    expect(within(ficha).getByText('CCJC')).toBeInTheDocument();
    expect(within(ficha).getByText(/Favorável\./)).toBeInTheDocument();
    const votacoes = within(within(ficha).getByRole('region', { name: 'Votações' })).getByRole(
      'list',
    );
    expect(within(votacoes).getByText('Aprovado')).toBeInTheDocument();
    expect(within(votacoes).getByText(/Plenário/)).toBeInTheDocument();

    await abrirGuia(ficha, /Histórico/);
    expect(within(ficha).getByText(/Cadastrado em/)).toBeInTheDocument();
  });

  it('registra a votação com a data e o resultado, sem placar', async () => {
    const chamadas = simularApi({
      ...base(),
      'POST /api/projetos/1/votacoes': { status: 201, corpo: fichaDeProjeto() },
    });
    const usuario = userEvent.setup();
    renderizar('/g/projetos?projeto=1');
    const ficha = await screen.findByRole('dialog', { name: /Programa de poda segura/ });
    await abrirGuia(ficha, /Tramitação/);

    const formulario = within(ficha).getByRole('form', { name: 'Registrar votação' });
    expect(within(formulario).queryByLabelText(/placar|votos/i)).toBeNull();
    const registrar = within(formulario).getByRole('button', { name: 'Registrar votação' });
    expect(registrar).toBeDisabled();
    await usuario.type(within(formulario).getByLabelText('Data da votação'), '2026-11-18');
    await usuario.selectOptions(within(formulario).getByLabelText(/Resultado/), 'rejeitado');
    await usuario.click(registrar);

    await waitFor(() =>
      expect(chamadas.find((c) => c.caminho === '/api/projetos/1/votacoes')?.corpo).toEqual({
        data: '2026-11-18',
        resultado: 'rejeitado',
      }),
    );
  });

  it('cancelar exige justificativa de 10 caracteres', async () => {
    const chamadas = simularApi({
      ...base(),
      'POST /api/projetos/1/cancelar': {
        corpo: fichaDeProjeto({ status: 'cancelado', canceladoEm: '2026-11-13T10:00:00.000Z' }),
      },
    });
    const usuario = userEvent.setup();
    renderizar('/g/projetos?projeto=1');
    const ficha = await screen.findByRole('dialog', { name: /Programa de poda segura/ });
    await abrirGuia(ficha, /Ações/);
    await usuario.click(within(ficha).getByRole('button', { name: 'Cancelar projeto' }));

    const confirmar = within(ficha).getByRole('button', { name: 'Confirmar o cancelamento' });
    expect(confirmar).toBeDisabled();
    await usuario.type(within(ficha).getByLabelText(/Justificativa/), 'curta');
    expect(confirmar).toBeDisabled();
    await usuario.type(within(ficha).getByLabelText(/Justificativa/), ' o bastante');
    await usuario.click(confirmar);
    await waitFor(() =>
      expect(chamadas.find((c) => c.caminho === '/api/projetos/1/cancelar')?.corpo).toEqual({
        justificativa: 'curta o bastante',
      }),
    );
  });

  it('quem não é o responsável nem Supervisor lê, mas não vê as ações nem os formulários', async () => {
    simularApi({
      ...base('assessor_interno'),
      'GET /api/projetos/1': {
        corpo: fichaDeProjeto({ responsavel: { id: 99, nome: 'Outra Pessoa' } }),
      },
    });
    renderizar('/g/projetos?projeto=1');
    const ficha = await screen.findByRole('dialog', { name: /Programa de poda segura/ });
    await within(ficha).findByText('Institui o programa municipal de poda segura.');
    expect(within(ficha).queryByRole('tab', { name: /Ações/ })).toBeNull();
    expect(within(ficha).queryByRole('button', { name: 'Editar dados' })).toBeNull();
    await abrirGuia(ficha, /Tramitação/);
    expect(within(ficha).queryByRole('form', { name: 'Registrar votação' })).toBeNull();
  });
});
