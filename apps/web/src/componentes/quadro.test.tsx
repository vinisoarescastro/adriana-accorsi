import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Quadro } from './quadro';

const colunas = [
  { id: 1, nome: 'A fazer', papel: 'entrada' as const, total: 1, itens: [{ id: 10 }] },
  { id: 2, nome: 'Concluída', papel: 'conclusao' as const, total: 0, itens: [] },
];

const quadro = () =>
  render(
    <Quadro
      rotulo="Quadro de teste"
      colunas={colunas}
      vazio="Nada aqui."
      dados={() => ({ titulo: 'Cartão', prazo: null, atrasada: false, responsaveis: ['Ana'] })}
      aoAbrir={() => undefined}
      podeMover={() => false}
      aoMover={() => undefined}
    />,
  );

afterEach(() => vi.restoreAllMocks());

describe('rolagem horizontal do quadro', () => {
  it('sem o que rolar, não há setas', () => {
    quadro();
    expect(screen.queryByRole('button', { name: 'Ver próximas colunas' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Ver colunas anteriores' })).toBeNull();
  });

  it('com mais colunas do que cabem, a seta para a direita rola uma tela de colunas', async () => {
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(1000);
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(300);
    const rolar = vi.fn();
    HTMLElement.prototype.scrollBy = rolar as unknown as typeof HTMLElement.prototype.scrollBy;

    quadro();
    // Está no começo: só a seta para a frente.
    expect(screen.queryByRole('button', { name: 'Ver colunas anteriores' })).toBeNull();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Ver próximas colunas' }));
    expect(rolar).toHaveBeenCalledWith({ left: 240, behavior: 'smooth' });
  });
});
