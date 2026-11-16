import type { Prioridade, StatusDeDemanda } from '@gabinete/compartilhado';
import { rotuloDaPrioridade, rotuloDoStatus } from '../rotulos';
import { Selo, type TomDoSelo } from './ui';

const tomDoStatus: Record<StatusDeDemanda, TomDoSelo> = {
  em_andamento: 'primario',
  concluido: 'sucesso',
  arquivado: 'neutro',
  cancelada: 'perigo',
};

const tomDaPrioridade: Record<Prioridade, TomDoSelo> = {
  baixa: 'neutro',
  media: 'info',
  alta: 'atencao',
  urgente: 'perigo',
};

/** Situação de uma demanda ou tarefa. O mesmo tom para o mesmo estado, em toda a aplicação. */
export function SeloDeStatus({ status }: { status: StatusDeDemanda }) {
  return (
    <Selo tom={tomDoStatus[status]} ponto>
      {rotuloDoStatus[status]}
    </Selo>
  );
}

export function SeloDePrioridade({
  prioridade,
  compacto,
}: {
  prioridade: Prioridade;
  /** No cartão do quadro: pequeno, com ponto, e preenchido quando é urgente. */
  compacto?: boolean;
}) {
  if (!compacto)
    return <Selo tom={tomDaPrioridade[prioridade]}>{rotuloDaPrioridade[prioridade]}</Selo>;
  const urgente = prioridade === 'urgente';
  return (
    <Selo tom={tomDaPrioridade[prioridade]} pequeno solido={urgente} ponto={!urgente}>
      {rotuloDaPrioridade[prioridade]}
    </Selo>
  );
}

export function SeloDeAtraso() {
  return (
    <Selo tom="perigo" ponto>
      Atrasada
    </Selo>
  );
}
