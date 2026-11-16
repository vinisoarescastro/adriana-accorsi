import {
  perfisComTodasAsHabilitacoes,
  prioridades,
  type Area,
  type Prioridade,
} from '@gabinete/compartilhado';
import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { Pencil } from 'lucide-react';
import { useMemo, useState } from 'react';
import { chamar } from '../api/cliente';
import { useEquipe } from '../api/consultas';
import { nomeCurto } from '../formatos';
import { rotuloDaPrioridade } from '../rotulos';
import { Propriedades, type Propriedade } from './propriedades';
import { formatarPrazo } from './quadro';
import {
  GrupoDeAvatares,
  rotuloDosResponsaveis,
  todosOsResponsaveis,
  type PessoaResumida,
} from './responsaveis';
import { SeletorDePessoas } from './seletor-de-pessoas';
import { SeloDePrioridade } from './situacao';
import { useToast } from './toast';
import { AvisoDeErro, Botao, Campo } from './ui';

export interface DadosDoItem {
  readonly titulo: string;
  readonly prioridade: Prioridade;
  readonly prazo: string | null;
  readonly responsavel: PessoaResumida;
  readonly corresponsaveis?: readonly PessoaResumida[] | undefined;
}

/**
 * Os dados do item (título, prioridade, prazo e responsáveis), editáveis na própria guia de detalhes.
 * "Editar dados" abre os campos; "Salvar" grava o que mudou. Trocar os responsáveis (o principal e os
 * demais) exige a permissão de reatribuir: quem só altera não vê essa parte.
 */
