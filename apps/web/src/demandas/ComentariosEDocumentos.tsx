import { nivelDoPerfil, pode } from '@gabinete/autorizacao';
import {
  naturezasDeDocumento,
  type ComentarioDto,
  type DocumentoDto,
  type NaturezaDeDocumento,
  type RespostaDaSessao,
} from '@gabinete/compartilhado';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FileArchive, FileImage, FileText, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { chavesDoAtendimento } from '../api/atendimento';
import { chamar } from '../api/cliente';
import { useEquipe } from '../api/consultas';
import { Avatar } from '../componentes/avatar';
import { EditarDocumento } from './EditarDocumento';
import {
  CampoComMencoes,
  TextoComMencoes,
  idsMencionados,
  useColegas,
  useNomesDaEquipe,
} from '../componentes/mencoes';
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
  const colegas = useColegas(sessao, 'AT');
  const nomes = useNomesDaEquipe();
  const [texto, setTexto] = useState('');
  const autoridade = { perfil: sessao.usuario.perfil, habilitacoes: sessao.usuario.habilitacoes };
  const fotoDe = new Map((equipe ?? []).map((u) => [u.id, u.temFoto]));

  const comentar = useMutation({
    mutationFn: () =>
      chamar<ComentarioDto[]>('POST', `/api/demandas/${demandaId}/comentarios`, {
        // O nome citado fica no texto, como @Nome; a API avisa quem foi mencionado.
        corpo: { texto: texto.trim(), mencoes: idsMencionados(texto, colegas) },
      }),
    onSuccess: async () => {
      setTexto('');
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
      <ul className="comentarios">
        {comentarios.map((c) => (
          <li key={c.id} className="comentario">
            <Avatar nome={c.autor.nome} id={c.autor.id} temFoto={fotoDe.get(c.autor.id)} pequeno />
            <div className="comentario__corpo">
              <div className="comentario__cabecalho">
                <strong>{c.autor.nome}</strong>
                <span className="campo__ajuda">{formatarDataHora(c.criadoEm)}</span>
              </div>
              {c.removido ? (
                <p>
                  <em>
                    Comentário removido por {c.removidoPor} em{' '}
                    {c.removidoEm ? formatarDataHora(c.removidoEm) : ''}.
                  </em>
                </p>
              ) : (
                <>
                  <p className="ficha-texto">
                    <TextoComMencoes texto={c.texto ?? ''} nomes={nomes} />
                  </p>
                  {!somenteLeitura &&
                  pode('comentarios.remover', autoridade) &&
                  (c.autor.id === sessao.usuario.id ||
                    nivelDoPerfil[sessao.usuario.perfil] >= 3) ? (
                    <Botao
                      pequeno
                      variante="fantasma"
                      onClick={() => remover.mutate(c.id)}
                      disabled={remover.isPending}
                    >
                      Remover
                    </Botao>
                  ) : null}
                </>
              )}
            </div>
          </li>
        ))}
        {comentarios.length === 0 ? (
          <li className="campo__ajuda">Nenhum comentário ainda.</li>
        ) : null}
      </ul>

      {!somenteLeitura && pode('comentarios.criar', autoridade) ? (
        <>
          <CampoComMencoes
            rotulo="Novo comentário"
            ajuda="Quem for mencionado com @ recebe um aviso."
            valor={texto}
            aoMudar={setTexto}
            colegas={colegas}
            maxLength={5000}
          />
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

/** Um ícone por tipo de arquivo, só para reconhecer de relance. */
function IconeDoArquivo({ nome }: { nome: string }) {
  const extensao = nome.split('.').pop()?.toLowerCase() ?? '';
  const Icone =
    extensao === 'png' || extensao === 'jpg' || extensao === 'jpeg'
      ? FileImage
      : extensao === 'zip'
        ? FileArchive
        : FileText;
  return (
    <span className="documento__icone" aria-hidden="true">
      <Icone size={18} />
    </span>
  );
}

/** Documentos da demanda: enviar no alto, lista simples embaixo (nome, tipo, tamanho, quem e quando). */
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
  const podeRemover = !somenteLeitura && pode('documentos.remover', autoridade);
  const podeEditar = !somenteLeitura && pode('documentos.anexar', autoridade);
  const [editando, setEditando] = useState<DocumentoDto | null>(null);

  return (
    <div className="documentos">
      <h3 className="somente-leitor">Documentos</h3>
      {problema ? <Aviso tipo="erro" titulo={problema} /> : null}
      <AvisoDeErro erro={anexar.error ?? remover.error} />

      {!somenteLeitura && pode('documentos.anexar', autoridade) ? (
        <div className="documentos__novo">
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

      {documentos.length === 0 ? (
        <p className="campo__ajuda">Nenhum documento anexado.</p>
      ) : (
        <ul className="documentos__lista">
          {documentos.map((d) => (
            <li key={d.id} className={`documento${d.removido ? ' documento--removido' : ''}`}>
              <IconeDoArquivo nome={d.nome} />
              {d.removido ? (
                <div className="documento__corpo">
                  <em>
                    {d.nome} (removido
                    {d.removidoEm ? ` em ${formatarDataHora(d.removidoEm)}` : ''})
                  </em>
                </div>
              ) : (
                <>
                  <div className="documento__corpo">
                    <a
                      className="documento__nome"
                      href={`/api/documentos/${d.id}/conteudo`}
                      download
                    >
                      {d.nome}
                    </a>
                    <span className="documento__meta">
                      <Selo>{rotuloDaNatureza[d.natureza]}</Selo>
                      <span>
                        {formatarTamanho(d.tamanho)} · {d.enviadoPor} ·{' '}
                        {formatarDataHora(d.enviadoEm)}
                      </span>
                    </span>
                  </div>
                  {podeEditar ? (
                    <Botao
                      pequeno
                      variante="fantasma"
                      icone={<Pencil size={14} aria-hidden="true" />}
                      aria-label={`Editar ${d.nome}`}
                      onClick={() => setEditando(d)}
                    >
                      Editar
                    </Botao>
                  ) : null}
                  {podeRemover ? (
                    <Botao
                      pequeno
                      variante="fantasma"
                      className="botao--perigo-suave"
                      icone={<Trash2 size={14} aria-hidden="true" />}
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
        </ul>
      )}
      {editando ? (
        <EditarDocumento documento={editando} aoFechar={() => setEditando(null)} />
      ) : null}
    </div>
  );
}
