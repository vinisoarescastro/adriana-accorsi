import { pode } from '@gabinete/autorizacao';
import {
  origensDeConsentimentoRegistravel,
  textoDeConsentimento,
  type RespostaDaSessao,
} from '@gabinete/compartilhado';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { chavesDoAtendimento } from '../api/atendimento';
import { useConsentimento } from '../api/cidadao';
import { chamar } from '../api/cliente';
import { formatarDataHora } from '../formatos';
import { rotuloDaOrigemDoConsentimento } from '../rotulos';
import { Aviso, AvisoDeErro, Botao, Campo, Carregando, Selo } from './ui';

/**
 * Consentimento de notificação por e-mail (LGPD). Começa DESMARCADO. Quem registra "sim" lê o texto
 * ao cidadão, e a versão do texto fica gravada junto. Cancelar vale na hora. O histórico é visível.
 */
export function ConsentimentoDeNotificacao({
  pessoaId,
  sessao,
  rotuloDaPessoa,
}: {
  pessoaId: number;
  sessao: RespostaDaSessao;
  rotuloDaPessoa?: string;
}) {
  const cliente = useQueryClient();
  const autoridade = { perfil: sessao.usuario.perfil, habilitacoes: sessao.usuario.habilitacoes };
  const podeRegistrar = pode('consentimento.registrar', autoridade);
  const { data, isLoading, error } = useConsentimento(pessoaId, podeRegistrar);
  const [origem, setOrigem] =
    useState<(typeof origensDeConsentimentoRegistravel)[number]>('atendimento_telefonico');
  const [leuOTexto, setLeuOTexto] = useState(false);

  const registrar = useMutation({
    mutationFn: (consentido: boolean) =>
      chamar('PUT', `/api/pessoas/${pessoaId}/consentimento`, {
        corpo: consentido
          ? { consentido, origem, versaoTexto: textoDeConsentimento.versao }
          : { consentido, origem },
      }),
    onSuccess: async () => {
      setLeuOTexto(false);
      await cliente.invalidateQueries({ queryKey: chavesDoAtendimento.tudo });
    },
  });

  if (!podeRegistrar) return null;
  if (isLoading) return <Carregando />;
  const situacao = data?.situacao;

  return (
    <div className="painel-do-usuario">
      <h3>Avisos por e-mail{rotuloDaPessoa ? ` (${rotuloDaPessoa})` : ''}</h3>
      <AvisoDeErro erro={error ?? registrar.error} />
      {situacao ? (
        <p>
          <Selo tipo={situacao.consentimento ? 'ativo' : 'inativo'}>
            {situacao.consentimento ? 'Avisos ativados' : 'Avisos desativados'}
          </Selo>{' '}
          {!situacao.temEmail ? <Selo>Sem e-mail cadastrado</Selo> : null}{' '}
          {situacao.emailInvalido ? <Selo>E-mail recusado pelo provedor</Selo> : null}
        </p>
      ) : null}

      {situacao && !situacao.consentimento ? (
        situacao.temEmail && !situacao.emailInvalido ? (
          <>
            <p className="campo__ajuda">Leia ao cidadão e só marque se ele disser sim:</p>
            <blockquote className="texto-de-consentimento">{textoDeConsentimento.texto}</blockquote>
            <Campo rotulo="Como o cidadão autorizou">
              {(p) => (
                <select
                  {...p}
                  value={origem}
                  onChange={(e) => setOrigem(e.target.value as typeof origem)}
                >
                  {origensDeConsentimentoRegistravel.map((o) => (
                    <option key={o} value={o}>
                      {rotuloDaOrigemDoConsentimento[o]}
                    </option>
                  ))}
                </select>
              )}
            </Campo>
            <label className="opcao">
              <input
                type="checkbox"
                checked={leuOTexto}
                onChange={(e) => setLeuOTexto(e.target.checked)}
              />
              Li o texto ao cidadão e ele concordou em receber avisos por e-mail
            </label>
            <p>
              <Botao
                pequeno
                disabled={!leuOTexto || registrar.isPending}
                onClick={() => registrar.mutate(true)}
              >
                Registrar consentimento
              </Botao>
            </p>
          </>
        ) : (
          <p className="campo__ajuda">
            Cadastre (ou corrija) o e-mail da pessoa para poder registrar o consentimento.
          </p>
        )
      ) : null}

      {situacao?.consentimento ? (
        <>
          <p className="campo__ajuda">
            Consentimento registrado em{' '}
            {situacao.registradoEm ? formatarDataHora(situacao.registradoEm) : ''}
            {situacao.origem ? ` (${rotuloDaOrigemDoConsentimento[situacao.origem]})` : ''}. O
            cidadão também pode cancelar pelo link que vai em cada e-mail.
          </p>
          <Botao
            pequeno
            variante="secundario"
            disabled={registrar.isPending}
            onClick={() => registrar.mutate(false)}
          >
            Cancelar consentimento (a pedido do cidadão)
          </Botao>
        </>
      ) : null}

      {data && data.historico.length > 0 ? (
        <details>
          <summary>Histórico do consentimento ({data.historico.length})</summary>
          <ol className="lista-simples">
            {data.historico.map((h) => (
              <li key={h.id}>
                {formatarDataHora(h.registradoEm)}: {h.consentido ? 'consentiu' : 'cancelou'} ·{' '}
                {rotuloDaOrigemDoConsentimento[h.origem]}
                {h.versaoTexto ? ` · texto v${h.versaoTexto}` : ''}
                {h.registradoPor ? ` · por ${h.registradoPor}` : ''}
              </li>
            ))}
          </ol>
        </details>
      ) : (
        <Aviso tipo="atencao" titulo="Nenhum consentimento registrado." />
      )}
    </div>
  );
}
