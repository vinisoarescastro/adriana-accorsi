import { pode } from '@gabinete/autorizacao';
import type { ConflitoDeAgenda, ItemDaAgenda, RespostaDaSessao } from '@gabinete/compartilhado';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarOff, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { chamar } from '../api/cliente';
import { chavesDoTrabalho, useAgenda } from '../api/trabalho';
import { Abas } from '../componentes/abas';
import { CabecalhoDaPagina } from '../componentes/cabecalho';
import { BotaoDeIcone } from '../componentes/dicas';
import { Modal } from '../componentes/modal';
import { EsqueletoDeCartoes } from '../componentes/tabela';
import { Aviso, AvisoDeErro, Botao } from '../componentes/ui';
import { fimDoDia, formatarDataHora, hojeNoGabinete, inicioDoDia, somarDias } from '../formatos';
import { BloquearHorario } from './BloquearHorario';
import { intervaloDaVisao, somarMeses, type VisaoDaAgenda } from './calendario';
import { SeletorDePeriodo } from './SeletorDePeriodo';
import { CompromissoAberto } from './CompromissoAberto';
import { FormularioDeCompromisso } from './FormularioDeCompromisso';
import { VisaoMensal } from './VisaoMensal';
import { VisaoSemanal } from './VisaoSemanal';

/**
 * Agenda por semana (hora a hora) ou por mês, sempre de domingo a sábado. O servidor devolve a cada
 * um só o que ele pode ver: o compromisso inteiro, só o horário ocupado, ou nada (o Restrito de outros
 * some, nem como ocupado). "Minha agenda" mostra o que envolve a Parlamentar (para ela) e onde o
 * usuário foi indicado.
 */
