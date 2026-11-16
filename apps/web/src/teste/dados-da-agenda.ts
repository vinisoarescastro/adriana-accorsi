import { hojeNoGabinete } from '../formatos';
import { sessaoDe } from './auxiliares';

export const naoEncontrado = {
  status: 404,
  corpo: { codigo: 'nao_encontrado', mensagem: 'Não encontrado.' },
};

export type Perfil = 'supervisor' | 'assessor_externo' | 'assessor_interno';

export const base = (perfil: Perfil = 'assessor_interno') => ({
  'GET /api/acesso/sessao': { corpo: sessaoDe(perfil) },
  'GET /api/gabinete': naoEncontrado,
  'GET /api/avisos': { corpo: { itens: [], naoLidos: 0 } },
  'GET /api/equipe': {
    corpo: [
      { id: 1, nome: 'Fulano de Tal', perfil, situacao: 'ativo', habilitacoes: ['AT', 'AG'] },
      {
        id: 2,
        nome: 'Beltrana',
        perfil: 'assessor_interno',
        situacao: 'ativo',
        habilitacoes: ['AG'],
      },
    ],
  },
});

export const compromisso = (id: number, extra: object = {}) => ({
  tipo: 'compromisso',
  id,
  titulo: `Reunião ${id}`,
  descricao: null,
  local: 'Câmara',
  inicio: `${hojeNoGabinete()}T13:00:00.000Z`,
  fim: `${hojeNoGabinete()}T14:00:00.000Z`,
  diaInteiro: false,
  visibilidade: 'participantes',
  envolveParlamentar: true,
  criador: 'Fulano de Tal',
  cancelado: false,
  participantesInternos: [{ id: 1, nome: 'Fulano de Tal', resposta: 'sem_resposta' }],
  participantesExternos: [],
  minhaResposta: 'sem_resposta',
  ...extra,
});

/** A agenda pede de domingo a sábado da semana de `hoje`. */
export const urlDaAgenda = (hoje: string, minha = false) => {
  const domingo = new Date(`${hoje}T12:00:00Z`);
  domingo.setUTCDate(domingo.getUTCDate() - domingo.getUTCDay());
  const sabado = new Date(domingo);
  sabado.setUTCDate(sabado.getUTCDate() + 6);
  const q = new URLSearchParams({
    de: `${domingo.toISOString().slice(0, 10)}T00:00:00-03:00`,
    ate: `${sabado.toISOString().slice(0, 10)}T23:59:59-03:00`,
  });
  if (minha) q.set('minha', 'true');
  return `/api/agenda?${q.toString()}`;
};
