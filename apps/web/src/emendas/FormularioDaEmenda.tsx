import { nivelDoPerfil } from '@gabinete/autorizacao';
import {
  perfisComTodasAsHabilitacoes,
  type EmendaFicha,
  type RespostaDaSessao,
} from '@gabinete/compartilhado';
import { useState, type ReactNode } from 'react';
import { useEquipe } from '../api/consultas';
import { useTiposDeEmenda } from '../api/financeiro';
import {
  CampoDeDinheiro,
  dinheiroValido,
  normalizarDinheiroDigitado,
} from '../componentes/campo-de-dinheiro';
import { Botao, Campo } from '../componentes/ui';
import { hojeNoGabinete } from '../formatos';

export interface DadosDoFormularioDaEmenda {
  readonly identificacao: string;
  readonly exercicio: number;
  readonly tipoId: number;
  readonly finalidade: string;
  /** Em texto canônico ("1234.50"). */
  readonly valor: string;
  readonly prazoDestinacao: string;
  readonly prazoEmpenho: string;
  readonly prazoExecucao: string;
  readonly responsavelId: number | null;
}

/**
 * Campos da emenda, para cadastrar e editar. Identificação e finalidade são obrigatórias, o exercício vai de
 * 2000 a 2100 e o valor é o disponibilizado: o único cadastrado. No cadastro os prazos não podem ser anteriores a hoje.
 */
export function FormularioDaEmenda({
  sessao,
  emenda,
  rotuloDeEnviar,
  enviando,
  aoEnviar,
  aoCancelar,
  erro,
}: {
  sessao: RespostaDaSessao;
  emenda?: EmendaFicha | undefined;
  rotuloDeEnviar: string;
  enviando: boolean;
  aoEnviar: (d: DadosDoFormularioDaEmenda) => void;
  aoCancelar: () => void;
  erro?: ReactNode;
}) {
  const novo = emenda === undefined;
  const { data: tipos } = useTiposDeEmenda();
  const { data: equipe } = useEquipe();
  const hoje = hojeNoGabinete();

  const [identificacao, setIdentificacao] = useState(emenda?.identificacao ?? '');
  const [exercicio, setExercicio] = useState(String(emenda?.exercicio ?? Number(hoje.slice(0, 4))));
  const [tipoId, setTipoId] = useState(emenda ? String(emenda.tipo.id) : '');
  const [finalidade, setFinalidade] = useState(emenda?.finalidade ?? '');
  const [valor, setValor] = useState(
    emenda ? emenda.valores.disponibilizado.replace('.', ',') : '',
  );
  const [prazoDestinacao, setPrazoDestinacao] = useState(emenda?.prazoDestinacao ?? '');
  const [prazoEmpenho, setPrazoEmpenho] = useState(emenda?.prazoEmpenho ?? '');
  const [prazoExecucao, setPrazoExecucao] = useState(emenda?.prazoExecucao ?? '');
  const [responsavelId, setResponsavelId] = useState('');

  const tiposAtivos = (tipos ?? []).filter(
    (t) => t.situacao === 'ativa' || t.id === emenda?.tipo.id,
  );
  const tipoEscolhido = tipoId || (tiposAtivos[0] ? String(tiposAtivos[0].id) : '');
  const exercicioOk = Number(exercicio) >= 2000 && Number(exercicio) <= 2100;
  const podeDesignar = nivelDoPerfil[sessao.usuario.perfil] >= 2;
  const responsaveis = (equipe ?? []).filter(
    (u) =>
      u.situacao === 'ativo' &&
      u.id !== sessao.usuario.id &&
      nivelDoPerfil[u.perfil] >= 2 &&
      (perfisComTodasAsHabilitacoes.includes(u.perfil) || u.habilitacoes.includes('LG')),
  );
  const pronto =
    identificacao.trim() &&
    finalidade.trim() &&
    exercicioOk &&
    tipoEscolhido &&
    dinheiroValido(valor);
  const prazo = (rotulo: string, v: string, set: (x: string) => void) => (
    <Campo rotulo={rotulo}>
      {(p) => (
        <input
          {...p}
          type="date"
          {...(novo ? { min: hoje } : {})}
          value={v}
          onChange={(e) => set(e.target.value)}
        />
      )}
    </Campo>
  );

  return (
    <form
      className="formulario-do-modal"
      aria-label={novo ? 'Nova emenda' : 'Dados da emenda'}
      onSubmit={(e) => {
        e.preventDefault();
        aoEnviar({
          identificacao: identificacao.trim(),
          exercicio: Number(exercicio),
          tipoId: Number(tipoEscolhido),
          finalidade: finalidade.trim(),
          valor: normalizarDinheiroDigitado(valor),
          prazoDestinacao,
          prazoEmpenho,
          prazoExecucao,
          responsavelId: responsavelId ? Number(responsavelId) : null,
        });
      }}
    >
      {erro}
      <div className="grade-formulario">
        <Campo rotulo="Identificação" obrigatorio ajuda="Não repete no mesmo exercício.">
          {(p) => (
            <input
              {...p}
              required
              maxLength={100}
              value={identificacao}
              onChange={(e) => setIdentificacao(e.target.value)}
            />
          )}
        </Campo>
        <Campo
          rotulo="Exercício"
          obrigatorio
          erro={exercicio && !exercicioOk ? 'De 2000 a 2100.' : undefined}
        >
          {(p) => (
            <input
              {...p}
              required
              inputMode="numeric"
              maxLength={4}
              value={exercicio}
              onChange={(e) => setExercicio(e.target.value.replace(/\D/g, ''))}
            />
          )}
        </Campo>
        <Campo rotulo="Tipo de emenda" obrigatorio>
          {(p) => (
            <select
              {...p}
              required
              value={tipoEscolhido}
              onChange={(e) => setTipoId(e.target.value)}
            >
              {tiposAtivos.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </select>
          )}
        </Campo>
        <CampoDeDinheiro
          rotulo="Valor disponibilizado"
          valor={valor}
          aoMudar={setValor}
          ajuda={
            novo
              ? 'O único valor que se cadastra: o resto é calculado.'
              : 'Não pode ficar abaixo do que já foi destinado.'
          }
        />
      </div>
      <Campo rotulo="Finalidade" obrigatorio>
        {(p) => (
          <textarea
            {...p}
            required
            rows={3}
            maxLength={2000}
            value={finalidade}
            onChange={(e) => setFinalidade(e.target.value)}
          />
        )}
      </Campo>
      <div className="grade-formulario">
        {prazo('Prazo da destinação (opcional)', prazoDestinacao, setPrazoDestinacao)}
        {prazo('Prazo do empenho (opcional)', prazoEmpenho, setPrazoEmpenho)}
        {prazo('Prazo da execução (opcional)', prazoExecucao, setPrazoExecucao)}
        {novo && podeDesignar ? (
          <Campo rotulo="Responsável" ajuda="Em branco: você.">
            {(p) => (
              <select
                {...p}
                value={responsavelId}
                onChange={(e) => setResponsavelId(e.target.value)}
              >
                <option value="">Eu mesmo</option>
                {responsaveis.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nome}
                  </option>
                ))}
              </select>
            )}
          </Campo>
        ) : null}
      </div>
      <div className="acoes">
        <Botao type="submit" disabled={!pronto} carregando={enviando}>
          {rotuloDeEnviar}
        </Botao>
        <Botao variante="secundario" onClick={aoCancelar}>
          Cancelar
        </Botao>
      </div>
    </form>
  );
}
