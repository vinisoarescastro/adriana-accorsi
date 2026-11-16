import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { CampoComMencoes, TextoComMencoes, idsMencionados, type Colega } from './mencoes';

const colegas: Colega[] = [
  { id: 2, nome: 'Beltrana Souza', apoio: 'Supervisor', temFoto: false },
  { id: 3, nome: 'Fulano de Tal', apoio: 'Assessor Interno', temFoto: false },
  { id: 4, nome: 'Beto Álvares', apoio: 'Assessor Interno', temFoto: false },
];

function Exemplo({ aoFechar }: { aoFechar?: () => void }) {
  const [texto, setTexto] = useState('');
  return (
    // O Esc de um modal pai não pode ser acionado pelo campo de menções.
    <div onKeyDown={(e) => e.key === 'Escape' && aoFechar?.()}>
      <CampoComMencoes rotulo="Comentário" valor={texto} aoMudar={setTexto} colegas={colegas} />
      <output data-testid="ids">{idsMencionados(texto, colegas).join(',')}</output>
    </div>
  );
}

describe('menções (@Nome)', () => {
  it('digitar @ sugere colegas; Enter insere o nome e o id vai nas menções', async () => {
    const usuario = userEvent.setup();
    render(<Exemplo />);
    const campo = screen.getByLabelText('Comentário');
    await usuario.type(campo, 'Olá @bel');
    // Sem acento e sem diferenciar maiúsculas: "bel" acha Beltrana e Beto não (só Beltrana).
    expect(screen.getAllByRole('option')).toHaveLength(1);
    await usuario.keyboard('{Enter}');
    expect(campo).toHaveValue('Olá @Beltrana Souza ');
    expect(screen.getByTestId('ids')).toHaveTextContent('2');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('as setas escolhem entre várias sugestões, e Esc fecha só a lista', async () => {
    const usuario = userEvent.setup();
    let fechouOModal = false;
    render(<Exemplo aoFechar={() => (fechouOModal = true)} />);
    await usuario.type(screen.getByLabelText('Comentário'), '@');
    expect(screen.getAllByRole('option')).toHaveLength(3);
    await usuario.keyboard('{ArrowDown}');
    expect(screen.getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true');
    await usuario.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(fechouOModal).toBe(false);
  });

  it('clicar numa sugestão insere a menção; um nome que não existe não sugere nada', async () => {
    const usuario = userEvent.setup();
    render(<Exemplo />);
    const campo = screen.getByLabelText('Comentário');
    await usuario.type(campo, '@zzz');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    await usuario.clear(campo);
    await usuario.type(campo, '@Fulano');
    await usuario.click(screen.getByRole('option', { name: /Fulano de Tal/ }));
    expect(campo).toHaveValue('@Fulano de Tal ');
  });

  it('só conta a menção se o nome continua no texto', () => {
    expect(idsMencionados('Falar com @Fulano de Tal', colegas)).toEqual([3]);
    expect(idsMencionados('Falar com Fulano de Tal', colegas)).toEqual([]);
  });

  it('o texto exibido destaca as menções e mantém o resto', () => {
    render(
      <p data-testid="t">
        <TextoComMencoes texto="Oi @Fulano de Tal, veja isto" nomes={['Fulano de Tal', 'Fulano']} />
      </p>,
    );
    const destaque = screen.getByText('@Fulano de Tal');
    expect(destaque).toHaveClass('mencao');
    expect(screen.getByTestId('t')).toHaveTextContent('Oi @Fulano de Tal, veja isto');
  });
});
