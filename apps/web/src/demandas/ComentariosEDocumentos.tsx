import { nivelDoPerfil, pode } from '@gabinete/autorizacao';
import {
  naturezasDeDocumento,
  type ComentarioDto,
  type DocumentoDto,
  type NaturezaDeDocumento,
  type RespostaDaSessao,
} from '@gabinete/compartilhado';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { chavesDoAtendimento } from '../api/atendimento';
import { chamar } from '../api/cliente';
import { useEquipe } from '../api/consultas';
import { Aviso, AvisoDeErro, Botao, Campo, Selo } from '../componentes/ui';
import { formatarDataHora } from '../formatos';
import { rotuloDaNatureza } from '../rotulos';

function useAtualizarFicha() {
  const cliente = useQueryClient();
  return () => cliente.invalidateQueries({ queryKey: chavesDoAtendimento.tudo });
}

/** Comentários internos: texto da equipe, nunca público. Remover deixa a marca; o texto some da tela. */
export function ComentariosDaDemanda({
  demandaId,
  comentarios,
  sessao,
  somenteLeitura = false,
}: {
  demandaId: number;
  comentarios: readonly ComentarioDto[];
  sessao: RespostaDaSessao;
  /** Demanda cancelada: nada se acrescenta nem se remove. */
  somenteLeitura?: boolean;
}) {
  const atualizar = useAtualizarFicha();
  const { data: equipe } = useEquipe();
  const [texto, setTexto] = useState('');
  const [mencoes, setMencoes] = useState<number[]>([]);
  const autoridade = { perfil: sessao.usuario.perfil, habilitacoes: sessao.usuario.habilitacoes };
  const colegas = (equipe ?? []).filter(
    (u) => u.situacao === 'ativo' && u.id !== sessao.usuario.id,
  );

  const comentar = useMutation({
    mutationFn: () => {
      // O nome mencionado fica no texto, como @Nome.
      const nomes = colegas
        .filter((c) => mencoes.includes(c.id) && !texto.includes(`@${c.nome}`))
        .map((c) => `@${c.nome}`);
      return chamar<ComentarioDto[]>('POST', `/api/demandas/${demandaId}/comentarios`, {
        corpo: { texto: [texto.trim(), ...nomes].join(' '), mencoes },
      });
    },
    onSuccess: async () => {
      setTexto('');
      setMencoes([]);
      await atualizar();
    },
  });
  const remover = useMutation({
    mutationFn: (id: number) => chamar<ComentarioDto[]>('DELETE', `/api/comentarios/${id}`),
    onSuccess: atualizar,
  });

  return (
    <div className="painel-do-usuario">
      <h3>Comentários internos</h3>
      <p className="campo__ajuda">Só a equipe vê. Nada aqui chega ao cidadão.</p>
      <AvisoDeErro erro={comentar.error ?? remover.error} />
      <ul className="lista-simples">
        {comentarios.map((c) => (
          <li key={c.id}>
            <strong>{c.autor.nome}</strong>{' '}
            <span className="campo__ajuda">{formatarDataHora(c.criadoEm)}</span>
            {c.removido ? (
              <p>
                <em>
                  Comentário removido por {c.removidoPor} em{' '}
                  {c.removidoEm ? formatarDataHora(c.removidoEm) : ''}.
                </em>
              </p>
            ) : (
              <>
                <p>{c.texto}</p>
                {!somenteLeitura &&
                pode('comentarios.remover', autoridade) &&
                (c.autor.id === sessao.usuario.id || nivelDoPerfil[sessao.usuario.perfil] >= 3) ? (
                  <Botao
                    pequeno
                    variante="secundario"
                    onClick={() => remover.mutate(c.id)}
                    disabled={remover.isPending}
                  >
                    Remover
                  </Botao>
                ) : null}
              </>
            )}
          </li>
        ))}
        {comentarios.length === 0 ? <li>Nenhum comentário ainda.</li> : null}
      </ul>

      {!somenteLeitura && pode('comentarios.criar', autoridade) ? (
        <>
          <Campo rotulo="Novo comentário">
            {(p) => (
              <textarea
                {...p}
                rows={3}
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                maxLength={5000}
              />
            )}
          </Campo>
          <fieldset className="grupo-de-opcoes">
            <legend>
              Mencionar colegas (eles serão avisados quando a caixa de avisos existir)
            </legend>
            {colegas.map((c) => (
              <label key={c.id} className="opcao">
                <input
                  type="checkbox"
                  checked={mencoes.includes(c.id)}
                  onChange={() =>
                    setMencoes((m) =>
                      m.includes(c.id) ? m.filter((x) => x !== c.id) : [...m, c.id],
                    )
                  }
                />
                {c.nome}
              </label>
            ))}
          </fieldset>
          <Botao
            pequeno
            disabled={!texto.trim() || comentar.isPending}
            onClick={() => comentar.mutate()}
          >
            Comentar
          </Botao>
        </>
      ) : null}
    </div>
  );
}

