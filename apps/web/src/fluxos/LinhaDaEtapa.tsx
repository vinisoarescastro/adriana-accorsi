import type { EtapaDoFluxo, FluxoDeTrabalho } from '@gabinete/compartilhado';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { chamar } from '../api/cliente';
import { chaves } from '../api/consultas';
import { AvisoDeErro, Botao, Campo, Selo, type TomDoSelo } from '../componentes/ui';
import { rotuloDoPapel } from '../rotulos';

export const tomDoPapel: Record<EtapaDoFluxo['papel'], TomDoSelo> = {
  entrada: 'info',
  intermediaria: 'neutro',
  conclusao: 'sucesso',
  arquivamento: 'neutro',
};

export function LinhaDaEtapa({
  etapa,
  fluxo,
  ajusta,
  estrutura,
}: {
  etapa: EtapaDoFluxo;
  fluxo: FluxoDeTrabalho;
  ajusta: boolean;
  estrutura: boolean;
}) {
  const cliente = useQueryClient();
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState(etapa.nomeInterno);
  const [ordem, setOrdem] = useState(String(etapa.ordem));
  const [prazo, setPrazo] = useState(etapa.prazoPadraoDias?.toString() ?? '');
  const [rotulo, setRotulo] = useState(etapa.rotuloPublico ?? '');
  const [visivel, setVisivel] = useState(etapa.visivelPublico);
  const ehDemanda = fluxo.tipo === 'demanda';

  const atualizar = () => cliente.invalidateQueries({ queryKey: chaves.fluxos });
  const salvar = useMutation({
    mutationFn: () =>
      chamar('PATCH', `/api/fluxos/etapas/${etapa.id}`, {
        corpo: {
          nomeInterno: nome,
          ordem: Number(ordem),
          prazoPadraoDias: prazo ? Number(prazo) : null,
          ...(ehDemanda ? { rotuloPublico: rotulo || null, visivelPublico: visivel } : {}),
        },
      }),
    onSuccess: async () => {
      setEditando(false);
      await atualizar();
    },
  });
  const situacao = useMutation({
    mutationFn: () =>
      chamar('PUT', `/api/fluxos/etapas/${etapa.id}/situacao`, {
        corpo: { situacao: etapa.situacao === 'ativa' ? 'inativa' : 'ativa' },
      }),
    onSuccess: atualizar,
  });

  const fixa = etapa.papel === 'entrada' || etapa.papel === 'arquivamento';

  return (
    <>
      <tr>
        <td className="fluxo-ordem">{etapa.ordem}</td>
        <td className={`fluxo-nome${etapa.situacao === 'inativa' ? ' etapa-inativa' : ''}`}>
          {etapa.nomeInterno}
        </td>
        <td>
          <Selo tom={tomDoPapel[etapa.papel]}>{rotuloDoPapel[etapa.papel]}</Selo>
        </td>
        {ehDemanda ? (
          <>
            <td>{etapa.rotuloPublico ?? <span className="tabela__discreto">—</span>}</td>
            <td>{etapa.visivelPublico ? 'Sim' : <span className="tabela__discreto">Não</span>}</td>
          </>
        ) : null}
        <td>
          {etapa.prazoPadraoDias ? (
            `${etapa.prazoPadraoDias} dias`
          ) : (
            <span className="tabela__discreto">—</span>
          )}
        </td>
        <td>
          <Selo tom={etapa.situacao === 'ativa' ? 'sucesso' : 'neutro'} ponto>
            {etapa.situacao === 'ativa' ? 'Ativa' : 'Inativa'}
          </Selo>
        </td>
        {ajusta || estrutura ? (
          <td>
            <div className="acoes">
              {ajusta ? (
                <Botao pequeno variante="secundario" onClick={() => setEditando((v) => !v)}>
                  {editando ? 'Cancelar' : 'Ajustar'}
                </Botao>
              ) : null}
              {estrutura && !fixa ? (
                <Botao
                  pequeno
                  variante="secundario"
                  onClick={() => situacao.mutate()}
                  disabled={situacao.isPending}
                >
                  {etapa.situacao === 'ativa' ? 'Desativar' : 'Reativar'}
                </Botao>
              ) : null}
            </div>
          </td>
        ) : null}
      </tr>
      {situacao.error ? (
        <tr>
          <td colSpan={8}>
            <AvisoDeErro erro={situacao.error} />
          </td>
        </tr>
      ) : null}
      {editando ? (
        <tr>
          <td colSpan={8}>
            <div className="painel-do-usuario">
              <AvisoDeErro erro={salvar.error} />
              <div className="grade-formulario">
                <Campo rotulo="Nome interno">
                  {(p) => <input {...p} value={nome} onChange={(e) => setNome(e.target.value)} />}
                </Campo>
                <Campo rotulo="Ordem (só de apresentação)">
                  {(p) => (
                    <input
                      {...p}
                      type="number"
                      min={1}
                      value={ordem}
                      onChange={(e) => setOrdem(e.target.value)}
                    />
                  )}
                </Campo>
                <Campo rotulo="Prazo padrão (dias)">
                  {(p) => (
                    <input
                      {...p}
                      type="number"
                      min={1}
                      value={prazo}
                      onChange={(e) => setPrazo(e.target.value)}
                    />
                  )}
                </Campo>
                {ehDemanda ? (
                  <Campo rotulo="Rótulo mostrado ao cidadão">
                    {(p) => (
                      <input
                        {...p}
                        value={rotulo}
                        onChange={(e) => setRotulo(e.target.value)}
                        maxLength={60}
                      />
                    )}
                  </Campo>
                ) : null}
              </div>
              {ehDemanda ? (
                <label className="opcao">
                  <input
                    type="checkbox"
                    checked={visivel}
                    onChange={(e) => setVisivel(e.target.checked)}
                  />
                  Visível ao cidadão
                </label>
              ) : null}
              <p>
                <Botao pequeno onClick={() => salvar.mutate()} disabled={salvar.isPending || !nome}>
                  Salvar etapa
                </Botao>
              </p>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}
