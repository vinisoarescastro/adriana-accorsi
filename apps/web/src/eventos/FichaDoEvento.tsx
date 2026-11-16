import { pode } from '@gabinete/autorizacao';
import type {
  EventoFicha,
  PresencaDto,
  PresencaRegistrada,
  RespostaDaSessao,
} from '@gabinete/compartilhado';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { chamar, ErroDaApi } from '../api/cliente';
import { chavesDoTrabalho, useEvento } from '../api/trabalho';
import { Modal } from '../componentes/modal';
import { Aviso, AvisoDeErro, Botao, Campo, Carregando, Selo } from '../componentes/ui';
import { formatarDataHora } from '../formatos';

/**
 * Registro de presença pensado para o celular: um campo de telefone grande e um botão. Se a pessoa
 * não está cadastrada, a API pede o nome (409 com o detalhe `nome`) e a tela mostra o campo: o
 * cadastro nasce no ato. Registrar de novo é só digitar o próximo telefone.
 */
function RegistrarPresenca({ evento }: { evento: EventoFicha }) {
  const cliente = useQueryClient();
  const campo = useRef<HTMLInputElement>(null);
  const [telefone, setTelefone] = useState('');
  const [nome, setNome] = useState('');
  const [observacao, setObservacao] = useState('');
  const [ultima, setUltima] = useState<string | null>(null);

  const registrar = useMutation({
    mutationFn: () =>
      chamar<PresencaRegistrada>('POST', `/api/eventos/${evento.id}/presencas`, {
        corpo: {
          telefone,
          ...(nome.trim() ? { nome: nome.trim() } : {}),
          ...(observacao.trim() ? { observacao: observacao.trim() } : {}),
        },
      }),
    onSuccess: async (r) => {
      cliente.setQueryData(chavesDoTrabalho.evento(evento.id), r.evento);
      await cliente.invalidateQueries({ queryKey: chavesDoTrabalho.tudo });
      setUltima(
        r.pessoaCriada ? 'Pessoa nova cadastrada e presença registrada.' : 'Presença registrada.',
      );
      setTelefone('');
      setNome('');
      setObservacao('');
      campo.current?.focus();
    },
  });

  const pedeONome =
    registrar.error instanceof ErroDaApi && registrar.error.detalhes?.includes('nome');

  return (
    <form
      className="presenca-rapida"
      aria-label="Registrar presença"
      onSubmit={(e) => {
        e.preventDefault();
        setUltima(null);
        registrar.mutate();
      }}
    >
      <h3>Registrar presença</h3>
      {ultima ? <Aviso tipo="sucesso" titulo={ultima} /> : null}
      {pedeONome ? (
        <Aviso
          tipo="atencao"
          titulo="Pessoa não cadastrada: informe o nome para cadastrá-la agora."
        />
      ) : (
        <AvisoDeErro erro={registrar.error} />
      )}
      <Campo rotulo="Telefone com DDD">
        {(p) => (
          <input
            {...p}
            ref={campo}
            type="tel"
            inputMode="tel"
            autoComplete="off"
            required
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
          />
        )}
      </Campo>
      {pedeONome ? (
        <Campo rotulo="Nome completo">
          {(p) => (
            <input
              {...p}
              required
              maxLength={160}
              autoFocus
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
          )}
        </Campo>
      ) : null}
      <Campo rotulo="Observação (opcional)">
        {(p) => (
          <input
            {...p}
            maxLength={300}
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
          />
        )}
      </Campo>
      <Botao type="submit" disabled={!telefone.trim() || registrar.isPending}>
        Registrar presença
      </Botao>
    </form>
  );
}

