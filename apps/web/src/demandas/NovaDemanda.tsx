import { nivelDoPerfil } from '@gabinete/autorizacao';
import {
  origensDeConsentimentoRegistravel,
  prioridades,
  textoDeConsentimento,
  type DemandaRegistrada,
  type PessoaDto,
  type Prioridade,
  type RespostaDaSessao,
} from '@gabinete/compartilhado';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { chamar } from '../api/cliente';
import { buscarPessoaPorTelefone, chavesDoAtendimento } from '../api/atendimento';
import { useEquipe } from '../api/consultas';
import { Aviso, AvisoDeErro, Botao, Campo } from '../componentes/ui';
import { rotuloDaOrigemDoConsentimento, rotuloDaPrioridade } from '../rotulos';

/**
 * Registro de demanda em UMA tela: busca a pessoa pelo telefone (e usa o cadastro que existir) ou
 * cadastra a pessoa na mesma operação. Devolve o protocolo e o link de acompanhamento.
 */
export function NovaDemanda({
  sessao,
  aoFechar,
  aoAbrir,
}: {
  sessao: RespostaDaSessao;
  aoFechar: () => void;
  aoAbrir: (id: number) => void;
}) {
  const cliente = useQueryClient();
  const { data: equipe } = useEquipe();
  const [telefone, setTelefone] = useState('');
  const [existente, setExistente] = useState<PessoaDto | null>(null);
  const [verificado, setVerificado] = useState(false);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [consentiu, setConsentiu] = useState(false);
  const [origem, setOrigem] =
    useState<(typeof origensDeConsentimentoRegistravel)[number]>('atendimento_telefonico');
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [prioridade, setPrioridade] = useState<Prioridade>('media');
  const [prazo, setPrazo] = useState('');
  const [responsavelId, setResponsavelId] = useState('');
  const [registrada, setRegistrada] = useState<DemandaRegistrada | null>(null);

  const podeEscolherResponsavel = nivelDoPerfil[sessao.usuario.perfil] >= 2;
  const responsaveis = (equipe ?? []).filter(
    (u) =>
      u.situacao === 'ativo' &&
      (u.habilitacoes.includes('AT') || ['administrador', 'parlamentar'].includes(u.perfil)),
  );

  const verificar = useMutation({
    mutationFn: () => buscarPessoaPorTelefone(telefone),
    onSuccess: (pessoa) => {
      setExistente(pessoa);
      setVerificado(true);
    },
  });

  const registrar = useMutation({
    mutationFn: () =>
      chamar<DemandaRegistrada>('POST', '/api/demandas', {
        corpo: {
          solicitante: existente
            ? { pessoaId: existente.id }
            : {
                nome,
                telefone,
                ...(email.trim() ? { email: email.trim() } : {}),
                // O consentimento só vale com e-mail, e começa desmarcado.
                ...(email.trim() && consentiu
                  ? {
                      consentimento: {
                        consentido: true,
                        origem,
                        versaoTexto: textoDeConsentimento.versao,
                      },
                    }
                  : {}),
              },
          titulo,
          prioridade,
          ...(descricao ? { descricao } : {}),
          ...(prazo ? { prazo } : {}),
          ...(responsavelId ? { responsavelId: Number(responsavelId) } : {}),
        },
      }),
    onSuccess: async (resposta) => {
      setRegistrada(resposta);
      await cliente.invalidateQueries({ queryKey: chavesDoAtendimento.tudo });
    },
  });

  if (registrada) {
    const { demanda, linkDeAcompanhamento } = registrada;
    return (
      <div className="cartao">
        <Aviso tipo="sucesso" titulo="Demanda registrada.">
          Informe este protocolo ao cidadão:
        </Aviso>
        <p>
          <strong className="protocolo">{demanda.protocolo}</strong>
        </p>
        <p className="campo__ajuda">
          Link de acompanhamento (entregue só ao próprio cidadão):{' '}
          <code>{linkDeAcompanhamento}</code>
        </p>
        <div className="acoes">
          <Botao onClick={() => aoAbrir(demanda.id)}>Abrir a demanda</Botao>
          <Botao
            variante="secundario"
            onClick={() => void navigator.clipboard?.writeText(demanda.protocolo)}
          >
            Copiar protocolo
          </Botao>
          <Botao variante="secundario" onClick={aoFechar}>
            Fechar
          </Botao>
        </div>
      </div>
    );
  }

  const enviar = (evento: FormEvent) => {
    evento.preventDefault();
    registrar.mutate();
  };
  const precisaDeNome = verificado && !existente;

  return (
    <form className="cartao" onSubmit={enviar} noValidate>
      <h2>Nova demanda</h2>
      <AvisoDeErro erro={registrar.error ?? verificar.error} />

      <Campo
        rotulo="Telefone do solicitante"
        ajuda="Com DDD. Buscamos o cadastro antes de pedir os dados."
      >
        {(p) => (
          <input
            {...p}
            type="tel"
            inputMode="tel"
            value={telefone}
            onChange={(e) => {
              setTelefone(e.target.value);
              setVerificado(false);
              setExistente(null);
            }}
            onBlur={() =>
              telefone.replace(/\D/g, '').length >= 10 && !verificado && verificar.mutate()
            }
            required
          />
        )}
      </Campo>
      {existente ? (
        <Aviso tipo="sucesso" titulo={`Pessoa já cadastrada: ${existente.nomeCompleto ?? ''}.`} />
      ) : null}
      {precisaDeNome ? (
        <Campo rotulo="Nome completo" ajuda="Pessoa nova: será cadastrada junto com a demanda.">
          {(p) => (
            <input
              {...p}
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
              maxLength={160}
            />
          )}
        </Campo>
      ) : null}

      {precisaDeNome ? (
        <fieldset className="grupo-de-opcoes">
          <legend>Avisos por e-mail (opcional)</legend>
          <Campo rotulo="E-mail" ajuda="Só é usado para avisar o andamento desta solicitação.">
            {(p) => (
              <input
                {...p}
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (!e.target.value.trim()) setConsentiu(false);
                }}
                maxLength={254}
              />
            )}
          </Campo>
          {email.trim() ? (
            <>
              <p className="campo__ajuda">Leia ao cidadão e só marque se ele disser sim:</p>
              <blockquote className="texto-de-consentimento">
                {textoDeConsentimento.texto}
              </blockquote>
              <label className="opcao">
                <input
                  type="checkbox"
                  checked={consentiu}
                  onChange={(e) => setConsentiu(e.target.checked)}
                />
                Li o texto ao cidadão e ele concordou em receber avisos por e-mail
              </label>
              {consentiu ? (
                <Campo rotulo="Como o cidadão autorizou">
                  {(p) => (
                    <select
                      {...p}
                      value={origem}
                      onChange={(e) => setOrigem(e.target.value as typeof origem)}
                    >
                      {origensDeConsentimentoRegistravel.map((o) => (
                        <option key={o} value={o}>
                          {rotuloDaOrigemDoConsentimento[o]}
                        </option>
                      ))}
                    </select>
                  )}
                </Campo>
              ) : null}
            </>
          ) : null}
        </fieldset>
      ) : null}

      <Campo rotulo="Título">
        {(p) => (
          <input
            {...p}
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            required
            maxLength={200}
            placeholder="Ex.: Poda de árvore na Rua das Flores"
          />
        )}
      </Campo>
      <Campo rotulo="Descrição (opcional)" ajuda="Uso interno: nunca aparece para o cidadão.">
        {(p) => (
          <textarea
            {...p}
            rows={3}
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            maxLength={5000}
          />
        )}
      </Campo>

      <div className="grade-formulario">
        <Campo rotulo="Prioridade">
          {(p) => (
            <select
              {...p}
              value={prioridade}
              onChange={(e) => setPrioridade(e.target.value as Prioridade)}
            >
              {prioridades.map((valor) => (
                <option key={valor} value={valor}>
                  {rotuloDaPrioridade[valor]}
                </option>
              ))}
            </select>
          )}
        </Campo>
        <Campo rotulo="Prazo (opcional)">
          {(p) => (
            <input {...p} type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
          )}
        </Campo>
        {podeEscolherResponsavel ? (
          <Campo rotulo="Responsável" ajuda="Se não escolher, é você.">
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
        <Botao
          type="submit"
          disabled={
            registrar.isPending || !titulo.trim() || !telefone || (!existente && !nome.trim())
          }
        >
          {registrar.isPending ? 'Registrando…' : 'Registrar demanda'}
        </Botao>
        <Botao variante="secundario" onClick={aoFechar}>
          Cancelar
        </Botao>
      </div>
    </form>
  );
}
