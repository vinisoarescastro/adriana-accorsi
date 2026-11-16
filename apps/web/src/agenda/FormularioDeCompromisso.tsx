import { pode } from '@gabinete/autorizacao';
import {
  visibilidadesDeCompromisso,
  type CompromissoDto,
  type CompromissoSalvo,
  type RespostaDaSessao,
  type VisibilidadeDeCompromissoDto,
} from '@gabinete/compartilhado';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { chamar } from '../api/cliente';
import { useEquipe } from '../api/consultas';
import { chavesDoTrabalho } from '../api/trabalho';
import { AvisoDeErro, Botao, Campo } from '../componentes/ui';
import { deCampoDeDataHora, hojeNoGabinete, paraCampoDeDataHora } from '../formatos';
import { rotuloDaVisibilidade } from '../rotulos';

/**
 * Marcar ou remarcar um compromisso. A marca "envolve a Parlamentar" vem ligada (a agenda do gabinete
 * é a dela). Só o Supervisor em diante vê a opção Restrito. Os novos indicados recebem aviso.
 */
export function FormularioDeCompromisso({
  sessao,
  compromisso,
  diaInicial,
  aoSalvar,
  aoFechar,
}: {
  sessao: RespostaDaSessao;
  compromisso?: CompromissoDto;
  diaInicial?: string;
  aoSalvar: (salvo: CompromissoSalvo) => void;
  aoFechar: () => void;
}) {
  const cliente = useQueryClient();
  const { data: equipe } = useEquipe();
  const autoridade = { perfil: sessao.usuario.perfil, habilitacoes: sessao.usuario.habilitacoes };
  const podeRestrito = pode('agenda.criar_restrito', autoridade);
  const dia = diaInicial ?? hojeNoGabinete();

  const [titulo, setTitulo] = useState(compromisso?.titulo ?? '');
  const [local, setLocal] = useState(compromisso?.local ?? '');
  const [inicio, setInicio] = useState(
    compromisso ? paraCampoDeDataHora(compromisso.inicio) : `${dia}T09:00`,
  );
  const [fim, setFim] = useState(
    compromisso ? paraCampoDeDataHora(compromisso.fim) : `${dia}T10:00`,
  );
  const [diaInteiro, setDiaInteiro] = useState(compromisso?.diaInteiro ?? false);
  const [visibilidade, setVisibilidade] = useState<VisibilidadeDeCompromissoDto>(
    compromisso?.visibilidade ?? 'participantes',
  );
  const [envolve, setEnvolve] = useState(compromisso?.envolveParlamentar ?? true);
  const [indicados, setIndicados] = useState<number[]>(
    compromisso?.participantesInternos.map((p) => p.id) ?? [],
  );

  const candidatos = (equipe ?? []).filter(
    (u) =>
      u.situacao === 'ativo' &&
      (u.habilitacoes.includes('AG') || ['administrador', 'parlamentar'].includes(u.perfil)),
  );

  const salvar = useMutation({
    mutationFn: () => {
      const corpo = {
        titulo: titulo.trim(),
        local: local.trim() || (compromisso ? null : undefined),
        inicio: deCampoDeDataHora(inicio),
        fim: deCampoDeDataHora(fim),
        diaInteiro,
        visibilidade,
        envolveParlamentar: envolve,
        participantesInternos: indicados,
      };
      return compromisso
        ? chamar<CompromissoSalvo>('PATCH', `/api/agenda/compromissos/${compromisso.id}`, { corpo })
        : chamar<CompromissoSalvo>('POST', '/api/agenda/compromissos', { corpo });
    },
    onSuccess: async (salvo) => {
      await cliente.invalidateQueries({ queryKey: chavesDoTrabalho.tudo });
      aoSalvar(salvo);
    },
  });

  return (
    <form
      className="cartao"
      aria-label={compromisso ? 'Remarcar compromisso' : 'Novo compromisso'}
      onSubmit={(e) => {
        e.preventDefault();
        salvar.mutate();
      }}
    >
      <h2>{compromisso ? 'Alterar compromisso' : 'Novo compromisso'}</h2>
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
      <div className="grade-formulario">
        <Campo rotulo="Início">
          {(p) => (
            <input
              {...p}
              type="datetime-local"
              required
              value={inicio}
              onChange={(e) => setInicio(e.target.value)}
            />
          )}
        </Campo>
        <Campo rotulo="Fim">
          {(p) => (
            <input
              {...p}
              type="datetime-local"
              required
              value={fim}
              onChange={(e) => setFim(e.target.value)}
            />
          )}
        </Campo>
        <Campo rotulo="Local (opcional)">
          {(p) => (
            <input
              {...p}
              maxLength={300}
              value={local}
              onChange={(e) => setLocal(e.target.value)}
            />
          )}
        </Campo>
        <Campo rotulo="Quem vê o compromisso">
          {(p) => (
            <select
              {...p}
              value={visibilidade}
              onChange={(e) => setVisibilidade(e.target.value as VisibilidadeDeCompromissoDto)}
            >
              {visibilidadesDeCompromisso
                .filter((v) => v !== 'restrito' || podeRestrito || visibilidade === 'restrito')
                .map((v) => (
                  <option key={v} value={v} disabled={v === 'restrito' && !podeRestrito}>
                    {rotuloDaVisibilidade[v]}
                  </option>
                ))}
            </select>
          )}
        </Campo>
      </div>
      <label className="opcao">
        <input
          type="checkbox"
          checked={diaInteiro}
          onChange={(e) => setDiaInteiro(e.target.checked)}
        />
        Dia inteiro
      </label>
      <label className="opcao">
        <input type="checkbox" checked={envolve} onChange={(e) => setEnvolve(e.target.checked)} />
        Envolve a Parlamentar (aparece na agenda dela, sem gerar aviso)
      </label>

      <fieldset>
        <legend>Participantes da equipe (cada indicado é avisado)</legend>
        {candidatos.map((u) => (
          <label key={u.id} className="opcao">
            <input
              type="checkbox"
              checked={indicados.includes(u.id)}
              onChange={(e) =>
                setIndicados((atuais) =>
                  e.target.checked ? [...atuais, u.id] : atuais.filter((id) => id !== u.id),
                )
              }
            />
            {u.nome}
          </label>
        ))}
      </fieldset>

      <div className="acoes">
        <Botao type="submit" disabled={!titulo.trim() || salvar.isPending}>
          {compromisso ? 'Salvar' : 'Marcar compromisso'}
        </Botao>
        <Botao variante="secundario" onClick={aoFechar}>
          Cancelar
        </Botao>
      </div>
    </form>
  );
}
