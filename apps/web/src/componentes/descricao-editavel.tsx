import type { RespostaDaSessao } from '@gabinete/compartilhado';
import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { Pencil } from 'lucide-react';
import { useState } from 'react';
import { chamar } from '../api/cliente';
import {
  CampoComMencoes,
  TextoComMencoes,
  idsMencionados,
  useColegas,
  useNomesDaEquipe,
} from './mencoes';
import { useToast } from './toast';
import { AvisoDeErro, Botao } from './ui';
import type { Area } from '@gabinete/compartilhado';

/**
 * A descrição de uma demanda ou tarefa, editável ali mesmo, na guia de detalhes: o lápis abre o campo
 * (com menções @), "Salvar" grava e a ficha se atualiza na hora. Quem não pode alterar só lê.
 */
export function DescricaoEditavel({
  sessao,
  caminho,
  chaveDaFicha,
  chavesParaAtualizar,
  texto,
  podeEditar,
  area,
}: {
  sessao: RespostaDaSessao;
  /** Endereço do registro na API, por exemplo `/api/demandas/7`. */
  caminho: string;
  chaveDaFicha: QueryKey;
  chavesParaAtualizar: QueryKey;
  texto: string | null;
  podeEditar: boolean;
  area?: Area;
}) {
  const cliente = useQueryClient();
  const avisar = useToast();
  const colegas = useColegas(sessao, area);
  const nomes = useNomesDaEquipe();
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState(texto ?? '');

  const salvar = useMutation({
    mutationFn: () =>
      chamar<unknown>('PATCH', caminho, {
        corpo: { descricao: rascunho.trim() || null, mencoes: idsMencionados(rascunho, colegas) },
      }),
    onSuccess: async (ficha) => {
      cliente.setQueryData(chaveDaFicha, ficha);
      await cliente.invalidateQueries({ queryKey: chavesParaAtualizar });
      avisar({ tom: 'sucesso', titulo: 'Descrição salva' });
      setEditando(false);
    },
    onError: (erro) =>
      avisar({ tom: 'erro', titulo: 'Não foi possível salvar a descrição', texto: erro.message }),
  });

  return (
    <section className="descricao">
      <div className="descricao__cabecalho">
        <h3 className="ficha-secao">Descrição</h3>
        {podeEditar && !editando ? (
          <Botao
            pequeno
            variante="fantasma"
            icone={<Pencil size={14} aria-hidden="true" />}
            onClick={() => {
              setRascunho(texto ?? '');
              setEditando(true);
            }}
          >
            Editar descrição
          </Botao>
        ) : null}
      </div>

      {editando ? (
        <div className="descricao__edicao">
          <AvisoDeErro erro={salvar.error} />
          <CampoComMencoes
            rotulo="Descrição"
            ajuda="Mencione colegas com @: eles recebem um aviso."
            valor={rascunho}
            aoMudar={setRascunho}
            colegas={colegas}
            linhas={5}
            maxLength={5000}
          />
          <div className="acoes">
            <Botao pequeno carregando={salvar.isPending} onClick={() => salvar.mutate()}>
              Salvar descrição
            </Botao>
            <Botao
              pequeno
              variante="secundario"
              disabled={salvar.isPending}
              onClick={() => {
                salvar.reset();
                setEditando(false);
              }}
            >
              Cancelar
            </Botao>
          </div>
        </div>
      ) : texto ? (
        <p className="ficha-texto">
          <TextoComMencoes texto={texto} nomes={nomes} />
        </p>
      ) : (
        <p className="campo__ajuda">Sem descrição.</p>
      )}
    </section>
  );
}