export function DadosEditaveis({
  caminho,
  chaveDaFicha,
  chavesParaAtualizar,
  item,
  podeEditar,
  podeTrocarResponsaveis,
  area,
  extras = [],
}: {
  /** Endereço do registro na API, por exemplo `/api/demandas/7`. */
  caminho: string;
  chaveDaFicha: QueryKey;
  chavesParaAtualizar: QueryKey;
  item: DadosDoItem;
  podeEditar: boolean;
  podeTrocarResponsaveis: boolean;
  /** Só quem tem esta habilitação pode responder (Atendimento nas demandas). */
  area?: Area;
  /** Outras linhas só de leitura (quem registrou, vínculo…). */
  extras?: readonly (Propriedade | null | false)[];
}) {
  const cliente = useQueryClient();
  const avisar = useToast();
  const { data: equipe } = useEquipe();
  const [editando, setEditando] = useState(false);
  const [titulo, setTitulo] = useState(item.titulo);
  const [prioridade, setPrioridade] = useState<Prioridade>(item.prioridade);
  const [prazo, setPrazo] = useState(item.prazo ?? '');
  const [principal, setPrincipal] = useState(item.responsavel.id);
  const [outros, setOutros] = useState<number[]>((item.corresponsaveis ?? []).map((c) => c.id));

  const atuais = todosOsResponsaveis(item.responsavel, item.corresponsaveis);
  // Quem pode responder: ativos (com a habilitação, se for o caso) e quem já responde agora.
  const opcoes = useMemo(() => {
    const aptos = (equipe ?? []).filter(
      (u) =>
        u.situacao === 'ativo' &&
        (!area || u.habilitacoes.includes(area) || perfisComTodasAsHabilitacoes.includes(u.perfil)),
    );
    const mapa = new Map<number, { id: number; nome: string; temFoto: boolean }>();
    for (const u of aptos) mapa.set(u.id, { id: u.id, nome: u.nome, temFoto: u.temFoto });
    for (const r of atuais) if (!mapa.has(r.id)) mapa.set(r.id, { ...r, temFoto: false });
    return [...mapa.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [equipe, area, atuais]);

  const salvar = useMutation({
    mutationFn: async () => {
      let resposta: unknown;
      const mudouDados =
        titulo.trim() !== item.titulo ||
        prioridade !== item.prioridade ||
        (prazo || null) !== item.prazo;
      if (mudouDados) {
        resposta = await chamar<unknown>('PATCH', caminho, {
          corpo: { titulo: titulo.trim(), prioridade, prazo: prazo || null },
        });
      }
      const listaAtual = (item.corresponsaveis ?? [])
        .map((c) => c.id)
        .sort()
        .join(',');
      const mudouResponsaveis =
        podeTrocarResponsaveis &&
        (principal !== item.responsavel.id || [...outros].sort().join(',') !== listaAtual);
      if (mudouResponsaveis) {
        resposta = await chamar<unknown>('POST', `${caminho}/reatribuir`, {
          corpo: {
            ...(principal !== item.responsavel.id ? { responsavelId: principal } : {}),
            corresponsaveis: outros.filter((id) => id !== principal),
          },
        });
      }
      return resposta;
    },
    onSuccess: async (ficha) => {
      if (ficha) cliente.setQueryData(chaveDaFicha, ficha);
      await cliente.invalidateQueries({ queryKey: chavesParaAtualizar });
      avisar({ tom: 'sucesso', titulo: 'Dados salvos' });
      setEditando(false);
    },
    onError: (erro) =>
      avisar({ tom: 'erro', titulo: 'Não foi possível salvar os dados', texto: erro.message }),
  });

  const abrir = () => {
    setTitulo(item.titulo);
    setPrioridade(item.prioridade);
    setPrazo(item.prazo ?? '');
    setPrincipal(item.responsavel.id);
    setOutros((item.corresponsaveis ?? []).map((c) => c.id));
    setEditando(true);
  };

  const nomes = atuais.map((r) => r.nome);
  const linhas: (Propriedade | null | false)[] = [
    {
      rotulo: atuais.length > 1 ? 'Responsáveis' : 'Responsável',
      valor: (
        <span className="propriedades__pessoa" title={nomes.join(', ')}>
          <GrupoDeAvatares nomes={nomes} />
          {nomes.length > 3 ? rotuloDosResponsaveis(nomes) : nomes.map(nomeCurto).join(', ')}
        </span>
      ),
    },
    { rotulo: 'Prazo', valor: item.prazo ? formatarPrazo(item.prazo) : 'Sem prazo' },
    { rotulo: 'Prioridade', valor: <SeloDePrioridade prioridade={item.prioridade} /> },
    ...extras,
  ];

  return (
    <section className="dados">
      <div className="descricao__cabecalho">
        <h3 className="ficha-secao">Dados</h3>
        {podeEditar && !editando ? (
          <Botao
            pequeno
            variante="fantasma"
            icone={<Pencil size={14} aria-hidden="true" />}
            onClick={abrir}
          >
            Editar dados
          </Botao>
        ) : null}
      </div>

      {editando ? (
        <div className="dados__edicao">
          <AvisoDeErro erro={salvar.error} />
          <Campo rotulo="Título">
            {(p) => (
              <input
                {...p}
                required
                maxLength={200}
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
              />
            )}
          </Campo>
          {podeTrocarResponsaveis ? (
            <>
              <Campo rotulo="Responsável principal">
                {(p) => (
                  <select
                    {...p}
                    value={principal}
                    onChange={(e) => {
                      const novo = Number(e.target.value);
                      setPrincipal(novo);
                      setOutros((o) => o.filter((id) => id !== novo));
                    }}
                  >
                    {opcoes.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.nome}
                      </option>
                    ))}
                  </select>
                )}
              </Campo>
              <SeletorDePessoas
                rotulo="Outros responsáveis"
                opcoes={opcoes.filter((o) => o.id !== principal)}
                valor={outros}
                aoMudar={setOutros}
                vazio="Ninguém mais pode responder."
              />
            </>
          ) : null}
          <div className="grade-formulario">
            <Campo rotulo="Prioridade">
              {(p) => (
                <select
                  {...p}
                  value={prioridade}
                  onChange={(e) => setPrioridade(e.target.value as Prioridade)}
                >
                  {prioridades.map((v) => (
                    <option key={v} value={v}>
                      {rotuloDaPrioridade[v]}
                    </option>
                  ))}
                </select>
              )}
            </Campo>
            <Campo rotulo="Prazo">
              {(p) => (
                <input
                  {...p}
                  type="date"
                  value={prazo}
                  onChange={(e) => setPrazo(e.target.value)}
                />
              )}
            </Campo>
          </div>
          <div className="acoes">
            <Botao
              pequeno
              carregando={salvar.isPending}
              disabled={!titulo.trim()}
              onClick={() => salvar.mutate()}
            >
              Salvar dados
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
      ) : (
        <Propriedades colunas itens={linhas} />
      )}
    </section>
  );
}
