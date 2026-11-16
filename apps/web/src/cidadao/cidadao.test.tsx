import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderizar, simularApi } from '../teste/auxiliares';
import {
  abrirFicha,
  abrirMenuDoLink,
  acompanhamento,
  base,
  consentimento,
  ficha,
} from './auxiliares';

describe('acompanhamento do cidadão na ficha', () => {
  it('mostra o estado do link em TEXTO, o link, a prévia e os andamentos, com a marca dos removidos', async () => {
    simularApi(base());
    const gaveta = await abrirFicha();

    expect(await within(gaveta).findByText('Link ativo')).toBeInTheDocument();
    expect(
      within(gaveta).getByText('https://acompanhe.exemplo.test/a/segredo-do-link'),
    ).toBeInTheDocument();
    expect(within(gaveta).getByText(/Quem tiver o link acompanha/)).toBeInTheDocument();
    expect(within(gaveta).getAllByText('Equipe vistoriou o local.').length).toBeGreaterThan(0);
    expect(within(gaveta).getByText(/Removido por Fulano de Tal/)).toBeInTheDocument();
    expect(within(gaveta).queryByText('Texto apagado.')).not.toBeInTheDocument();
  });

  it('a prévia traz só o que o cidadão vê, e nunca prioridade nem responsável', async () => {
    simularApi(base());
    const gaveta = await abrirFicha();
    const detalhes = within(gaveta)
      .getByText('O que o cidadão vê agora')
      .closest('details') as HTMLElement;
    const textoDaPrevia = within(detalhes).getByLabelText('Pré-visualização do que o cidadão vê');
    expect(textoDaPrevia).toHaveTextContent('K7M2-9PQ4-XA37');
    expect(textoDaPrevia).toHaveTextContent('Solicitante: Maria');
    expect(textoDaPrevia).toHaveTextContent('próxima etapa');
    expect(textoDaPrevia).not.toHaveTextContent(/Média|Fulano de Tal|prioridade/i);
  });

  it('o Supervisor gere o link; o Assessor Interno só vê e publica', async () => {
    simularApi(base('supervisor'));
    const gaveta = await abrirFicha();
    const menu = within(await abrirMenuDoLink(gaveta));
    for (const nome of ['Suspender link', 'Gerar novo link', 'Revogar link']) {
      expect(menu.getByRole('menuitem', { name: nome })).toBeInTheDocument();
    }
  });

  it('o Assessor Interno não vê os botões de gestão do link', async () => {
    simularApi(base('assessor_interno'));
    const gaveta = await abrirFicha();
    expect(
      within(gaveta).queryByRole('button', { name: 'Gerenciar o link' }),
    ).not.toBeInTheDocument();
    expect(
      within(gaveta).getByRole('button', { name: 'Publicar para o cidadão' }),
    ).toBeInTheDocument();
    expect(
      within(gaveta).queryByRole('button', { name: 'Remover andamento' }),
    ).not.toBeInTheDocument();
  });

  it('o Assessor Externo não vê o bloco (a ficha é reduzida)', async () => {
    simularApi(
      base('assessor_externo', { 'GET /api/demandas/7': { corpo: ficha({ completa: false }) } }),
    );
    renderizar('/g/demandas?demanda=7');
    const gaveta = await screen.findByRole('dialog');
    await within(gaveta).findByText(/Ficha reduzida/);
    expect(within(gaveta).queryByText('Acompanhamento do cidadão')).not.toBeInTheDocument();
  });

  it('suspender chama a API; revogar pede confirmação', async () => {
    const chamadas = simularApi(
      base('supervisor', {
        'POST /api/demandas/7/link/suspender': {
          corpo: acompanhamento({ estado: 'suspensa', previa: null }),
        },
      }),
    );
    const usuario = userEvent.setup();
    const gaveta = await abrirFicha();
    await abrirMenuDoLink(gaveta);
    await usuario.click(screen.getByRole('menuitem', { name: 'Suspender link' }));
    await waitFor(() =>
      expect(chamadas.some((c) => c.caminho === '/api/demandas/7/link/suspender')).toBe(true),
    );

    await abrirMenuDoLink(gaveta);
    await usuario.click(screen.getByRole('menuitem', { name: 'Revogar link' }));
    const confirmacao = await screen.findByRole('dialog', { name: 'Revogar o link?' });
    await usuario.click(within(confirmacao).getByRole('button', { name: 'Cancelar' }));
    expect(chamadas.some((c) => c.caminho === '/api/demandas/7/link/revogar')).toBe(false);
    await abrirMenuDoLink(gaveta);
    await usuario.click(screen.getByRole('menuitem', { name: 'Revogar link' }));
    await usuario.click(
      within(await screen.findByRole('dialog', { name: 'Revogar o link?' })).getByRole('button', {
        name: 'Revogar link',
      }),
    );
    await waitFor(() =>
      expect(chamadas.some((c) => c.caminho === '/api/demandas/7/link/revogar')).toBe(true),
    );
  });

  it('link revogado: sem link na tela, com a explicação, e a opção de gerar um novo', async () => {
    simularApi(
      base('supervisor', {
        'GET /api/demandas/7/acompanhamento': {
          corpo: acompanhamento({ estado: 'revogada', link: null }),
        },
      }),
    );
    const gaveta = await abrirFicha();
    expect(await within(gaveta).findByText('Link revogado')).toBeInTheDocument();
    expect(within(gaveta).getByText(/consultar pelo protocolo e telefone/)).toBeInTheDocument();
    const menu = within(await abrirMenuDoLink(gaveta));
    expect(menu.queryByRole('menuitem', { name: 'Revogar link' })).not.toBeInTheDocument();
    expect(menu.getByRole('menuitem', { name: 'Gerar novo link' })).toBeInTheDocument();
  });

  it('publicar envia o texto escrito para o cidadão; o botão só habilita com texto', async () => {
    const chamadas = simularApi(
      base('assessor_interno', { 'POST /api/demandas/7/andamentos': { status: 201, corpo: [] } }),
    );
    const usuario = userEvent.setup();
    const gaveta = await abrirFicha();
    const botao = within(gaveta).getByRole('button', { name: 'Publicar para o cidadão' });
    expect(botao).toBeDisabled();
    await usuario.type(
      within(gaveta).getByLabelText('Nova novidade para o cidadão'),
      'Poda agendada para sexta.',
    );
    expect(botao).toBeEnabled();
    await usuario.click(botao);
    await waitFor(() =>
      expect(chamadas.some((c) => c.caminho === '/api/demandas/7/andamentos')).toBe(true),
    );
    expect(chamadas.find((c) => c.caminho === '/api/demandas/7/andamentos')?.corpo).toEqual({
      texto: 'Poda agendada para sexta.',
    });
  });

  it('demanda cancelada: sem formulário de novidade e sem remover, mas o link segue gerenciável', async () => {
    simularApi(
      base('supervisor', {
        'GET /api/demandas/7': {
          corpo: ficha({
            status: 'cancelada',
            canceladaEm: '2026-11-12T18:00:00.000Z',
            justificativaCancelamento: 'Pedido duplicado do cidadão',
          }),
        },
      }),
    );
    const gaveta = await abrirFicha();
    expect(within(gaveta).queryByLabelText('Nova novidade para o cidadão')).not.toBeInTheDocument();
    expect(
      within(gaveta).queryByRole('button', { name: 'Remover andamento' }),
    ).not.toBeInTheDocument();
    expect(
      within(await abrirMenuDoLink(gaveta)).getByRole('menuitem', { name: 'Revogar link' }),
    ).toBeInTheDocument();
  });

  it('o Supervisor remove andamento', async () => {
    const chamadas = simularApi(base('supervisor', { 'DELETE /api/andamentos/1': { corpo: [] } }));
    const usuario = userEvent.setup();
    const gaveta = await abrirFicha();
    await usuario.click(await within(gaveta).findByRole('button', { name: 'Remover andamento' }));
    await waitFor(() =>
      expect(chamadas.some((c) => c.metodo === 'DELETE' && c.caminho === '/api/andamentos/1')).toBe(
        true,
      ),
    );
  });
});

