import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { hojeNoGabinete } from '../formatos';
import { renderizar, simularApi } from '../teste/auxiliares';
import { base, compromisso, urlDaAgenda } from '../teste/dados-da-agenda';

describe('agenda por mês', () => {
  it('o mês mostra todos os compromissos do dia, e o card abre os detalhes com o sigilo', async () => {
    const hoje = hojeNoGabinete();
    const mes = new Date(`${hoje}T12:00:00Z`);
    const primeiro = new Date(Date.UTC(mes.getUTCFullYear(), mes.getUTCMonth(), 1));
    const domingo = new Date(primeiro);
    domingo.setUTCDate(1 - primeiro.getUTCDay());
    const ultimo = new Date(Date.UTC(mes.getUTCFullYear(), mes.getUTCMonth() + 1, 0));
    const sabado = new Date(ultimo);
    sabado.setUTCDate(ultimo.getUTCDate() + (6 - ultimo.getUTCDay()));
    const q = new URLSearchParams({
      de: `${domingo.toISOString().slice(0, 10)}T00:00:00-03:00`,
      ate: `${sabado.toISOString().slice(0, 10)}T23:59:59-03:00`,
    });
    simularApi({
      ...base(),
      [`GET ${urlDaAgenda(hoje)}`]: { corpo: { itens: [] } },
      [`GET /api/agenda?${q.toString()}`]: {
        corpo: { itens: [compromisso(1), compromisso(2), compromisso(3)] },
      },
      'GET /api/agenda/compromissos/2': {
        corpo: compromisso(2, { visibilidade: 'restrito' }),
      },
    });
    const usuario = userEvent.setup();
    renderizar('/g/agenda');
    expect(await screen.findByRole('button', { name: 'Mês' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(await screen.findByRole('button', { name: 'Reunião 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reunião 2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reunião 3' })).toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: 'Reunião 2' }));
    const modal = await screen.findByRole('dialog');
    expect(await within(modal).findByText('Sigiloso')).toBeInTheDocument();
    expect(within(modal).getByText('Quem está marcado')).toBeInTheDocument();
    expect(within(modal).getByText('Sem resposta')).toBeInTheDocument();
  });
});