const tiposPorExtensao: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  zip: 'application/zip',
};

const formatarTamanho = (bytes: number) =>
  bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

/** Documentos: PDF, PNG, JPEG e ZIP até 25 MB. Baixa sempre como anexo; remover só marca. */
export function DocumentosDaDemanda({
  demandaId,
  documentos,
  sessao,
  somenteLeitura = false,
}: {
  demandaId: number;
  documentos: readonly DocumentoDto[];
  sessao: RespostaDaSessao;
  /** Demanda cancelada: nada se acrescenta nem se remove. */
  somenteLeitura?: boolean;
}) {
  const atualizar = useAtualizarFicha();
  const autoridade = { perfil: sessao.usuario.perfil, habilitacoes: sessao.usuario.habilitacoes };
  const [natureza, setNatureza] = useState<NaturezaDeDocumento>('outro');
  const [problema, setProblema] = useState<string | null>(null);

  const anexar = useMutation({
    mutationFn: (arquivo: File) => {
      const extensao = arquivo.name.split('.').pop()?.toLowerCase() ?? '';
      const tipo = tiposPorExtensao[extensao] ?? 'application/octet-stream';
      return chamar<DocumentoDto[]>(
        'POST',
        `/api/demandas/${demandaId}/documentos?nome=${encodeURIComponent(arquivo.name)}&natureza=${natureza}`,
        { bytes: new Blob([arquivo], { type: tipo }) },
      );
    },
    onSuccess: atualizar,
  });
  const remover = useMutation({
    mutationFn: (id: number) => chamar<DocumentoDto[]>('DELETE', `/api/documentos/${id}`),
    onSuccess: atualizar,
  });

  return (
    <div className="painel-do-usuario">
      <h3>Documentos</h3>
      {problema ? <Aviso tipo="erro" titulo={problema} /> : null}
      <AvisoDeErro erro={anexar.error ?? remover.error} />
      <ul className="lista-simples">
        {documentos.map((d) => (
          <li key={d.id}>
            {d.removido ? (
              <em>
                {d.nome} (removido
                {d.removidoEm ? ` em ${formatarDataHora(d.removidoEm)}` : ''})
              </em>
            ) : (
              <>
                <a href={`/api/documentos/${d.id}/conteudo`} download>
                  {d.nome}
                </a>{' '}
                <Selo>{rotuloDaNatureza[d.natureza]}</Selo>{' '}
                <span className="campo__ajuda">
                  {formatarTamanho(d.tamanho)} · {d.enviadoPor} · {formatarDataHora(d.enviadoEm)}
                </span>{' '}
                {!somenteLeitura && pode('documentos.remover', autoridade) ? (
                  <Botao
                    pequeno
                    variante="secundario"
                    onClick={() => remover.mutate(d.id)}
                    disabled={remover.isPending}
                  >
                    Remover
                  </Botao>
                ) : null}
              </>
            )}
          </li>
        ))}
        {documentos.length === 0 ? <li>Nenhum documento anexado.</li> : null}
      </ul>

      {!somenteLeitura && pode('documentos.anexar', autoridade) ? (
        <div className="grade-formulario">
          <Campo rotulo="Natureza">
            {(p) => (
              <select
                {...p}
                value={natureza}
                onChange={(e) => setNatureza(e.target.value as NaturezaDeDocumento)}
              >
                {naturezasDeDocumento.map((n) => (
                  <option key={n} value={n}>
                    {rotuloDaNatureza[n]}
                  </option>
                ))}
              </select>
            )}
          </Campo>
          <Campo
            rotulo="Anexar documento"
            ajuda="PDF, PNG, JPEG ou ZIP, até 25 MB. Passa por verificação de vírus."
          >
            {(p) => (
              <input
                {...p}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.zip,application/pdf,image/png,image/jpeg,application/zip"
                disabled={anexar.isPending}
                onChange={(e) => {
                  const arquivo = e.target.files?.[0];
                  e.target.value = '';
                  if (!arquivo) return;
                  if (arquivo.size > 25 * 1024 * 1024)
                    return setProblema('O arquivo deve ter no máximo 25 MB.');
                  setProblema(null);
                  anexar.mutate(arquivo);
                }}
              />
            )}
          </Campo>
        </div>
      ) : null}
    </div>
  );
}
