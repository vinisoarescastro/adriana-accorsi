import {
  perfisComTodasAsHabilitacoes,
  type ProjetoFicha,
  type RespostaDaSessao,
} from '@gabinete/compartilhado';
import { nivelDoPerfil } from '@gabinete/autorizacao';
import { useState, type ReactNode } from 'react';
import { useEquipe } from '../api/consultas';
import { useCategoriasDoLegislativo } from '../api/legislativo';
import { Botao, Campo } from '../componentes/ui';
import { hojeNoGabinete } from '../formatos';

export interface DadosDoFormularioDoProjeto {
  readonly titulo: string;
  readonly ementa: string;
  readonly autoria: string;
  readonly numero: string;
  readonly tipoProposicaoId: number;
  readonly prazo: string;
  readonly assuntos: number[];
  readonly coautores: string[];
  /** Só no cadastro: vazio é quem cadastra. */
  readonly responsavelId: number | null;
}

/**
 * Campos de um projeto de lei, para cadastrar e para editar. Título, ementa e autoria são
 * obrigatórios; o número só existe depois do protocolo e pode ficar em branco. No cadastro o prazo
 * não pode ser anterior a hoje (alterar depois pode). Os coautores são um nome por linha.
 */
export function FormularioDoProjeto({
  sessao,
  projeto,
  rotuloDeEnviar,
  enviando,
  aoEnviar,
  aoCancelar,
  erro,
}: {
  sessao: RespostaDaSessao;
  /** Sem ele, é um cadastro novo. */
  projeto?: ProjetoFicha | undefined;
  rotuloDeEnviar: string;
  enviando: boolean;
  aoEnviar: (dados: DadosDoFormularioDoProjeto) => void;
  aoCancelar: () => void;
  erro?: ReactNode;
}) {
  const novo = projeto === undefined;
  const { data: categorias } = useCategoriasDoLegislativo();
  const { data: equipe } = useEquipe();

  const tipos = (categorias ?? []).filter(
    (c) =>
      c.natureza === 'tipo_proposicao' &&
      (c.situacao === 'ativa' || c.id === projeto?.tipoProposicao.id),
  );
  const assuntosPossiveis = (categorias ?? []).filter(
    (c) =>
      c.natureza === 'assunto_projeto' &&
      (c.situacao === 'ativa' || projeto?.assuntos.some((a) => a.id === c.id)),
  );

  const [titulo, setTitulo] = useState(projeto?.titulo ?? '');
  const [ementa, setEmenta] = useState(projeto?.ementa ?? '');
  const [autoria, setAutoria] = useState(projeto?.autoria ?? '');
  const [numero, setNumero] = useState(projeto?.numero ?? '');
  const [tipoId, setTipoId] = useState(projeto ? String(projeto.tipoProposicao.id) : '');
  const [prazo, setPrazo] = useState(projeto?.prazo ?? '');
  const [assuntos, setAssuntos] = useState<number[]>(projeto?.assuntos.map((a) => a.id) ?? []);
  const [coautores, setCoautores] = useState(
    (projeto?.coautores ?? []).map((c) => c.nome).join('\n'),
  );
  const [responsavelId, setResponsavelId] = useState('');

  // O tipo padrão é o primeiro da lista, assim que ela chega.
  const tipoEscolhido = tipoId || (tipos[0] ? String(tipos[0].id) : '');
  const podeDesignar = nivelDoPerfil[sessao.usuario.perfil] >= 2;
  const responsaveis = (equipe ?? []).filter(
    (u) =>
      u.situacao === 'ativo' &&
      u.id !== sessao.usuario.id &&
      nivelDoPerfil[u.perfil] >= 2 &&
      (perfisComTodasAsHabilitacoes.includes(u.perfil) || u.habilitacoes.includes('LG')),
  );

  const alternar = (id: number) =>
    setAssuntos((atual) => (atual.includes(id) ? atual.filter((a) => a !== id) : [...atual, id]));

  return (
    <form
      className="formulario-do-modal"
      aria-label={novo ? 'Novo projeto de lei' : 'Dados do projeto de lei'}
      onSubmit={(e) => {
        e.preventDefault();
        aoEnviar({
          titulo: titulo.trim(),
          ementa: ementa.trim(),
          autoria: autoria.trim(),
          numero: numero.trim(),
          tipoProposicaoId: Number(tipoEscolhido),
          prazo,
          assuntos,
          coautores: coautores
            .split('\n')
            .map((c) => c.trim())
            .filter(Boolean),
          responsavelId: responsavelId ? Number(responsavelId) : null,
        });
      }}
    >
      {erro}
      <Campo rotulo="Título" obrigatorio>
        {(p) => (
          <input
            {...p}
            required
            maxLength={250}
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
          />
        )}
      </Campo>
      <Campo rotulo="Ementa" obrigatorio ajuda="O resumo oficial do que o projeto institui.">
        {(p) => (
          <textarea
            {...p}
            required
            rows={4}
            maxLength={5000}
            value={ementa}
            onChange={(e) => setEmenta(e.target.value)}
          />
        )}
      </Campo>
      <div className="grade-formulario">
        <Campo rotulo="Autoria" obrigatorio>
          {(p) => (
            <input
              {...p}
              required
              maxLength={250}
              value={autoria}
              onChange={(e) => setAutoria(e.target.value)}
            />
          )}
        </Campo>
        <Campo rotulo="Tipo de proposição" obrigatorio>
          {(p) => (
            <select
              {...p}
              required
              value={tipoEscolhido}
              onChange={(e) => setTipoId(e.target.value)}
            >
              {tipos.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </select>
          )}
        </Campo>
        <Campo
          rotulo="Número (opcional)"
          ajuda="Depois do protocolo. Não repete entre projetos ativos."
        >
          {(p) => (
            <input
              {...p}
              maxLength={40}
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
            />
          )}
        </Campo>
        <Campo rotulo="Prazo (opcional)">
          {(p) => (
            <input
              {...p}
              type="date"
              {...(novo ? { min: hojeNoGabinete() } : {})}
              value={prazo}
              onChange={(e) => setPrazo(e.target.value)}
            />
          )}
        </Campo>
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

      {assuntosPossiveis.length > 0 ? (
        <fieldset className="grupo-de-opcoes">
          <legend>Assuntos</legend>
          {assuntosPossiveis.map((a) => (
            <label key={a.id} className="opcao">
              <input
                type="checkbox"
                checked={assuntos.includes(a.id)}
                onChange={() => alternar(a.id)}
              />
              {a.nome}
            </label>
          ))}
        </fieldset>
      ) : null}

      <Campo rotulo="Coautores (opcional)" ajuda="Um nome por linha.">
        {(p) => (
          <textarea
            {...p}
            rows={3}
            value={coautores}
            onChange={(e) => setCoautores(e.target.value)}
          />
        )}
      </Campo>

      <div className="acoes">
        <Botao
          type="submit"
          disabled={!titulo.trim() || !ementa.trim() || !autoria.trim() || !tipoEscolhido}
          carregando={enviando}
        >
          {rotuloDeEnviar}
        </Botao>
        <Botao variante="secundario" onClick={aoCancelar}>
          Cancelar
        </Botao>
      </div>
    </form>
  );
}