describe('consentimento de notificação (LGPD)', () => {
  it('começa desmarcado: o botão só habilita depois de marcar que leu o texto ao cidadão', async () => {
    const chamadas = simularApi(
      base('assessor_interno', {
        'PUT /api/pessoas/10/consentimento': {
          corpo: consentimento({ consentimento: true }).situacao,
        },
      }),
    );
    const usuario = userEvent.setup();
    const gaveta = await abrirFicha();

    expect(await within(gaveta).findByText('Avisos desativados')).toBeInTheDocument();
    expect(within(gaveta).getByText(/Posso avisar o senhor\(a\) por e-mail/)).toBeInTheDocument();
    const caixa = within(gaveta).getByLabelText(/Li o texto ao cidadão/);
    expect(caixa).not.toBeChecked();
    const botao = within(gaveta).getByRole('button', { name: 'Registrar consentimento' });
    expect(botao).toBeDisabled();

    await usuario.click(caixa);
    await usuario.click(botao);
    await waitFor(() => expect(chamadas.some((c) => c.metodo === 'PUT')).toBe(true));
    expect(chamadas.find((c) => c.metodo === 'PUT')?.corpo).toEqual({
      consentido: true,
      origem: 'atendimento_telefonico',
      versaoTexto: 1,
    });
  });

  it('sem e-mail: não oferece o consentimento e explica o que falta', async () => {
    simularApi(
      base('assessor_interno', {
        'GET /api/pessoas/10/consentimento': { corpo: consentimento({ temEmail: false }) },
        'GET /api/demandas/7/acompanhamento': {
          corpo: acompanhamento({
            notificacao: {
              pessoaId: 10,
              temEmail: false,
              emailInvalido: false,
              consentimento: false,
              registradoEm: null,
              origem: null,
            },
          }),
        },
      }),
    );
    const gaveta = await abrirFicha();
    expect(await within(gaveta).findByText('Sem e-mail cadastrado')).toBeInTheDocument();
    expect(
      within(gaveta).queryByRole('button', { name: 'Registrar consentimento' }),
    ).not.toBeInTheDocument();
    expect(within(gaveta).getByText(/Cadastre \(ou corrija\) o e-mail/)).toBeInTheDocument();
  });

  it('com consentimento ativo: mostra data e origem, e permite cancelar a pedido do cidadão', async () => {
    const chamadas = simularApi(
      base('assessor_interno', {
        'GET /api/pessoas/10/consentimento': {
          corpo: {
            situacao: {
              pessoaId: 10,
              temEmail: true,
              emailInvalido: false,
              consentimento: true,
              registradoEm: '2026-11-12T15:00:00.000Z',
              origem: 'atendimento_telefonico',
            },
            historico: [
              {
                id: 1,
                consentido: true,
                origem: 'atendimento_telefonico',
                versaoTexto: 1,
                registradoPor: 'Fulano de Tal',
                registradoEm: '2026-11-12T15:00:00.000Z',
              },
            ],
          },
        },
        'PUT /api/pessoas/10/consentimento': { corpo: consentimento().situacao },
      }),
    );
    const usuario = userEvent.setup();
    const gaveta = await abrirFicha();
    expect(await within(gaveta).findByText('Avisos ativados')).toBeInTheDocument();
    expect(within(gaveta).getAllByText(/Atendimento por telefone/).length).toBeGreaterThan(0);
    await usuario.click(within(gaveta).getByRole('button', { name: /Cancelar consentimento/ }));
    await waitFor(() =>
      expect(chamadas.find((c) => c.metodo === 'PUT')?.corpo).toEqual({
        consentido: false,
        origem: 'atendimento_telefonico',
      }),
    );
  });
});
