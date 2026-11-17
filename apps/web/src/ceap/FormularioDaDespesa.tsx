import type { DespesaFicha, RespostaDaSessao } from '@gabinete/compartilhado';
import {
  documentoDoFornecedor,
  formatarDocumentoDoFornecedor,
  perfisComTodasAsHabilitacoes,
} from '@gabinete/compartilhado';
import { nivelDoPerfil } from '@gabinete/autorizacao';
import { useState, type ReactNode } from 'react';
import { useEquipe } from '../api/consultas';
import { useCategoriasDaCeap } from '../api/financeiro';
import {
  CampoDeDinheiro,
  dinheiroValido,
  normalizarDinheiroDigitado,
} from '../componentes/campo-de-dinheiro';
import { Botao, Campo } from '../componentes/ui';
import { hojeNoGabinete } from '../formatos';

export interface DadosDoFormularioDaDespesa {
  readonly categoriaId: number;
  readonly descricao: string;
  readonly valor: string;
  readonly dataDocumento: string;
  readonly fornecedorNome: string;
  readonly fornecedorDocumento: string;
  readonly numeroDocumento: string;
  readonly responsavelId: number | null;
}

/** Campos da despesa. A data do documento não é futura; o CPF ou CNPJ do fornecedor é conferido pelos dígitos. */
export function FormularioDaDespesa({
  sessao,
  despesa,
  rotuloDeEnviar,
  enviando,
  aoEnviar,
  aoCancelar,
  erro,
}: {
  sessao: RespostaDaSessao;
  despesa?: DespesaFicha | undefined;
  rotuloDeEnviar: string;
  enviando: boolean;
  aoEnviar: (d: DadosDoFormularioDaDespesa) => void;
  aoCancelar: () => void;
  erro?: ReactNode;
}) {
  const novo = despesa === undefined;
  const { data: categorias } = useCategoriasDaCeap();
  const { data: equipe } = useEquipe();
  const hoje = hojeNoGabinete();
  const [categoriaId, setCategoriaId] = useState(despesa ? String(despesa.categoria.id) : '');
  const [descricao, setDescricao] = useState(despesa?.descricao ?? '');
  const [valor, setValor] = useState(despesa ? despesa.valor.replace('.', ',') : '');
  const [dataDocumento, setDataDocumento] = useState(despesa?.dataDocumento ?? hoje);
  const [fornecedorNome, setFornecedorNome] = useState(despesa?.fornecedor.nome ?? '');
  const [fornecedorDocumento, setFornecedorDocumento] = useState(
    despesa?.fornecedor.documento ?? '',
  );
  const [numeroDocumento, setNumeroDocumento] = useState(despesa?.numeroDocumento ?? '');
  const [responsavelId, setResponsavelId] = useState('');

  const ativas = (categorias ?? []).filter(
    (c) => c.situacao === 'ativa' || c.id === despesa?.categoria.id,
  );
  const categoriaEscolhida = categoriaId || (ativas[0] ? String(ativas[0].id) : '');
  const documentoOk = documentoDoFornecedor(fornecedorDocumento) !== null;
  const responsaveis = (equipe ?? []).filter(
    (u) =>
      u.situacao === 'ativo' &&
      u.id !== sessao.usuario.id &&
      nivelDoPerfil[u.perfil] >= 2 &&
      (perfisComTodasAsHabilitacoes.includes(u.perfil) || u.habilitacoes.includes('FI')),
  );
  const pronto =
    categoriaEscolhida &&
    descricao.trim() &&
    dinheiroValido(valor) &&
    dataDocumento &&
    dataDocumento <= hoje &&
    fornecedorNome.trim() &&
    documentoOk &&
    numeroDocumento.trim();

  return (
    <form
      className="formulario-do-modal"
      aria-label={novo ? 'Nova despesa' : 'Dados da despesa'}
      onSubmit={(e) => {
        e.preventDefault();
        aoEnviar({
          categoriaId: Number(categoriaEscolhida),
          descricao: descricao.trim(),
          valor: normalizarDinheiroDigitado(valor),
          dataDocumento,
          fornecedorNome: fornecedorNome.trim(),
          fornecedorDocumento: documentoDoFornecedor(fornecedorDocumento) ?? '',
          numeroDocumento: numeroDocumento.trim(),
          responsavelId: responsavelId ? Number(responsavelId) : null,
        });
      }}
    >
      {erro}
      <div className="grade-formulario">
        <Campo rotulo="Categoria" obrigatorio>
          {(p) => (
            <select
              {...p}
              required
              value={categoriaEscolhida}
              onChange={(e) => setCategoriaId(e.target.value)}
            >
              {ativas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          )}
        </Campo>
        <CampoDeDinheiro rotulo="Valor" valor={valor} aoMudar={setValor} />
        <Campo
          rotulo="Data do documento"
          obrigatorio
          ajuda="Define a competência (o mês)."
          erro={dataDocumento > hoje ? 'A data não pode ser futura.' : undefined}
        >
          {(p) => (
            <input
              {...p}
              type="date"
              required
              max={hoje}
              value={dataDocumento}
              onChange={(e) => setDataDocumento(e.target.value)}
            />
          )}
        </Campo>
        <Campo rotulo="Número do documento fiscal" obrigatorio>
          {(p) => (
            <input
              {...p}
              required
              maxLength={60}
              value={numeroDocumento}
              onChange={(e) => setNumeroDocumento(e.target.value)}
            />
          )}
        </Campo>
      </div>
      <Campo rotulo="Descrição" obrigatorio>
        {(p) => (
          <textarea
            {...p}
            required
            rows={2}
            maxLength={500}
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
          />
        )}
      </Campo>
      <div className="grade-formulario">
        <Campo rotulo="Fornecedor" obrigatorio>
          {(p) => (
            <input
              {...p}
              required
              maxLength={200}
              value={fornecedorNome}
              onChange={(e) => setFornecedorNome(e.target.value)}
            />
          )}
        </Campo>
        <Campo
          rotulo="CPF ou CNPJ do fornecedor"
          obrigatorio
          ajuda="Aceita o CNPJ numérico e o alfanumérico."
          erro={
            fornecedorDocumento && !documentoOk
              ? 'CPF ou CNPJ inválido: confira os números.'
              : undefined
          }
        >
          {(p) => (
            <input
              {...p}
              required
              maxLength={18}
              value={fornecedorDocumento}
              onChange={(e) => setFornecedorDocumento(e.target.value)}
              onBlur={() => {
                const d = documentoDoFornecedor(fornecedorDocumento);
                if (d) setFornecedorDocumento(formatarDocumentoDoFornecedor(d));
              }}
            />
          )}
        </Campo>
        {novo && nivelDoPerfil[sessao.usuario.perfil] >= 2 ? (
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
