import { pode } from '@gabinete/autorizacao';
import {
  exibicoesDeNome,
  exibicoesDeTelefone,
  limitesDeExpiracaoEmDias,
  type PoliticaDePublicacaoDto,
  type PoliticaEHistorico,
  type RespostaDaSessao,
} from '@gabinete/compartilhado';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { chavesDoAtendimento } from '../api/atendimento';
import { usePolitica } from '../api/cidadao';
import { chamar } from '../api/cliente';
import { Cartao } from '../componentes/cartao';
import { useToast } from '../componentes/toast';
import { AvisoDeErro, Botao, Campo, Carregando } from '../componentes/ui';
import { formatarDataHora } from '../formatos';
import { rotuloDaExibicaoDeNome, rotuloDaExibicaoDeTelefone } from '../rotulos';

const resumo = (p: PoliticaDePublicacaoDto) =>
  `título ${p.exibirTitulo ? 'visível' : 'oculto'} · ${rotuloDaExibicaoDeNome[p.exibicaoNome].toLowerCase()} · ${rotuloDaExibicaoDeTelefone[p.exibicaoTelefone].toLowerCase()} · link vale ${p.expiracaoDias} dias após o desfecho`;

function Formulario({ vigente }: { vigente: PoliticaDePublicacaoDto }) {
  const cliente = useQueryClient();
  const [exibirTitulo, setExibirTitulo] = useState(vigente.exibirTitulo);
  const [exibicaoNome, setExibicaoNome] = useState(vigente.exibicaoNome);
  const [exibicaoTelefone, setExibicaoTelefone] = useState(vigente.exibicaoTelefone);
  const [dias, setDias] = useState(String(vigente.expiracaoDias));

  const diasNumero = Number(dias);
  const diasValidos =
    Number.isInteger(diasNumero) &&
    diasNumero >= limitesDeExpiracaoEmDias.minimo &&
    diasNumero <= limitesDeExpiracaoEmDias.maximo;

  const avisar = useToast();
  const salvar = useMutation({
    mutationFn: () =>
      chamar<PoliticaEHistorico>('PUT', '/api/publicacao/politica', {
        corpo: { exibirTitulo, exibicaoNome, exibicaoTelefone, expiracaoDias: diasNumero },
      }),
    onSuccess: async () => {
      await cliente.invalidateQueries({ queryKey: chavesDoAtendimento.tudo });
      avisar({ tom: 'sucesso', titulo: 'Nova versão da política salva' });
    },
  });
  const enviar = (e: FormEvent) => {
    e.preventDefault();
    salvar.mutate();
  };

  return (
    <form onSubmit={enviar} noValidate>
      <AvisoDeErro erro={salvar.error} />
      <div className="grade-formulario">
        <Campo rotulo="Nome do solicitante na página pública">
          {(p) => (
            <select
              {...p}
              value={exibicaoNome}
              onChange={(e) => setExibicaoNome(e.target.value as typeof exibicaoNome)}
            >
              {exibicoesDeNome.map((o) => (
                <option key={o} value={o}>
                  {rotuloDaExibicaoDeNome[o]}
                </option>
              ))}
            </select>
          )}
        </Campo>
        <Campo rotulo="Telefone na página pública">
          {(p) => (
            <select
              {...p}
              value={exibicaoTelefone}
              onChange={(e) => setExibicaoTelefone(e.target.value as typeof exibicaoTelefone)}
            >
              {exibicoesDeTelefone.map((o) => (
                <option key={o} value={o}>
                  {rotuloDaExibicaoDeTelefone[o]}
                </option>
              ))}
            </select>
          )}
        </Campo>
        <Campo
          rotulo="Dias de validade do link após o desfecho"
          ajuda={`De ${limitesDeExpiracaoEmDias.minimo} a ${limitesDeExpiracaoEmDias.maximo}. Passado o prazo, o link responde como se não existisse.`}
          {...(dias && !diasValidos
            ? { erro: 'Informe um número inteiro dentro do intervalo.' }
            : {})}
        >
          {(p) => (
            <input
              {...p}
              type="number"
              inputMode="numeric"
              value={dias}
              onChange={(e) => setDias(e.target.value)}
            />
          )}
        </Campo>
      </div>
      <label className="opcao">
        <input
          type="checkbox"
          checked={exibirTitulo}
          onChange={(e) => setExibirTitulo(e.target.checked)}
        />
        Mostrar o título da demanda ao cidadão (por padrão, não)
      </label>
      <div className="acoes">
        <Botao type="submit" disabled={!diasValidos} carregando={salvar.isPending}>
          Salvar nova versão da política
        </Botao>
      </div>
    </form>
  );
}

/**
 * Política de publicação: o que o cidadão pode ver. Só o Administrador altera; cada alteração fecha a
 * versão vigente e abre a seguinte, e o histórico de versões fica visível.
 */
export function PoliticaDePublicacao({ sessao }: { sessao: RespostaDaSessao }) {
  const autoridade = { perfil: sessao.usuario.perfil, habilitacoes: sessao.usuario.habilitacoes };
  const pode_ver = pode('publicacao.consultar_politica', autoridade);
  const { data, isLoading, error } = usePolitica(pode_ver);
  if (!pode_ver) return null;

  return (
    <Cartao
      rotulo="Política de publicação"
      titulo="Política de publicação"
      descricao="O que o cidadão vê na página de acompanhamento. Nada é público por padrão: o andamento é sempre um texto escrito para ele, e comentários internos, documentos, prioridade e responsável nunca aparecem."
    >
      <AvisoDeErro erro={error} />
      {isLoading ? <Carregando /> : null}
      {data ? (
        <>
          <p>
            <strong>Vigente desde {formatarDataHora(data.vigente.vigenteDesde)}:</strong>{' '}
            {resumo(data.vigente)}.
          </p>
          {pode('publicacao.alterar_politica', autoridade) ? (
            <Formulario key={data.vigente.id} vigente={data.vigente} />
          ) : (
            <p className="campo__ajuda">Só o Administrador altera a política.</p>
          )}
          {data.anteriores.length > 0 ? (
            <details>
              <summary>Versões anteriores ({data.anteriores.length})</summary>
              <ol className="lista-simples">
                {data.anteriores.map((p) => (
                  <li key={p.id}>
                    {formatarDataHora(p.vigenteDesde)} até{' '}
                    {p.vigenteAte ? formatarDataHora(p.vigenteAte) : ''}: {resumo(p)}
                    {p.criadoPor ? ` (por ${p.criadoPor})` : ''}
                  </li>
                ))}
              </ol>
            </details>
          ) : null}
        </>
      ) : null}
    </Cartao>
  );
}
