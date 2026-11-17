import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderizar, sessaoDe, simularApi } from '../teste/auxiliares';

const beneficiario = (extra: object = {}) => ({
  id: 1,
  nomeFantasia: 'Prefeitura de Exemplo',
  razaoSocial: 'Município de Exemplo',
  cnpj: '11222333000181',
  natureza: 'municipio',
  cep: '79002000',
  logradouro: 'Rua das Flores',
  numero: '100',
  complemento: null,
  bairro: 'Centro',
  cidade: 'Campo Grande',
  estado: 'MS',
  situacao: 'ativo',
  criadoEm: '2026-11-12T15:00:00.000Z',
  ...extra,
});

const base = () => ({
  'GET /api/acesso/sessao': { corpo: sessaoDe('chefe') },
  'GET /api/gabinete': { status: 404, corpo: { codigo: 'nao_encontrado', mensagem: 'x' } },
  'GET /api/beneficiarios?pagina=1&porPagina=25&situacao=ativo': {
    corpo: { itens: [beneficiario()], total: 1, pagina: 1, porPagina: 25 },
  },
});

describe('página de beneficiários', () => {
  it('lista com o CNPJ e o CEP formatados', async () => {
    simularApi(base());
    renderizar('/g/beneficiarios');
    expect(await screen.findByRole('heading', { name: 'Beneficiários' })).toBeInTheDocument();
    expect(await screen.findByText('Prefeitura de Exemplo')).toBeInTheDocument();
    expect(screen.getByText('11.222.333/0001-81')).toBeInTheDocument();
    expect(screen.getByText(/CEP 79002-000/)).toBeInTheDocument();
    expect(screen.getByText('Campo Grande/MS', { exact: false })).toBeInTheDocument();
  });

  async function preencher(usuario: ReturnType<typeof userEvent.setup>, cnpj: string) {
    await usuario.click(await screen.findByRole('button', { name: /Novo beneficiário/ }));
    const formulario = await screen.findByRole('form', { name: 'Novo beneficiário' });
    await usuario.type(within(formulario).getByLabelText(/Nome fantasia/), 'Prefeitura de Exemplo');
    await usuario.type(within(formulario).getByLabelText(/Razão social/), 'Município de Exemplo');
    await usuario.type(within(formulario).getByLabelText(/^CNPJ/), cnpj);
    await usuario.type(within(formulario).getByLabelText(/^CEP/), '79002000');
    await usuario.type(within(formulario).getByLabelText(/Logradouro/), 'Rua das Flores');
    await usuario.type(within(formulario).getByLabelText(/^Número/), '100');
    await usuario.type(within(formulario).getByLabelText(/Bairro/), 'Centro');
    await usuario.type(within(formulario).getByLabelText(/Cidade/), 'Campo Grande');
    return formulario;
  }

  it('recusa CNPJ inválido antes de enviar e mostra o erro', async () => {
    const chamadas = simularApi(base());
    const usuario = userEvent.setup();
    renderizar('/g/beneficiarios');
    const formulario = await preencher(usuario, '11.222.333/0001-82');
    await usuario.tab();
    expect(await within(formulario).findByText(/CNPJ inválido/)).toBeInTheDocument();
    expect(within(formulario).getByRole('button', { name: 'Cadastrar' })).toBeDisabled();
    expect(chamadas.some((c) => c.metodo === 'POST')).toBe(false);
  });

  it('envia o CNPJ e o CEP só com os caracteres, e aceita o CNPJ alfanumérico', async () => {
    const chamadas = simularApi({
      ...base(),
      'POST /api/beneficiarios': { status: 201, corpo: beneficiario() },
    });
    const usuario = userEvent.setup();
    renderizar('/g/beneficiarios');
    const formulario = await preencher(usuario, '12.ABC.345/01DE-35');
    const cadastrar = within(formulario).getByRole('button', { name: 'Cadastrar' });
    await waitFor(() => expect(cadastrar).toBeEnabled());
    await usuario.click(cadastrar);
    await waitFor(() => expect(chamadas.some((c) => c.metodo === 'POST')).toBe(true));
    const corpo = chamadas.find((c) => c.metodo === 'POST')?.corpo;
    expect(corpo).toMatchObject({
      cnpj: '12ABC34501DE35',
      cep: '79002000',
      estado: 'GO',
      natureza: 'municipio',
    });
    expect(corpo).not.toHaveProperty('complemento');
  });
});
