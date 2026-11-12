import { areas, perfis, type Area, type Perfil } from '@gabinete/compartilhado';
import { describe, expect, it } from 'vitest';
import { composicaoDeAlcance } from './alcance.js';
import { decidir, decidirPelaDefinicao, pode } from './decisor.js';
import { nomesDeOperacoes, type NomeDeOperacao } from './operacoes.js';
import { paginas, paginasAlcancaveis } from './paginas.js';

const todas: readonly Area[] = areas;

/**
 * Matriz esperada, escrita À MÃO e independente da definição: quem alcança cada operação.
 * Se a definição mudar por engano, este teste quebra. Perfis na ordem: parlamentar,
 * administrador, chefe, supervisor, assessor_interno, assessor_externo.
 */
const esperado: Record<NomeDeOperacao, readonly Perfil[]> = {
  'sessao.consultar': perfis,
  'sessao.sair': perfis,
  'sessao.trocar_senha': perfis,
  'perfil.alterar_foto': perfis,
  'painel.abrir': perfis,
  'equipe.ver': perfis,
  'equipe.administrar': ['administrador', 'chefe'],
  'equipe.historico': ['parlamentar', 'administrador', 'chefe'],
  'fluxos.consultar': perfis,
  'fluxos.ajustar': ['administrador', 'chefe', 'supervisor'],
  'fluxos.estruturar': ['administrador'],
  'gabinete.consultar': perfis,
  'gabinete.editar': ['administrador', 'chefe'],
  'auditoria.consultar_gabinete': ['parlamentar', 'administrador', 'chefe'],
  'auditoria.historico_registro': [
    'parlamentar',
    'administrador',
    'chefe',
    'supervisor',
    'assessor_interno',
  ],
};

describe('matriz perfil x operação', () => {
  it('toda operação definida tem expectativa, e vice-versa', () => {
    expect(Object.keys(esperado).sort()).toEqual([...nomesDeOperacoes].sort());
  });

  for (const operacao of nomesDeOperacoes) {
    it(`${operacao}: só os perfis esperados`, () => {
      const alcancam = perfis.filter((perfil) => pode(operacao, { perfil, habilitacoes: todas }));
      expect([...alcancam].sort()).toEqual([...esperado[operacao]].sort());
    });
  }
});

describe('decisor', () => {
  it('o Parlamentar conta como Supervisor, mas não administra o sistema', () => {
    const parlamentar = { perfil: 'parlamentar', habilitacoes: todas } as const;
    expect(pode('fluxos.ajustar', parlamentar)).toBe(false);
    expect(pode('equipe.administrar', parlamentar)).toBe(false);
    expect(pode('auditoria.consultar_gabinete', parlamentar)).toBe(true);
  });

  it('informa o motivo da recusa', () => {
    expect(decidir('equipe.administrar', { perfil: 'supervisor', habilitacoes: [] })).toEqual({
      permitido: false,
      motivo: 'nivel_insuficiente',
    });
    expect(decidir('fluxos.ajustar', { perfil: 'parlamentar', habilitacoes: [] })).toEqual({
      permitido: false,
      motivo: 'perfil_excluido',
    });
  });

  it('exige a habilitação além do nível (interseção)', () => {
    const emendas = { descricao: 'Emendas', nivelMinimo: 2, habilitacao: ['LG', 'FI'] } as const;
    const interno = (habilitacoes: readonly Area[]) =>
      ({ perfil: 'assessor_interno', habilitacoes }) as const;

    expect(decidirPelaDefinicao(emendas, interno(['LG']))).toEqual({ permitido: true });
    expect(decidirPelaDefinicao(emendas, interno(['FI']))).toEqual({ permitido: true });
    expect(decidirPelaDefinicao(emendas, interno(['AT', 'AG']))).toEqual({
      permitido: false,
      motivo: 'sem_habilitacao',
    });
    // Habilitação sem nível também não autoriza.
    expect(
      decidirPelaDefinicao(emendas, { perfil: 'assessor_externo', habilitacoes: ['LG'] }),
    ).toEqual({ permitido: false, motivo: 'nivel_insuficiente' });
  });
});

describe('páginas alcançáveis', () => {
  it('cada perfil vê só o que o decisor permite', () => {
    const para = (perfil: Perfil) => paginasAlcancaveis({ perfil, habilitacoes: todas });
    expect(para('assessor_externo')).toEqual(['painel', 'equipe', 'fluxos', 'configuracoes']);
    expect(para('supervisor')).toEqual(['painel', 'equipe', 'fluxos', 'configuracoes']);
    expect(para('chefe')).toEqual(['painel', 'equipe', 'fluxos', 'auditoria', 'configuracoes']);
    expect(para('parlamentar')).toEqual([
      'painel',
      'equipe',
      'fluxos',
      'auditoria',
      'configuracoes',
    ]);
  });

  it('toda página aponta para uma operação que existe', () => {
    for (const pagina of Object.values(paginas)) {
      expect(nomesDeOperacoes).toContain(pagina.operacao);
    }
  });
});

describe('composicaoDeAlcance', () => {
  it('só o Assessor Externo é limitado ao que é seu', () => {
    expect(composicaoDeAlcance('assessor_externo')).toBe('proprio');
    for (const perfil of perfis.filter((p) => p !== 'assessor_externo')) {
      expect(composicaoDeAlcance(perfil)).toBe('total');
    }
  });
});