export function PaginaAgenda({ sessao }: { sessao: RespostaDaSessao }) {
  const cliente = useQueryClient();
  const [parametros, definirParametros] = useSearchParams();
  const aberto = Number(parametros.get('compromisso')) || null;
  const hoje = hojeNoGabinete();
  const [referencia, setReferencia] = useState(hoje);
  const [visao, setVisao] = useState<VisaoDaAgenda>('mes');
  const [minha, setMinha] = useState(false);
  const [modo, setModo] = useState<'nenhum' | 'compromisso' | 'bloqueio'>(
    parametros.get('novo') === '1' ? 'compromisso' : 'nenhum',
  );
  const [bloqueioAberto, setBloqueioAberto] = useState<Extract<
    ItemDaAgenda,
    { tipo: 'bloqueio' }
  > | null>(null);
  const [conflitos, setConflitos] = useState<readonly ConflitoDeAgenda[]>([]);
  const autoridade = { perfil: sessao.usuario.perfil, habilitacoes: sessao.usuario.habilitacoes };
  const podeMarcar = pode('agenda.marcar', autoridade);

  const { inicio, fim } = intervaloDaVisao(visao, referencia);
  const agenda = useAgenda({ de: inicioDoDia(inicio), ate: fimDoDia(fim), minha });
  const itens = agenda.data?.itens ?? [];

  const abrirCompromisso = (id: number | null) => {
    const novos = new URLSearchParams(parametros);
    if (id === null) novos.delete('compromisso');
    else novos.set('compromisso', String(id));
    definirParametros(novos);
  };
  const abrirItem = (item: ItemDaAgenda) => {
    if (item.tipo === 'compromisso') abrirCompromisso(item.id);
    else if (item.tipo === 'bloqueio') setBloqueioAberto(item);
  };
  const cancelarBloqueio = useMutation({
    mutationFn: (id: number) => chamar<void>('POST', `/api/agenda/bloqueios/${id}/cancelar`),
    onSuccess: async () => {
      setBloqueioAberto(null);
      await cliente.invalidateQueries({ queryKey: chavesDoTrabalho.tudo });
    },
  });

  const andar = (sentido: 1 | -1) =>
    setReferencia(
      visao === 'semana' ? somarDias(referencia, 7 * sentido) : somarMeses(referencia, sentido),
    );

  return (
    <section>
      <CabecalhoDaPagina
        titulo="Agenda"
        descricao="Compromissos por semana ou por mês, com a visibilidade de cada um."
        acoes={
          podeMarcar ? (
            <>
              <Botao
                variante="secundario"
                icone={<CalendarOff size={16} aria-hidden="true" />}
                onClick={() => setModo('bloqueio')}
              >
                Bloquear horário
              </Botao>
              <Botao
                icone={<Plus size={16} aria-hidden="true" />}
                onClick={() => setModo('compromisso')}
              >
                Novo compromisso
              </Botao>
            </>
          ) : null
        }
      />

      {modo === 'compromisso' ? (
        <FormularioDeCompromisso
          sessao={sessao}
          diaInicial={referencia}
          aoSalvar={(salvo) => {
            setModo('nenhum');
            setConflitos(salvo.conflitos);
            abrirCompromisso(salvo.compromisso.id);
          }}
          aoFechar={() => setModo('nenhum')}
        />
      ) : null}
      {modo === 'bloqueio' ? (
        <BloquearHorario
          aoConcluir={(c) => {
            setModo('nenhum');
            setConflitos(c);
          }}
          aoFechar={() => setModo('nenhum')}
        />
      ) : null}
      {conflitos.length > 0 ? (
        <Aviso tipo="atencao" titulo="Há conflito de horário (é só um aviso).">
          <ul>
            {conflitos.map((x) => (
              <li key={`${x.tipo}-${x.inicio}`}>
                {x.tipo === 'bloqueio' ? 'Horário bloqueado' : 'Outro compromisso'}:{' '}
                {formatarDataHora(x.inicio)} a {formatarDataHora(x.fim)}
              </li>
            ))}
          </ul>
        </Aviso>
      ) : null}

      <div className="agenda-barra">
        <div className="semana" role="group" aria-label="Escolher o período">
          <BotaoDeIcone
            rotulo={visao === 'semana' ? 'Semana anterior' : 'Mês anterior'}
            icone={<ChevronLeft size={18} aria-hidden="true" />}
            onClick={() => andar(-1)}
          />
          <BotaoDeIcone
            rotulo={visao === 'semana' ? 'Próxima semana' : 'Próximo mês'}
            icone={<ChevronRight size={18} aria-hidden="true" />}
            onClick={() => andar(1)}
          />
          <SeletorDePeriodo
            visao={visao}
            referencia={referencia}
            hoje={hoje}
            aoEscolher={setReferencia}
          />
          <Botao variante="secundario" pequeno onClick={() => setReferencia(hoje)}>
            Hoje
          </Botao>
        </div>
        <div className="agenda-barra__opcoes">
          <Abas
            segmentada
            rotulo="Visão da agenda"
            valor={visao}
            aoMudar={setVisao}
            itens={[
              { id: 'semana', rotulo: 'Semana' },
              { id: 'mes', rotulo: 'Mês' },
            ]}
          />
          <Abas
            segmentada
            rotulo="Qual agenda ver"
            valor={minha ? 'minha' : 'toda'}
            aoMudar={(v) => setMinha(v === 'minha')}
            itens={[
              { id: 'toda', rotulo: 'Toda a agenda' },
              { id: 'minha', rotulo: 'Minha agenda' },
            ]}
          />
        </div>
      </div>

      <AvisoDeErro erro={agenda.error ?? cancelarBloqueio.error} />
      {agenda.isLoading ? <EsqueletoDeCartoes quantidade={4} /> : null}
      {agenda.data ? (
        <>
          {itens.length === 0 ? (
            <p className="agenda-vazia" role="status">
              Nada marcado neste período.
            </p>
          ) : null}
          {visao === 'semana' ? (
            <VisaoSemanal inicio={inicio} fim={fim} hoje={hoje} itens={itens} aoAbrir={abrirItem} />
          ) : (
            <VisaoMensal
              inicio={inicio}
              fim={fim}
              mes={referencia}
              hoje={hoje}
              itens={itens}
              aoAbrir={abrirItem}
              aoEscolherDia={(dia) => {
                setReferencia(dia);
                setVisao('semana');
              }}
            />
          )}
        </>
      ) : null}

      {bloqueioAberto ? (
        <Modal
          titulo="Horário indisponível"
          descricao={`${formatarDataHora(bloqueioAberto.inicio)} a ${formatarDataHora(bloqueioAberto.fim)}`}
          tamanho="sm"
          aoFechar={() => setBloqueioAberto(null)}
          rodape={
            podeMarcar ? (
              <>
                <Botao variante="secundario" onClick={() => setBloqueioAberto(null)}>
                  Fechar
                </Botao>
                <Botao
                  variante="perigo"
                  carregando={cancelarBloqueio.isPending}
                  onClick={() => cancelarBloqueio.mutate(bloqueioAberto.id)}
                >
                  Cancelar bloqueio
                </Botao>
              </>
            ) : null
          }
        >
          <p>O motivo do bloqueio não é registrado: ele só impede novos compromissos no horário.</p>
        </Modal>
      ) : null}

      {aberto ? (
        <CompromissoAberto id={aberto} sessao={sessao} aoFechar={() => abrirCompromisso(null)} />
      ) : null}
    </section>
  );
}
