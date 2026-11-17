import type { EntradaDaTrilhaVisivel } from '@gabinete/compartilhado';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Botao, Selo } from '../componentes/ui';
import { formatarDataHora, iniciais } from '../formatos';
import { descricaoDaOperacao, humanizar, nomeDaEntidade, tomDaOperacao } from './rotulos-da-trilha';

type Objeto = Record<string, unknown>;
const ehObjeto = (v: unknown): v is Objeto =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const texto = (v: unknown): string =>
  v === undefined ? '—' : typeof v === 'string' ? v : JSON.stringify(v);

/** Antes e depois, campo a campo: o que mudou fica em destaque. Valor que não é objeto aparece inteiro. */
function Diferenca({ antes, depois }: { antes: unknown; depois: unknown }) {
  if (!ehObjeto(antes) && !ehObjeto(depois)) {
    return <pre className="trilha-detalhes__bruto">{texto(depois ?? antes)}</pre>;
  }
  const a = ehObjeto(antes) ? antes : {};
  const d = ehObjeto(depois) ? depois : {};
  const campos = [...new Set([...Object.keys(a), ...Object.keys(d)])];
  const mostraAntes = ehObjeto(antes);
  return (
    <table className="trilha-detalhes__tabela">
      <thead>
        <tr>
          <th scope="col">Campo</th>
          {mostraAntes ? <th scope="col">Antes</th> : null}
          <th scope="col">Depois</th>
        </tr>
      </thead>
      <tbody>
        {campos.map((c) => {
          const mudou = mostraAntes && texto(a[c]) !== texto(d[c]);
          return (
            <tr key={c} className={mudou ? 'trilha-detalhes__mudou' : undefined}>
              <th scope="row">{humanizar(c)}</th>
              {mostraAntes ? <td>{texto(a[c])}</td> : null}
              <td>{texto(d[c])}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** Uma linha da trilha; o botão abre, logo abaixo, a justificativa e o antes e depois. */
export function LinhaDaTrilha({ item }: { item: EntradaDaTrilhaVisivel }) {
  const [aberta, setAberta] = useState(false);
  const temDetalhes = Boolean(item.valorNovo || item.valorAnterior || item.justificativa);
  const [dia, hora] = formatarDataHora(item.ocorridaEm).split(/,?\s+/);
  const quem = item.autorNome ?? (item.origem === 'comando' ? 'Comando de linha' : 'Sistema');

  return (
    <>
      <tr>
        <td>
          <span className="trilha-quando">
            <strong>{dia}</strong>
            <span className="tabela__discreto">{hora}</span>
          </span>
        </td>
        <td>
          <span className="trilha-quem">
            <span className="trilha-quem__avatar" aria-hidden="true">
              {item.autorNome ? iniciais(item.autorNome) : '·'}
            </span>
            {quem}
          </span>
        </td>
        <td>
          <span className="trilha-operacao">
            <Selo tom={tomDaOperacao(item.operacao)}>{descricaoDaOperacao(item.operacao)}</Selo>
            <code className="tabela__discreto">{item.operacao}</code>
          </span>
        </td>
        <td>
          {nomeDaEntidade(item.entidade)}
          {item.registroId ? <span className="tabela__discreto"> #{item.registroId}</span> : null}
        </td>
        <td className="e-acoes">
          {temDetalhes ? (
            <Botao
              pequeno
              variante="fantasma"
              aria-expanded={aberta}
              icone={
                aberta ? (
                  <ChevronDown size={14} aria-hidden="true" />
                ) : (
                  <ChevronRight size={14} aria-hidden="true" />
                )
              }
              onClick={() => setAberta((v) => !v)}
            >
              {aberta ? 'Ocultar' : 'Detalhes'}
            </Botao>
          ) : (
            <span className="tabela__discreto">—</span>
          )}
        </td>
      </tr>
      {aberta ? (
        <tr className="trilha-detalhes">
          <td colSpan={5}>
            {item.justificativa ? (
              <p className="trilha-detalhes__justificativa">
                <strong>Justificativa:</strong> {item.justificativa}
              </p>
            ) : null}
            {item.valorNovo || item.valorAnterior ? (
              <Diferenca antes={item.valorAnterior} depois={item.valorNovo} />
            ) : null}
          </td>
        </tr>
      ) : null}
    </>
  );
}
