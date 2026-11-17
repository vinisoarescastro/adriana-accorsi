import { nivelDoPerfil } from '@gabinete/autorizacao';
import {
  cnpjValido,
  formatarCep,
  formatarCnpj,
  naturezasDeBeneficiario,
  normalizarCep,
  normalizarCnpj,
  ufs,
  type BeneficiarioDto,
  type NaturezaDeBeneficiarioDto,
  type RespostaDaSessao,
  type Uf,
} from '@gabinete/compartilhado';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { chamar } from '../api/cliente';
import { chavesDoLegislativo } from '../api/legislativo';
import { Modal } from '../componentes/modal';
import { useToast } from '../componentes/toast';
import { AvisoDeErro, Botao, Campo, Selo } from '../componentes/ui';
import { rotuloDaNaturezaDoBeneficiario } from '../rotulos';

/**
 * Cadastro e edição do beneficiário. Todos os campos do endereço são obrigatórios, menos o
 * complemento. O CNPJ é conferido pelo dígito verificador (numérico ou alfanumérico) antes de enviar;
 * o servidor repete a conferência. Supervisor ou superior inativa e reativa.
 */
export function FormularioDeBeneficiario({
  sessao,
  beneficiario,
  aoFechar,
}: {
  sessao: RespostaDaSessao;
  /** Sem ele, é um cadastro novo. */
  beneficiario?: BeneficiarioDto | undefined;
  aoFechar: () => void;
}) {
  const cliente = useQueryClient();
  const avisar = useToast();
  const novo = beneficiario === undefined;

  const [nomeFantasia, setNomeFantasia] = useState(beneficiario?.nomeFantasia ?? '');
  const [razaoSocial, setRazaoSocial] = useState(beneficiario?.razaoSocial ?? '');
  const [cnpj, setCnpj] = useState(beneficiario ? formatarCnpj(beneficiario.cnpj) : '');
  const [natureza, setNatureza] = useState<NaturezaDeBeneficiarioDto>(
    beneficiario?.natureza ?? 'municipio',
  );
  const [cep, setCep] = useState(beneficiario ? formatarCep(beneficiario.cep) : '');
  const [logradouro, setLogradouro] = useState(beneficiario?.logradouro ?? '');
  const [numero, setNumero] = useState(beneficiario?.numero ?? '');
  const [complemento, setComplemento] = useState(beneficiario?.complemento ?? '');
  const [bairro, setBairro] = useState(beneficiario?.bairro ?? '');
  const [cidade, setCidade] = useState(beneficiario?.cidade ?? '');
  const [estado, setEstado] = useState<Uf>(beneficiario?.estado ?? 'MS');
  const [tocouNoCnpj, setTocouNoCnpj] = useState(false);

  const cnpjOk = cnpjValido(cnpj);
  const cepOk = /^\d{8}$/.test(normalizarCep(cep));
  const completo =
    nomeFantasia.trim() &&
    razaoSocial.trim() &&
    cnpjOk &&
    cepOk &&
    logradouro.trim() &&
    numero.trim() &&
    bairro.trim() &&
    cidade.trim();

  const encerrar = async () => {
    await cliente.invalidateQueries({ queryKey: chavesDoLegislativo.tudo });
    aoFechar();
  };

  const salvar = useMutation({
    mutationFn: () => {
      const corpo = {
        nomeFantasia: nomeFantasia.trim(),
        razaoSocial: razaoSocial.trim(),
        cnpj: normalizarCnpj(cnpj),
        natureza,
        cep: normalizarCep(cep),
        logradouro: logradouro.trim(),
        numero: numero.trim(),
        bairro: bairro.trim(),
        cidade: cidade.trim(),
        estado,
      };
      return novo
        ? chamar<BeneficiarioDto>('POST', '/api/beneficiarios', {
            corpo: { ...corpo, ...(complemento.trim() ? { complemento: complemento.trim() } : {}) },
          })
        : chamar<BeneficiarioDto>('PATCH', `/api/beneficiarios/${beneficiario.id}`, {
            corpo: { ...corpo, complemento: complemento.trim() || null },
          });
    },
    onSuccess: async () => {
      avisar({ tom: 'sucesso', titulo: novo ? 'Beneficiário cadastrado' : 'Dados salvos' });
      await encerrar();
    },
  });

  const situacao = useMutation({
    mutationFn: (nova: 'ativo' | 'inativo') =>
      chamar<BeneficiarioDto>('PUT', `/api/beneficiarios/${beneficiario?.id}/situacao`, {
        corpo: { situacao: nova },
      }),
    onSuccess: async (b) => {
      avisar({
        tom: 'sucesso',
        titulo: b.situacao === 'ativo' ? 'Beneficiário reativado' : 'Beneficiário inativado',
      });
      await encerrar();
    },
  });

  const podeInativar = nivelDoPerfil[sessao.usuario.perfil] >= 3;

  return (
    <Modal
      titulo={novo ? 'Novo beneficiário' : beneficiario.nomeFantasia}
      descricao={novo ? undefined : 'Município, órgão ou entidade.'}
      tamanho="lg"
      aoFechar={aoFechar}
    >
      <form
        className="formulario-do-modal"
        aria-label={novo ? 'Novo beneficiário' : 'Dados do beneficiário'}
        onSubmit={(e) => {
          e.preventDefault();
          salvar.mutate();
        }}
      >
        <AvisoDeErro erro={salvar.error ?? situacao.error} />
        {!novo && beneficiario.situacao === 'inativo' ? (
          <Selo tom="neutro" ponto>
            Inativo
          </Selo>
        ) : null}
        <div className="grade-formulario">
          <Campo rotulo="Nome fantasia" obrigatorio>
            {(p) => (
              <input
                {...p}
                required
                maxLength={150}
                value={nomeFantasia}
                onChange={(e) => setNomeFantasia(e.target.value)}
              />
            )}
          </Campo>
          <Campo rotulo="Razão social" obrigatorio>
            {(p) => (
              <input
                {...p}
                required
                maxLength={200}
                value={razaoSocial}
                onChange={(e) => setRazaoSocial(e.target.value)}
              />
            )}
          </Campo>
          <Campo
            rotulo="CNPJ"
            obrigatorio
            ajuda="Aceita o CNPJ numérico e o alfanumérico."
            erro={tocouNoCnpj && cnpj && !cnpjOk ? 'CNPJ inválido: confira os números.' : undefined}
          >
            {(p) => (
              <input
                {...p}
                required
                maxLength={18}
                value={cnpj}
                onChange={(e) => setCnpj(e.target.value)}
                onBlur={() => {
                  setTocouNoCnpj(true);
                  if (cnpjOk) setCnpj(formatarCnpj(cnpj));
                }}
              />
            )}
          </Campo>
          <Campo rotulo="Natureza" obrigatorio>
            {(p) => (
              <select
                {...p}
                value={natureza}
                onChange={(e) => setNatureza(e.target.value as NaturezaDeBeneficiarioDto)}
              >
                {naturezasDeBeneficiario.map((n) => (
                  <option key={n} value={n}>
                    {rotuloDaNaturezaDoBeneficiario[n]}
                  </option>
                ))}
              </select>
            )}
          </Campo>
        </div>

        <div className="grade-formulario">
          <Campo rotulo="CEP" obrigatorio erro={cep && !cepOk ? 'O CEP tem 8 números.' : undefined}>
            {(p) => (
              <input
                {...p}
                required
                inputMode="numeric"
                maxLength={9}
                value={cep}
                onChange={(e) => setCep(e.target.value)}
              />
            )}
          </Campo>
          <Campo rotulo="Logradouro" obrigatorio>
            {(p) => (
              <input
                {...p}
                required
                maxLength={200}
                value={logradouro}
                onChange={(e) => setLogradouro(e.target.value)}
              />
            )}
          </Campo>
          <Campo rotulo="Número" obrigatorio>
            {(p) => (
              <input
                {...p}
                required
                maxLength={20}
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
              />
            )}
          </Campo>
          <Campo rotulo="Complemento (opcional)">
            {(p) => (
              <input
                {...p}
                maxLength={100}
                value={complemento}
                onChange={(e) => setComplemento(e.target.value)}
              />
            )}
          </Campo>
          <Campo rotulo="Bairro" obrigatorio>
            {(p) => (
              <input
                {...p}
                required
                maxLength={100}
                value={bairro}
                onChange={(e) => setBairro(e.target.value)}
              />
            )}
          </Campo>
          <Campo rotulo="Cidade" obrigatorio>
            {(p) => (
              <input
                {...p}
                required
                maxLength={100}
                value={cidade}
                onChange={(e) => setCidade(e.target.value)}
              />
            )}
          </Campo>
          <Campo rotulo="Estado" obrigatorio>
            {(p) => (
              <select {...p} value={estado} onChange={(e) => setEstado(e.target.value as Uf)}>
                {ufs.map((uf) => (
                  <option key={uf} value={uf}>
                    {uf}
                  </option>
                ))}
              </select>
            )}
          </Campo>
        </div>

        <div className="acoes">
          <Botao type="submit" disabled={!completo} carregando={salvar.isPending}>
            {novo ? 'Cadastrar' : 'Salvar'}
          </Botao>
          <Botao variante="secundario" onClick={aoFechar}>
            Cancelar
          </Botao>
          {!novo && podeInativar ? (
            <Botao
              variante="fantasma"
              className="botao--perigo-suave"
              carregando={situacao.isPending}
              onClick={() =>
                situacao.mutate(beneficiario.situacao === 'ativo' ? 'inativo' : 'ativo')
              }
            >
              {beneficiario.situacao === 'ativo' ? 'Inativar' : 'Reativar'}
            </Botao>
          ) : null}
        </div>
      </form>
    </Modal>
  );
}
