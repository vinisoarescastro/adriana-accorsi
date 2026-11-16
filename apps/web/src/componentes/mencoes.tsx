import type { Area, RespostaDaSessao } from '@gabinete/compartilhado';
import { perfisComTodasAsHabilitacoes } from '@gabinete/compartilhado';
import {
  Fragment,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { useEquipe } from '../api/consultas';
import { Avatar } from './avatar';
import { Campo } from './ui';
import { rotuloDoPerfil } from '../rotulos';

/** Um colega que pode ser mencionado com @. */
export interface Colega {
  readonly id: number;
  readonly nome: string;
  readonly apoio: string;
  readonly temFoto: boolean;
}

/**
 * Os colegas que o usuário pode mencionar: ativos, menos ele mesmo e, se houver `area`, só quem tem
 * essa habilitação (a API confere de novo e só avisa quem pode).
 */
export function useColegas(sessao: RespostaDaSessao, area?: Area): readonly Colega[] {
  const { data } = useEquipe();
  return useMemo(
    () =>
      (data ?? [])
        .filter(
          (u) =>
            u.situacao === 'ativo' &&
            u.id !== sessao.usuario.id &&
            (!area ||
              u.habilitacoes.includes(area) ||
              perfisComTodasAsHabilitacoes.includes(u.perfil)),
        )
        .map((u) => ({
          id: u.id,
          nome: u.nome,
          apoio: rotuloDoPerfil[u.perfil],
          temFoto: u.temFoto,
        })),
    [data, sessao.usuario.id, area],
  );
}

const normalizar = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

/** Os ids dos colegas citados no texto como `@Nome`. É o que a API recebe em `mencoes`. */
export function idsMencionados(texto: string, colegas: readonly Colega[]): number[] {
  return colegas.filter((c) => texto.includes(`@${c.nome}`)).map((c) => c.id);
}

/** O que vem depois do último `@` antes do cursor, se o cursor está digitando uma menção. */
function consultaDaMencao(texto: string, cursor: number): { inicio: number; busca: string } | null {
  const antes = texto.slice(0, cursor);
  const m = /(^|[\s(])@([^@\n]{0,30})$/.exec(antes);
  if (!m) return null;
  return { inicio: antes.length - (m[2]?.length ?? 0) - 1, busca: m[2] ?? '' };
}

const maximoDeSugestoes = 6;

/**
 * Campo de texto com menções: digite `@` e o nome; aparecem sugestões de colegas (avatar à esquerda do
 * nome), e Enter ou clique insere `@Nome` no texto. Quem for citado recebe um aviso ao salvar. Setas
 * navegam, Esc fecha só as sugestões.
 */
export function CampoComMencoes({
  rotulo,
  ajuda,
  valor,
  aoMudar,
  colegas,
  linhas = 3,
  maxLength,
  obrigatorio,
  placeholder,
}: {
  rotulo: string;
  ajuda?: string | undefined;
  valor: string;
  aoMudar: (texto: string) => void;
  colegas: readonly Colega[];
  linhas?: number;
  maxLength?: number;
  obrigatorio?: boolean;
  placeholder?: string;
}) {
  const area = useRef<HTMLTextAreaElement>(null);
  const lista = useRef<HTMLDivElement>(null);
  const idDaLista = useId();
  const [consulta, setConsulta] = useState<{ inicio: number; busca: string } | null>(null);
  const [posicao, setPosicao] = useState<CSSProperties>({});
  const [ativa, setAtiva] = useState(0);

  const sugestoes = useMemo(() => {
    if (!consulta) return [];
    const termo = normalizar(consulta.busca.trim());
    const todas = colegas.filter((c) => normalizar(c.nome).includes(termo));
    // Quem começa com o que foi digitado vem primeiro.
    return todas
      .sort(
        (x, y) =>
          Number(!normalizar(x.nome).startsWith(termo)) -
          Number(!normalizar(y.nome).startsWith(termo)),
      )
      .slice(0, maximoDeSugestoes);
  }, [consulta, colegas]);
  const aberta = consulta !== null && sugestoes.length > 0;

  useEffect(() => setAtiva(0), [consulta?.busca]);

  // Fecha ao clicar fora.
  useEffect(() => {
    if (!consulta) return;
    const fora = (e: MouseEvent) => {
      const alvo = e.target as Node;
      if (!lista.current?.contains(alvo) && !area.current?.contains(alvo)) setConsulta(null);
    };
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, [consulta]);

  const atualizarConsulta = (texto: string, cursor: number) => {
    const c = consultaDaMencao(texto, cursor);
    setConsulta(c);
    if (c && area.current) {
      const caixa = area.current.getBoundingClientRect();
      const cabeEmBaixo = caixa.bottom + 4 + 260 <= window.innerHeight;
      setPosicao({
        position: 'fixed',
        left: caixa.left,
        width: Math.min(caixa.width, 22 * 16),
        ...(cabeEmBaixo
          ? { top: caixa.bottom + 4 }
          : { bottom: window.innerHeight - caixa.top + 4 }),
      });
    }
  };

  const inserir = (colega: Colega) => {
    if (!consulta || !area.current) return;
    const cursor = area.current.selectionStart;
    const antes = valor.slice(0, consulta.inicio);
    const depois = valor.slice(cursor);
    const novo = `${antes}@${colega.nome} ${depois.replace(/^ /, '')}`;
    aoMudar(novo);
    setConsulta(null);
    const posicaoDoCursor = antes.length + colega.nome.length + 2;
    requestAnimationFrame(() => {
      area.current?.focus();
      area.current?.setSelectionRange(posicaoDoCursor, posicaoDoCursor);
    });
  };

  const aoTeclar = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!aberta) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setAtiva((i) => (i + (e.key === 'ArrowDown' ? 1 : sugestoes.length - 1)) % sugestoes.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      const escolhida = sugestoes[ativa];
      if (escolhida) inserir(escolhida);
    } else if (e.key === 'Escape') {
      // Só fecha as sugestões: o Esc não deve fechar o modal que contém o campo.
      e.preventDefault();
      e.stopPropagation();
      setConsulta(null);
    }
  };

  return (
    <>
      <Campo
        rotulo={rotulo}
        {...(ajuda ? { ajuda } : {})}
        {...(obrigatorio ? { obrigatorio } : {})}
      >
        {(p) => (
          <textarea
            {...p}
            ref={area}
            rows={linhas}
            value={valor}
            placeholder={placeholder ?? 'Digite @ para mencionar alguém'}
            {...(maxLength ? { maxLength } : {})}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={aberta}
            aria-controls={idDaLista}
            aria-activedescendant={aberta ? `${idDaLista}-${ativa}` : undefined}
            onChange={(e) => {
              aoMudar(e.target.value);
              atualizarConsulta(e.target.value, e.target.selectionStart);
            }}
            onClick={(e) => atualizarConsulta(valor, e.currentTarget.selectionStart)}
            onKeyUp={(e) => {
              if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key))
                atualizarConsulta(valor, e.currentTarget.selectionStart);
            }}
            onKeyDown={aoTeclar}
          />
        )}
      </Campo>
      {aberta
        ? createPortal(
            <div
              ref={lista}
              id={idDaLista}
              role="listbox"
              aria-label="Colegas para mencionar"
              className="mencoes__lista"
              style={posicao}
            >
              {sugestoes.map((c, i) => (
                <div
                  key={c.id}
                  id={`${idDaLista}-${i}`}
                  role="option"
                  aria-selected={i === ativa}
                  className={`mencoes__opcao${i === ativa ? ' mencoes__opcao--ativa' : ''}`}
                  // mouseDown (e não click) para o campo não perder o foco antes de inserir.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    inserir(c);
                  }}
                  onMouseEnter={() => setAtiva(i)}
                >
                  <Avatar nome={c.nome} id={c.id} temFoto={c.temFoto} pequeno />
                  <span className="mencoes__nome">{c.nome}</span>
                  <span className="mencoes__apoio">{c.apoio}</span>
                </div>
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

/** O texto com as menções (`@Nome`) em destaque. As quebras de linha continuam. */
export function TextoComMencoes({
  texto,
  nomes,
}: {
  texto: string;
  /** Nomes que podem ter sido citados; o resto do `@` fica como texto comum. */
  nomes: readonly string[];
}) {
  const partes = useMemo(() => {
    const ordenados = [...nomes].sort((a, b) => b.length - a.length);
    if (ordenados.length === 0) return [texto];
    const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const padrao = new RegExp(`(@(?:${ordenados.map(escapar).join('|')}))`, 'g');
    return texto.split(padrao);
  }, [texto, nomes]);
  return (
    <>
      {partes.map((parte, i) =>
        i % 2 === 1 ? (
          <span key={i} className="mencao">
            {parte}
          </span>
        ) : (
          <Fragment key={i}>{parte}</Fragment>
        ),
      )}
    </>
  );
}

/** Os nomes de toda a equipe, para destacar menções ao exibir um texto (inclusive de quem saiu). */
export function useNomesDaEquipe(): readonly string[] {
  const { data } = useEquipe();
  return useMemo(() => (data ?? []).map((u) => u.nome), [data]);
}
