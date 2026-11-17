import { nivelDoPerfil } from '@gabinete/autorizacao';
import { formatarReais, type RespostaDaSessao } from '@gabinete/compartilhado';
import { FileText, History, SlidersHorizontal } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useDespesa } from '../api/financeiro';
import { Guias, PainelDaGuia, usePrefixoDeGuias, type ItemDeGuia } from '../componentes/guias';
import { Historico } from '../componentes/historico';
import { Modal } from '../componentes/modal';
import { formatarPrazo } from '../componentes/quadro';
import { Propriedades } from '../componentes/propriedades';
import { Aviso, AvisoDeErro, Botao, Carregando, Selo } from '../componentes/ui';
import { formatarDataHora } from '../formatos';
import { nomesDosMeses, rotuloDoStatusDaDespesa } from '../rotulos';
import { AcoesDaDespesa } from './AcoesDaDespesa';
import { Comprovantes } from './ComprovantesDaDespesa';
import { FormularioDaDespesa, type DadosDoFormularioDaDespesa } from './FormularioDaDespesa';
import { useAcaoDaDespesa } from './useAcaoDaDespesa';

type Guia = 'detalhes' | 'historico' | 'acoes';

/** Ficha da despesa: dados e comprovantes, histórico e ações (enviar, decidir com a segregação de função, acompanhar, cancelar). */
export function FichaDaDespesa({
  id,
  sessao,
  aoFechar,
}: {
  id: number;
  sessao: RespostaDaSessao;
  aoFechar: () => void;
}) {
  const { data: ficha, isLoading, error } = useDespesa(id);
  const [guia, setGuia] = useState<Guia>('detalhes');
  const [editando, setEditando] = useState(false);
  const prefixo = usePrefixoDeGuias();
  const editar = useAcaoDaDespesa(id, 'Dados salvos');
  const nivel = nivelDoPerfil[sessao.usuario.perfil];
  const podeMexer =
    ficha !== undefined &&
    (nivel >= 3 ||
      ficha.lancadaPor.id === sessao.usuario.id ||
      ficha.responsavel.id === sessao.usuario.id);
  const mostraAcoes =
    ficha !== undefined && ficha.status !== 'cancelada' && (podeMexer || nivel >= 3);

  const guias: ItemDeGuia<Guia>[] = ficha
    ? [
        { id: 'detalhes', rotulo: 'Detalhes', icone: <FileText size={14} aria-hidden="true" /> },
        {
          id: 'historico',
          rotulo: 'Histórico',
          icone: <History size={14} aria-hidden="true" />,
          contagem: ficha.movimentacoes.length,
        },
        ...(mostraAcoes
          ? ([
              {
                id: 'acoes',
                rotulo: 'Ações',
                icone: <SlidersHorizontal size={14} aria-hidden="true" />,
              },
            ] as ItemDeGuia<Guia>[])
          : []),
      ]
    : [];
  const painel = (g: Guia, conteudo: ReactNode) =>
    guias.some((x) => x.id === g) ? (
      <PainelDaGuia id={g} prefixo={prefixo} ativa={guia === g}>
        {conteudo}
      </PainelDaGuia>
    ) : null;

  const salvar = (d: DadosDoFormularioDaDespesa) =>
    editar.mutate(
      {
        metodo: 'PATCH',
        caminho: '',
        corpo: {
          categoriaId: d.categoriaId,
          descricao: d.descricao,
          valor: d.valor,
          dataDocumento: d.dataDocumento,
          fornecedorNome: d.fornecedorNome,
          fornecedorDocumento: d.fornecedorDocumento,
          numeroDocumento: d.numeroDocumento,
        },
      },
      { onSuccess: () => setEditando(false) },
    );

  return (
    <Modal
      titulo={ficha ? ficha.descricao : 'Despesa'}
      tamanho="xl"
      classe="modal--ficha"
      aoFechar={aoFechar}
    >
      {isLoading || error ? (
        <div className="ficha-topo">
          {isLoading ? <Carregando /> : null}
          <AvisoDeErro erro={error} />
        </div>
      ) : null}
      {ficha ? (
        <>
          <div className="ficha-topo">
            <div className="ficha-selos">
              <Selo
                tom={
                  ficha.status === 'reprovada' ||
                  ficha.status === 'cancelada' ||
                  ficha.status === 'glosada'
                    ? 'perigo'
                    : 'primario'
                }
                ponto
              >
                {rotuloDoStatusDaDespesa[ficha.status]}
              </Selo>
              <Selo tom="neutro">{formatarReais(ficha.valor)}</Selo>
              <Selo tom="neutro">
                {nomesDosMeses[ficha.competencia.mes - 1]}/{ficha.competencia.ano}
              </Selo>
              {ficha.foraDoPrazo ? (
                <Selo tom="atencao" ponto>
                  Fora do prazo de apresentação
                </Selo>
              ) : null}
              {ficha.decisaoPeloProprioLancador ? (
                <Selo tom="info">Decidida por quem lançou</Selo>
              ) : null}
            </div>
            {ficha.status === 'reprovada' ? (
              <Aviso tipo="atencao" titulo="Despesa reprovada.">
                {ficha.motivoReprovacao}
              </Aviso>
            ) : null}
            {ficha.status === 'cancelada' ? (
              <Aviso tipo="atencao" titulo="Despesa cancelada. Ela não se altera mais.">
                {ficha.justificativaCancelamento}
              </Aviso>
            ) : null}
            {ficha.competenciaEncerrada ? (
              <Aviso tipo="info" titulo="A competência está encerrada." />
            ) : null}
          </div>
          <Guias
            rotulo="Seções da despesa"
            prefixo={prefixo}
            valor={guia}
            aoMudar={setGuia}
            itens={guias}
          />
          <div className="ficha-rolagem">
            {painel(
              'detalhes',
              editando ? (
                <FormularioDaDespesa
                  sessao={sessao}
                  despesa={ficha}
                  rotuloDeEnviar="Salvar dados"
                  enviando={editar.isPending}
                  aoEnviar={salvar}
                  aoCancelar={() => setEditando(false)}
                  erro={<AvisoDeErro erro={editar.error} />}
                />
              ) : (
                <>
                  <Propriedades
                    colunas
                    itens={[
                      { rotulo: 'Categoria', valor: ficha.categoria.nome },
                      { rotulo: 'Data do documento', valor: formatarPrazo(ficha.dataDocumento) },
                      {
                        rotulo: 'Fornecedor',
                        valor: `${ficha.fornecedor.nome} · ${ficha.fornecedor.documento}`,
                      },
                      { rotulo: 'Número do documento', valor: ficha.numeroDocumento },
                      { rotulo: 'Responsável', valor: ficha.responsavel.nome },
                      {
                        rotulo: 'Lançada por',
                        valor: `${ficha.lancadaPor.nome}, ${formatarDataHora(ficha.criadaEm)}`,
                      },
                      ficha.decididaPor
                        ? {
                            rotulo: 'Decidida por',
                            valor: `${ficha.decididaPor}${ficha.decididaEm ? `, ${formatarDataHora(ficha.decididaEm)}` : ''}`,
                          }
                        : false,
                    ]}
                  />
                  <Comprovantes ficha={ficha} podeMexer={podeMexer} />
                  {ficha.status === 'lancada' && podeMexer ? (
                    <Botao pequeno variante="secundario" onClick={() => setEditando(true)}>
                      Editar dados
                    </Botao>
                  ) : null}
                </>
              ),
            )}
            {painel(
              'historico',
              <Historico movimentacoes={ficha.movimentacoes} inicio="Lançada em" />,
            )}
            {painel(
              'acoes',
              <AcoesDaDespesa
                ficha={ficha}
                sessao={sessao}
                key={`${ficha.id}-${ficha.etapa.id}`}
              />,
            )}
          </div>
        </>
      ) : null}
    </Modal>
  );
}
