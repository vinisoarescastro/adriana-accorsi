import { pode, type NomeDeOperacao } from '@gabinete/autorizacao';
import type { Perfil, RespostaDaSessao } from '@gabinete/compartilhado';
import {
  CalendarPlus,
  ClipboardCheck,
  FileText,
  Landmark,
  ListChecks,
  type LucideIcon,
} from 'lucide-react';
import { Link } from 'react-router';
import { formatarDataExtensa, nomeCurto } from '../formatos';

interface Atalho {
  readonly rotulo: string;
  readonly operacao: NomeDeOperacao;
  readonly para: string;
  readonly icone: LucideIcon;
}

const todos: Record<string, Atalho> = {
  demanda: {
    rotulo: 'Nova demanda',
    operacao: 'demandas.registrar',
    para: '/g/demandas?novo=1',
    icone: FileText,
  },
  tarefa: {
    rotulo: 'Nova tarefa',
    operacao: 'tarefas.criar',
    para: '/g/tarefas?novo=1',
    icone: ListChecks,
  },
  compromisso: {
    rotulo: 'Marcar compromisso',
    operacao: 'agenda.marcar',
    para: '/g/agenda?novo=1',
    icone: CalendarPlus,
  },
  presenca: {
    rotulo: 'Registrar presença',
    operacao: 'presenca.registrar',
    para: '/g/eventos',
    icone: ClipboardCheck,
  },
  projeto: {
    rotulo: 'Novo projeto de lei',
    operacao: 'projetos.registrar',
    para: '/g/projetos?novo=1',
    icone: Landmark,
  },
};

/** Os atalhos de cada perfil, do mais usado ao menos usado; só entram os que o usuário pode usar. */
const ordemPorPerfil: Record<Perfil, readonly string[]> = {
  assessor_externo: ['presenca', 'demanda', 'tarefa'],
  assessor_interno: ['demanda', 'tarefa', 'compromisso', 'presenca'],
  supervisor: ['demanda', 'tarefa', 'compromisso', 'projeto'],
  chefe: ['demanda', 'tarefa', 'compromisso', 'projeto'],
  administrador: ['demanda', 'tarefa', 'compromisso', 'projeto'],
  parlamentar: ['compromisso', 'demanda', 'projeto', 'tarefa'],
};

/** "Bom dia", "Boa tarde" ou "Boa noite", pela hora no fuso do gabinete. */
export function saudacaoDaHora(agora: Date = new Date()): string {
  const hora = Number(
    new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      hourCycle: 'h23',
    }).format(agora),
  );
  return hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
}

/** O alto do painel: a saudação, a data e os atalhos que o perfil mais usa. */
export function Saudacao({ sessao }: { sessao: RespostaDaSessao }) {
  const autoridade = { perfil: sessao.usuario.perfil, habilitacoes: sessao.usuario.habilitacoes };
  const atalhos = ordemPorPerfil[sessao.usuario.perfil]
    .map((id) => todos[id])
    .filter((a): a is Atalho => a !== undefined && pode(a.operacao, autoridade));

  return (
    <header className="painel-topo">
      <div className="painel-topo__texto">
        <h1 className="somente-leitor">Painel</h1>
        <p className="painel-topo__saudacao">
          {saudacaoDaHora()}, {nomeCurto(sessao.usuario.nome)}
        </p>
        <p className="painel-topo__data">{formatarDataExtensa(new Date().toISOString())}</p>
      </div>
      {atalhos.length > 0 ? (
        <div className="painel-atalhos" role="group" aria-label="Atalhos rápidos">
          {atalhos.map((a, i) => (
            <Link
              key={a.para}
              to={a.para}
              className={`botao${i === 0 ? '' : ' botao--secundario'}`}
            >
              <a.icone size={16} aria-hidden="true" />
              {a.rotulo}
            </Link>
          ))}
        </div>
      ) : null}
    </header>
  );
}