function LinhaDePresenca({
  evento,
  presenca,
  podeRemover,
}: {
  evento: EventoFicha;
  presenca: PresencaDto;
  podeRemover: boolean;
}) {
  const cliente = useQueryClient();
  const [corrigindo, setCorrigindo] = useState(false);
  const [removendo, setRemovendo] = useState(false);
  const [observacao, setObservacao] = useState(presenca.observacao ?? '');
  const [justificativa, setJustificativa] = useState('');

  const aposMudar = async (ficha: EventoFicha) => {
    cliente.setQueryData(chavesDoTrabalho.evento(evento.id), ficha);
    await cliente.invalidateQueries({ queryKey: chavesDoTrabalho.tudo });
    setCorrigindo(false);
    setRemovendo(false);
  };
  const corrigir = useMutation({
    mutationFn: () =>
      chamar<EventoFicha>('PATCH', `/api/eventos/${evento.id}/presencas/${presenca.pessoaId}`, {
        corpo: { observacao: observacao.trim() || null },
      }),
    onSuccess: aposMudar,
  });
  const remover = useMutation({
    mutationFn: () =>
      chamar<EventoFicha>(
        'POST',
        `/api/eventos/${evento.id}/presencas/${presenca.pessoaId}/remover`,
        { corpo: { justificativa: justificativa.trim() } },
      ),
    onSuccess: aposMudar,
  });

  return (
    <li>
      <strong>{presenca.nome ?? 'Dados eliminados'}</strong>
      {presenca.telefone ? ` · ${presenca.telefone}` : ''}
      {presenca.observacao ? ` · ${presenca.observacao}` : ''}
      <br />
      <small>
        Registrada por {presenca.registradoPor} em {formatarDataHora(presenca.registradoEm)}
      </small>
      {evento.situacao === 'aberto' ? (
        <div className="acoes">
          {presenca.corrigivel ? (
            <Botao pequeno variante="secundario" onClick={() => setCorrigindo((v) => !v)}>
              Corrigir
            </Botao>
          ) : null}
          {podeRemover ? (
            <Botao pequeno variante="perigo" onClick={() => setRemovendo((v) => !v)}>
              Remover
            </Botao>
          ) : null}
        </div>
      ) : null}
      <AvisoDeErro erro={corrigir.error ?? remover.error} />
      {corrigindo ? (
        <>
          <Campo rotulo="Observação">
            {(p) => (
              <input
                {...p}
                maxLength={300}
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
              />
            )}
          </Campo>
          <Botao pequeno disabled={corrigir.isPending} onClick={() => corrigir.mutate()}>
            Salvar correção
          </Botao>
        </>
      ) : null}
      {removendo ? (
        <>
          <Campo rotulo="Motivo da remoção" ajuda="Ao menos 10 caracteres. Fica na trilha.">
            {(p) => (
              <input
                {...p}
                maxLength={1000}
                value={justificativa}
                onChange={(e) => setJustificativa(e.target.value)}
              />
            )}
          </Campo>
          <Botao
            pequeno
            variante="perigo"
            disabled={justificativa.trim().length < 10 || remover.isPending}
            onClick={() => remover.mutate()}
          >
            Confirmar a remoção
          </Botao>
        </>
      ) : null}
    </li>
  );
}

/** O evento numa gaveta, com a presença. O Assessor Externo vê só as presenças que registrou. */
export function FichaDoEvento({
  id,
  sessao,
  aoFechar,
}: {
  id: number;
  sessao: RespostaDaSessao;
  aoFechar: () => void;
}) {
  const cliente = useQueryClient();
  const { data: evento, isLoading, error } = useEvento(id);
  const autoridade = { perfil: sessao.usuario.perfil, habilitacoes: sessao.usuario.habilitacoes };

  const encerrar = useMutation({
    mutationFn: () => chamar<EventoFicha>('POST', `/api/eventos/${id}/encerrar`),
    onSuccess: async (ficha) => {
      cliente.setQueryData(chavesDoTrabalho.evento(id), ficha);
      await cliente.invalidateQueries({ queryKey: chavesDoTrabalho.tudo });
    },
  });

  return (
    <Modal titulo={evento ? evento.nome : 'Evento'} tamanho="lg" aoFechar={aoFechar}>
      {isLoading ? <Carregando /> : null}
      <AvisoDeErro erro={error ?? encerrar.error} />

      {evento ? (
        <>
          <p>
            <Selo tom={evento.situacao === 'aberto' ? 'sucesso' : 'neutro'} ponto>
              {evento.situacao === 'aberto' ? 'Aberto' : 'Encerrado'}
            </Selo>{' '}
            <Selo>{evento.presentes} presente(s)</Selo>
          </p>
          <dl className="ficha">
            <dt>Quando</dt>
            <dd>{formatarDataHora(evento.inicio)}</dd>
            <dt>Local</dt>
            <dd>{evento.local ?? 'Não informado'}</dd>
            <dt>Cadastrado por</dt>
            <dd>{evento.criador}</dd>
          </dl>

          {evento.situacao === 'aberto' ? (
            <RegistrarPresenca evento={evento} />
          ) : (
            <Aviso tipo="atencao" titulo="Evento encerrado: a lista de presença não muda mais." />
          )}

          <h3>
            {evento.listaNominalCompleta ? 'Lista de presença' : 'Presenças que você registrou'}
          </h3>
          {evento.presencas.length === 0 ? <p>Nenhuma presença registrada.</p> : null}
          <ul className="lista-simples">
            {evento.presencas.map((p) => (
              <LinhaDePresenca
                key={p.pessoaId}
                evento={evento}
                presenca={p}
                podeRemover={pode('presenca.remover', autoridade)}
              />
            ))}
          </ul>

          {pode('eventos.encerrar', autoridade) && evento.situacao === 'aberto' ? (
            <div className="painel-do-usuario">
              <h3>Encerrar o evento</h3>
              <p className="campo__ajuda">
                Encerrar é uma decisão sua: o evento não se encerra sozinho pela data. Depois, a
                lista não muda mais.
              </p>
              <Botao
                pequeno
                variante="perigo"
                disabled={encerrar.isPending}
                onClick={() => encerrar.mutate()}
              >
                Encerrar evento
              </Botao>
            </div>
          ) : null}
        </>
      ) : null}
    </Modal>
  );
}
