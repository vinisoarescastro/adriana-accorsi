import { paraCentavos } from '@gabinete/compartilhado';
import { Campo } from './ui';

/**
 * O que a pessoa digitou ("1.234,56", "1234,5" ou "1234.56") em texto canônico para a API ("1234.56").
 * Com vírgula, os pontos são separadores de milhar; sem vírgula, o ponto é decimal.
 */
export function normalizarDinheiroDigitado(digitado: string): string {
  const limpo = digitado.replace(/[R$\s]/g, '');
  return limpo.includes(',') ? limpo.replace(/\./g, '').replace(',', '.') : limpo;
}

/** O valor digitado vale (positivo, até duas casas)? Em branco não é erro: é só "ainda não digitado". */
export function dinheiroValido(digitado: string): boolean {
  const c = paraCentavos(normalizarDinheiroDigitado(digitado));
  return c !== null && c > 0;
}

/** Campo de valor em reais, com teclado numérico no celular e o erro dito em texto. */
export function CampoDeDinheiro({
  rotulo,
  valor,
  aoMudar,
  ajuda,
  obrigatorio = true,
}: {
  rotulo: string;
  valor: string;
  aoMudar: (v: string) => void;
  ajuda?: string;
  obrigatorio?: boolean;
}) {
  const erro =
    valor.trim() !== '' && !dinheiroValido(valor)
      ? 'Informe um valor maior que zero, com até duas casas.'
      : undefined;
  return (
    <Campo
      rotulo={rotulo}
      obrigatorio={obrigatorio}
      {...(ajuda ? { ajuda } : {})}
      {...(erro ? { erro } : {})}
    >
      {(p) => (
        <input
          {...p}
          inputMode="decimal"
          autoComplete="off"
          placeholder="0,00"
          required={obrigatorio}
          value={valor}
          onChange={(e) => aoMudar(e.target.value)}
        />
      )}
    </Campo>
  );
}
