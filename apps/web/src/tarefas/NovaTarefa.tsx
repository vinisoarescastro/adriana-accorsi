import { nivelDoPerfil } from '@gabinete/autorizacao';
import {
  prioridades,
  type Prioridade,
  type RespostaDaSessao,
  type TarefaFicha,
} from '@gabinete/compartilhado';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link2 } from 'lucide-react';
import { useState } from 'react';
import { chamar } from '../api/cliente';
import { useEquipe } from '../api/consultas';
import { chavesDoTrabalho } from '../api/trabalho';
import { CampoComMencoes, idsMencionados, useColegas } from '../componentes/mencoes';
import { AvisoDeErro, Botao, Campo } from '../componentes/ui';
import { Modal } from '../componentes/modal';
import { SeletorDePessoas } from '../componentes/seletor-de-pessoas';
import { useToast } from '../componentes/toast';
import { hojeNoGabinete } from '../formatos';
import { rotuloDaPrioridade } from '../rotulos';

/**
 * Nova tarefa. O Assessor Externo cria só para si (a escolha do responsável nem aparece); o Assessor
 * Interno em diante pode designar outra pessoa, que recebe um aviso. O prazo não pode ser anterior a hoje.
 */
export function NovaTarefa({
  sessao,
  aoFechar,
  aoAbrir,
}: {
  sessao: RespostaDaSessao;
  aoFechar: () => void;
  aoAbrir: (id: number) => void;
}) {
  const cliente = useQueryClient();
  const avisar = useToast();
  const { data: equipe } = useEquipe();
  const podeDesignar = nivelDoPerfil[sessao.usuario.perfil] >= 2;
  const colegas = useColegas(sessao);

  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [prioridade, setPrioridade] = useState<Prioridade>('media');
  const [prazo, setPrazo] = useState('');
  const [responsavelId, setResponsavelId] = useState('');
  const [outros, setOutros] = useState<number[]>([]);
  const [demandaId, setDemandaId] = useState('');
  const [ligando, setLigando] = useState(false);

  const criar = useMutation({
    mutationFn: () =>
      chamar<TarefaFicha>('POST', '/api/tarefas', {
        corpo: {
          titulo: titulo.trim(),
          ...(descricao.trim()
            ? { descricao: descricao.trim(), mencoes: idsMencionados(descricao, colegas) }
            : {}),
          prioridade,
          ...(prazo ? { prazo } : {}),
          ...(responsavelId ? { responsavelId: Number(responsavelId) } : {}),
          corresponsaveis: outros.filter((id) => id !== Number(responsavelId)),
          ...(demandaId ? { vinculo: { tipo: 'demanda', id: Number(demandaId) } } : {}),
        },
      }),
    onSuccess: async (tarefa) => {
      await cliente.invalidateQueries({ queryKey: chavesDoTrabalho.tudo });
      avisar({ tom: 'sucesso', titulo: 'Tarefa criada' });
      aoAbrir(tarefa.id);
    },
  });

  return (
    <Modal titulo="Nova tarefa" tamanho="lg" aoFechar={aoFechar}>
      <form
        className="formulario-do-modal"
        aria-label="Nova tarefa"
        onSubmit={(e) => {
          e.preventDefault();
          criar.mutate();
        }}
      >
        <AvisoDeErro erro={criar.error} />
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
        <CampoComMencoes
          rotulo="Descrição (opcional)"
          valor={descricao}
          aoMudar={setDescricao}
          colegas={colegas}
          maxLength={5000}
        />
        <div className="grade-formulario">
          {podeDesignar ? (
            <Campo rotulo="Responsável" ajuda="Quem recebe a tarefa é avisado. Em branco: você.">
              {(p) => (
                <select
                  {...p}
                  value={responsavelId}
                  onChange={(e) => setResponsavelId(e.target.value)}
                >
                  <option value="">Eu mesmo</option>
                  {(equipe ?? [])
                    .filter((u) => u.situacao === 'ativo' && u.id !== sessao.usuario.id)
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.nome}
                      </option>
                    ))}
                </select>
              )}
            </Campo>
          ) : null}
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
          <Campo rotulo="Prazo (opcional)">
            {(p) => (
              <input
                {...p}
                type="date"
                min={hojeNoGabinete()}
                value={prazo}
                onChange={(e) => setPrazo(e.target.value)}
              />
            )}
          </Campo>
        </div>
        {podeDesignar ? (
          <SeletorDePessoas
            rotulo="Outros responsáveis (opcional)"
            opcoes={(equipe ?? [])
              .filter((u) => u.situacao === 'ativo' && u.id !== Number(responsavelId))
              .map((u) => ({ id: u.id, nome: u.nome, temFoto: u.temFoto }))}
            valor={outros}
            aoMudar={setOutros}
          />
        ) : null}
        {ligando ? (
          <Campo rotulo="Número da demanda" ajuda="Liga a tarefa a uma demanda sua.">
            {(p) => (
              <input
                {...p}
                inputMode="numeric"
                pattern="[0-9]*"
                value={demandaId}
                onChange={(e) => setDemandaId(e.target.value.replace(/\D/g, ''))}
              />
            )}
          </Campo>
        ) : (
          <Botao
            variante="fantasma"
            pequeno
            icone={<Link2 size={14} aria-hidden="true" />}
            onClick={() => setLigando(true)}
          >
            Ligar a uma demanda
          </Botao>
        )}
        <div className="acoes">
          <Botao type="submit" disabled={!titulo.trim()} carregando={criar.isPending}>
            Criar tarefa
          </Botao>
          <Botao variante="secundario" onClick={aoFechar}>
            Cancelar
          </Botao>
        </div>
      </form>
    </Modal>
  );
}
