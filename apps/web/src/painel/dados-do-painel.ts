import { formatarReais, paraCentavos, type SaldoDaCeap } from '@gabinete/compartilhado';
import type { LinhaDaFaixa } from '../graficos/FaixaProporcional';

const centavos = (v: string) => paraCentavos(v) ?? 0;

interface Contagem {
  readonly abertas?: number;
  readonly atrasadas?: number;
  readonly emAndamento?: number;
  readonly atrasados?: number;
}

/** Uma linha por área que a pessoa vê: quantos em andamento estão no prazo e quantos estão atrasados. */
export function linhasDePrazoDoPainel(areas: {
  atendimento: Contagem | undefined;
  tarefas: Contagem | undefined;
  projetos: Contagem | undefined;
}): LinhaDaFaixa[] {
  const linha = (
    id: string,
    rotulo: string,
    total: number,
    atrasados: number,
    nomeAtrasados: string,
  ): LinhaDaFaixa => ({
    id,
    rotulo,
    partes: [
      { nome: 'No prazo', valor: Math.max(0, total - atrasados), cor: 'var(--chart-2)' },
      { nome: nomeAtrasados, valor: atrasados, cor: 'var(--chart-1)' },
    ],
  });
  const { atendimento, tarefas, projetos } = areas;
  return [
    ...(atendimento
      ? [
          linha(
            'demandas',
            'Demandas',
            atendimento.abertas ?? 0,
            atendimento.atrasadas ?? 0,
            'Atrasadas',
          ),
        ]
      : []),
    ...(tarefas
      ? [linha('tarefas', 'Tarefas', tarefas.abertas ?? 0, tarefas.atrasadas ?? 0, 'Atrasadas')]
      : []),
    ...(projetos
      ? [
          linha(
            'projetos',
            'Projetos de lei',
            projetos.emAndamento ?? 0,
            projetos.atrasados ?? 0,
            'Atrasados',
          ),
        ]
      : []),
  ];
}

/** As seis categorias da CEAP que mais consumiram, com o valor e a parte de cada uma no total. */
export function categoriasDoPainel(saldo: SaldoDaCeap | undefined) {
  const todas = saldo?.porCategoria ?? [];
  const total = todas.reduce((t, c) => t + centavos(c.consumido), 0);
  return [...todas]
    .sort((x, y) => centavos(y.consumido) - centavos(x.consumido))
    .slice(0, 6)
    .filter((c) => centavos(c.consumido) > 0)
    .map((c) => ({
      id: c.categoriaId,
      rotulo: c.nome,
      valor: centavos(c.consumido),
      texto: `${formatarReais(c.consumido)} · ${Math.round((centavos(c.consumido) / total) * 100)}%`,
    }));
}
