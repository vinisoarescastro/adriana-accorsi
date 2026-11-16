import type { AvisoDto } from '@gabinete/compartilhado';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AtSign,
  Bell,
  CalendarClock,
  CalendarX,
  CheckCheck,
  CheckCircle2,
  ClipboardList,
  Clock,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { chamar } from '../api/cliente';
import { chavesDoTrabalho, useAvisos } from '../api/trabalho';
import { Dica } from '../componentes/dicas';
import { Botao } from '../componentes/ui';
import { formatarDataHora } from '../formatos';

/** O tipo do registro, para dizer onde a menção aconteceu. */
const rotuloDoRegistro = {
  tarefa: 'Tarefa',
  demanda: 'Demanda',
  compromisso: 'Compromisso',
  despesa: 'Despesa',
  destinacao: 'Destinação',
} as const;

/** Para onde cada aviso leva: o registro de origem, na própria página dele. */
export function destinoDoAviso(aviso: AvisoDto): string | null {
  switch (aviso.registro.tipo) {
    case 'tarefa':
      return `/g/tarefas?tarefa=${aviso.registro.id}`;
    case 'demanda':
      return `/g/demandas?demanda=${aviso.registro.id}`;
    case 'compromisso':
      return `/g/agenda?compromisso=${aviso.registro.id}`;
    default:
      return null;
  }
}

type Tom = 'info' | 'atencao' | 'primario';

/** O ícone e o tom de cada natureza: só reforçam a frase, que é quem diz o que aconteceu. */
const aparencia: Record<AvisoDto['natureza'], { icone: LucideIcon; tom: Tom }> = {
  tarefa_designada: { icone: ClipboardList, tom: 'primario' },
  tarefa_reatribuida: { icone: ClipboardList, tom: 'primario' },
  compromisso_indicacao: { icone: CalendarClock, tom: 'primario' },
  compromisso_remarcado: { icone: CalendarClock, tom: 'atencao' },
  compromisso_cancelado: { icone: CalendarX, tom: 'atencao' },
  prazo_proximo: { icone: Clock, tom: 'atencao' },
  prazo_vencido: { icone: Clock, tom: 'atencao' },
  despesa_aguardando_analise: { icone: ClipboardList, tom: 'info' },
  saldo_abaixo_limite: { icone: Clock, tom: 'atencao' },
  mencao: { icone: AtSign, tom: 'info' },
  demanda_designada: { icone: ClipboardList, tom: 'primario' },
};

/**
 * O sino: a caixa pessoal de avisos. A contagem e a lista dizem tudo em texto (nada depende só de
 * cor). O aviso não tem conteúdo próprio: a frase vem da natureza e o título, do registro.
 */
export function SinoDeAvisos() {
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const cliente = useQueryClient();
  const { data } = useAvisos();
  const naoLidos = data?.naoLidos ?? 0;

  // Fecha ao clicar fora ou apertar Esc.
  useEffect(() => {
    if (!aberto) return;
    const aoClicar = (e: MouseEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAberto(false);
    };
    const aoTeclar = (e: KeyboardEvent) => e.key === 'Escape' && setAberto(false);
    document.addEventListener('mousedown', aoClicar);
    document.addEventListener('keydown', aoTeclar);
    return () => {
      document.removeEventListener('mousedown', aoClicar);
      document.removeEventListener('keydown', aoTeclar);
    };
  }, [aberto]);

  const marcar = useMutation({
    mutationFn: (corpo: { ids: number[] } | { todos: true }) =>
      chamar('POST', '/api/avisos/lidos', { corpo }),
    onSuccess: () => cliente.invalidateQueries({ queryKey: chavesDoTrabalho.avisos }),
  });

  const rotulo = `Avisos${naoLidos > 0 ? ` (${naoLidos} novo${naoLidos > 1 ? 's' : ''})` : ''}`;

  return (
    <div className="sino" ref={raiz}>
      <Dica texto="Avisos">
        <Botao
          variante="fantasma"
          className="botao--icone sino__botao"
          aria-label={rotulo}
          aria-expanded={aberto}
          aria-controls="caixa-de-avisos"
          onClick={() => setAberto((v) => !v)}
        >
          <Bell size={18} aria-hidden="true" />
          {naoLidos > 0 ? (
            <span className="sino__contagem" aria-hidden="true">
              {naoLidos > 9 ? '9+' : naoLidos}
            </span>
          ) : null}
        </Botao>
      </Dica>
      {aberto ? (
        <div id="caixa-de-avisos" className="sino__painel" role="region" aria-label="Seus avisos">
          <div className="sino__cabeca">
            <h2>Avisos</h2>
            {naoLidos > 0 ? (
              <Botao
                pequeno
                variante="fantasma"
                icone={<CheckCheck size={16} aria-hidden="true" />}
                disabled={marcar.isPending}
                onClick={() => marcar.mutate({ todos: true })}
              >
                Marcar todos como lidos
              </Botao>
            ) : null}
          </div>
          {data && data.itens.length > 0 ? (
            <ul className="sino__lista">
              {data.itens.map((a) => {
                const destino = destinoDoAviso(a);
                const { icone: Icone, tom } = aparencia[a.natureza];
                const conteudo = (
                  <>
                    <span className={`sino__icone sino__icone--${tom}`} aria-hidden="true">
                      <Icone size={16} />
                    </span>
                    <span className="sino__texto">
                      <span className="sino__titulo">
                        {a.lido ? '' : 'Novo: '}
                        {a.natureza === 'mencao' && a.de ? `${a.de} mencionou você` : a.frase}
                      </span>
                      {a.registro.titulo ? (
                        <span className="sino__descricao">
                          {a.natureza === 'mencao' ? `${rotuloDoRegistro[a.registro.tipo]}: ` : ''}
                          {a.registro.titulo}
                        </span>
                      ) : null}
                      <span className="sino__hora">{formatarDataHora(a.geradoEm)}</span>
                    </span>
                    {a.lido ? null : <span className="sino__ponto" aria-hidden="true" />}
                  </>
                );
                return (
                  <li key={a.id} className={a.lido ? 'sino__item' : 'sino__item sino__item--novo'}>
                    {destino ? (
                      <Link
                        to={destino}
                        className="sino__linha"
                        aria-label={`Abrir: ${a.natureza === 'mencao' && a.de ? `${a.de} mencionou você` : a.frase}`}
                        onClick={() => {
                          marcar.mutate({ ids: [a.id] });
                          setAberto(false);
                        }}
                      >
                        {conteudo}
                      </Link>
                    ) : (
                      <div className="sino__linha">{conteudo}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="vazio">
              <span className="vazio__icone" aria-hidden="true">
                <CheckCircle2 size={24} />
              </span>
              <p className="vazio__titulo">Nenhum aviso por enquanto.</p>
              <p className="vazio__texto">Você será avisado de tarefas, prazos e compromissos.</p>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
