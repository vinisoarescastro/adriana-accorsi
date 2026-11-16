import { pode } from '@gabinete/autorizacao';
import type { EtapaDoFluxo, FluxoDeTrabalho, RespostaDaSessao } from '@gabinete/compartilhado';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { chamar } from '../api/cliente';
import { chaves, useFluxos } from '../api/consultas';
import { CabecalhoDaPagina } from '../componentes/cabecalho';
import { EsqueletoDeTabela } from '../componentes/tabela';
import { AvisoDeErro, Botao, Campo, Selo } from '../componentes/ui';
import { rotuloDoFluxo, rotuloDoPapel } from '../rotulos';

function LinhaDaEtapa({
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
        <td>{etapa.ordem}</td>
        <td className={etapa.situacao === 'inativa' ? 'etapa-inativa' : undefined}>
          {etapa.nomeInterno}
        </td>
        <td>{rotuloDoPapel[etapa.papel]}</td>
        {ehDemanda ? (
          <>
            <td>{etapa.rotuloPublico ?? '-'}</td>
            <td>{etapa.visivelPublico ? 'Sim' : 'Não'}</td>
          </>
        ) : null}
        <td>{etapa.prazoPadraoDias ? `${etapa.prazoPadraoDias} dias` : '-'}</td>
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
          <td colSpan={9}>
            <AvisoDeErro erro={situacao.error} />
          </td>
        </tr>
      ) : null}
      {editando ? (
        <tr>
          <td colSpan={9}>
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

function NovaEtapa({ fluxo }: { fluxo: FluxoDeTrabalho }) {
  const cliente = useQueryClient();
  const [nome, setNome] = useState('');
  const [papel, setPapel] = useState<'intermediaria' | 'conclusao'>('intermediaria');
  const criar = useMutation({
    mutationFn: () =>
      chamar('POST', `/api/fluxos/${fluxo.tipo}/etapas`, { corpo: { nomeInterno: nome, papel } }),
    onSuccess: async () => {
      setNome('');
      await cliente.invalidateQueries({ queryKey: chaves.fluxos });
    },
  });
  const enviar = (e: FormEvent) => {
    e.preventDefault();
    criar.mutate();
  };
  return (
    <form onSubmit={enviar}>
      <h3>Nova etapa</h3>
      <AvisoDeErro erro={criar.error} />
      <div className="grade-formulario">
        <Campo rotulo="Nome interno">
          {(p) => <input {...p} value={nome} onChange={(e) => setNome(e.target.value)} required />}
        </Campo>
        <Campo rotulo="Papel" ajuda="Entrada e Arquivamento são únicos e fixos em cada fluxo.">
          {(p) => (
            <select
              {...p}
              value={papel}
              onChange={(e) => setPapel(e.target.value as 'intermediaria' | 'conclusao')}
            >
              <option value="intermediaria">Intermediária</option>
              <option value="conclusao">Conclusão</option>
            </select>
          )}
        </Campo>
      </div>
      <Botao type="submit" pequeno disabled={criar.isPending || !nome}>
        Adicionar etapa
      </Botao>
    </form>
  );
}

export function PaginaFluxos({ sessao }: { sessao: RespostaDaSessao }) {
  const { data: fluxos, isLoading, error } = useFluxos();
  const autoridade = { perfil: sessao.usuario.perfil, habilitacoes: sessao.usuario.habilitacoes };
  const ajusta = pode('fluxos.ajustar', autoridade);
  const estrutura = pode('fluxos.estruturar', autoridade);

  return (
    <section>
      <CabecalhoDaPagina
        titulo="Fluxos de trabalho"
        descricao="Todo status é derivado do papel da etapa. Etapas de Entrada e de Arquivamento são únicas e não se desativam; etapa já usada em registros também não."
      />
      <AvisoDeErro erro={error} />
      {isLoading ? <EsqueletoDeTabela colunas={6} /> : null}
      {fluxos?.map((fluxo) => (
        <div key={fluxo.tipo} className="cartao cartao--tabela">
          <div className="tabela-rolavel">
            <table className="tabela">
              <caption>{rotuloDoFluxo[fluxo.tipo]}</caption>
              <thead>
                <tr>
                  <th scope="col">Ordem</th>
                  <th scope="col">Etapa</th>
                  <th scope="col">Papel</th>
                  {fluxo.tipo === 'demanda' ? (
                    <>
                      <th scope="col">Rótulo ao cidadão</th>
                      <th scope="col">Visível</th>
                    </>
                  ) : null}
                  <th scope="col">Prazo padrão</th>
                  <th scope="col">Situação</th>
                  {ajusta || estrutura ? <th scope="col">Ações</th> : null}
                </tr>
              </thead>
              <tbody>
                {fluxo.etapas.map((etapa) => (
                  <LinhaDaEtapa
                    key={etapa.id}
                    etapa={etapa}
                    fluxo={fluxo}
                    ajusta={ajusta}
                    estrutura={estrutura}
                  />
                ))}
              </tbody>
            </table>
          </div>
          {estrutura ? (
            <div className="cartao__corpo">
              <NovaEtapa fluxo={fluxo} />
            </div>
          ) : null}
        </div>
      ))}
    </section>
  );
}
