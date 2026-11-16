import { pode } from '@gabinete/autorizacao';
import type { IdentidadeDoGabinete, RespostaDaSessao } from '@gabinete/compartilhado';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BellRing, Building2, Globe, Image } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { chamar } from '../api/cliente';
import { chaves, useGabinete } from '../api/consultas';
import { EnvioDeFoto } from '../componentes/EnvioDeFoto';
import { CabecalhoDaPagina } from '../componentes/cabecalho';
import { Cartao } from '../componentes/cartao';
import { EsqueletoDeTabela } from '../componentes/tabela';
import { useToast } from '../componentes/toast';
import { Aviso, AvisoDeErro, Botao, Campo } from '../componentes/ui';
import { AvisosDePrazo } from './AvisosDePrazo';
import { PoliticaDePublicacao } from './PoliticaDePublicacao';

type Campos = Record<
  | 'nome'
  | 'parlamentarNome'
  | 'cargo'
  | 'partido'
  | 'mandato'
  | 'contatoTelefone'
  | 'contatoEmail'
  | 'contatoEndereco',
  string
>;

const vazio: Campos = {
  nome: '',
  parlamentarNome: '',
  cargo: '',
  partido: '',
  mandato: '',
  contatoTelefone: '',
  contatoEmail: '',
  contatoEndereco: '',
};

function paraCampos(g: IdentidadeDoGabinete | null | undefined): Campos {
  if (!g) return vazio;
  return {
    nome: g.nome,
    parlamentarNome: g.parlamentarNome,
    cargo: g.cargo,
    partido: g.partido ?? '',
    mandato: g.mandato ?? '',
    contatoTelefone: g.contatoTelefone ?? '',
    contatoEmail: g.contatoEmail ?? '',
    contatoEndereco: g.contatoEndereco ?? '',
  };
}

function Formulario({ inicial, edita }: { inicial: IdentidadeDoGabinete | null; edita: boolean }) {
  const cliente = useQueryClient();
  const avisar = useToast();
  const [campos, setCampos] = useState<Campos>(paraCampos(inicial));
  const definir = (nome: keyof Campos) => (e: { target: { value: string } }) =>
    setCampos((c) => ({ ...c, [nome]: e.target.value }));

  const salvar = useMutation({
    mutationFn: () =>
      chamar<IdentidadeDoGabinete>('PUT', '/api/gabinete', {
        corpo: {
          nome: campos.nome,
          parlamentarNome: campos.parlamentarNome,
          cargo: campos.cargo,
          partido: campos.partido || null,
          mandato: campos.mandato || null,
          contatoTelefone: campos.contatoTelefone || null,
          contatoEmail: campos.contatoEmail || null,
          contatoEndereco: campos.contatoEndereco || null,
        },
      }),
    onSuccess: (salvo) => {
      cliente.setQueryData(chaves.gabinete, salvo);
      avisar({ tom: 'sucesso', titulo: 'Identidade salva' });
    },
  });

  const enviar = (evento: FormEvent) => {
    evento.preventDefault();
    salvar.mutate();
  };

  const campo = (
    rotulo: string,
    nome: keyof Campos,
    extra: { obrigatorio?: boolean; tipo?: string } = {},
  ) => (
    <Campo rotulo={rotulo}>
      {(p) => (
        <input
          {...p}
          type={extra.tipo ?? 'text'}
          value={campos[nome]}
          onChange={definir(nome)}
          disabled={!edita}
          required={extra.obrigatorio}
        />
      )}
    </Campo>
  );

  return (
    <form onSubmit={enviar}>
      <Cartao
        titulo="Identidade"
        descricao="Os dados do gabinete aparecem no cabeçalho do sistema e na página do cidadão."
        rodape={
          edita ? (
            <Botao
              type="submit"
              carregando={salvar.isPending}
              disabled={!campos.nome || !campos.parlamentarNome || !campos.cargo}
            >
              Salvar identidade
            </Botao>
          ) : undefined
        }
      >
        <AvisoDeErro erro={salvar.error} />
        <div className="grade-formulario">
          {campo('Nome do gabinete', 'nome', { obrigatorio: true })}
          {campo('Nome da Parlamentar', 'parlamentarNome', { obrigatorio: true })}
          {campo('Cargo', 'cargo', { obrigatorio: true })}
          {campo('Partido', 'partido')}
          {campo('Mandato', 'mandato')}
          {campo('Telefone', 'contatoTelefone', { tipo: 'tel' })}
          {campo('E-mail de contato', 'contatoEmail', { tipo: 'email' })}
          {campo('Endereço', 'contatoEndereco')}
        </div>
      </Cartao>
    </form>
  );
}

type Secao = 'identidade' | 'politica' | 'avisos' | 'foto';

export function PaginaConfiguracoes({ sessao }: { sessao: RespostaDaSessao }) {
  const cliente = useQueryClient();
  const [parametros, definirParametros] = useSearchParams();
  const { data: gabinete, isLoading, error } = useGabinete();
  const [versaoDaFoto, setVersaoDaFoto] = useState(0);
  const autoridade = { perfil: sessao.usuario.perfil, habilitacoes: sessao.usuario.habilitacoes };
  const edita = pode('gabinete.editar', autoridade);

  const secoes: { id: Secao; rotulo: string; icone: ReactNode }[] = [
    { id: 'identidade', rotulo: 'Identidade', icone: <Building2 size={18} aria-hidden="true" /> },
    ...(pode('publicacao.consultar_politica', autoridade)
      ? [
          {
            id: 'politica' as const,
            rotulo: 'Política de publicação',
            icone: <Globe size={18} aria-hidden="true" />,
          },
        ]
      : []),
    ...(pode('avisos.configurar', autoridade)
      ? [
          {
            id: 'avisos' as const,
            rotulo: 'Avisos de prazo',
            icone: <BellRing size={18} aria-hidden="true" />,
          },
        ]
      : []),
    { id: 'foto', rotulo: 'Foto do gabinete', icone: <Image size={18} aria-hidden="true" /> },
  ];
  const pedida = parametros.get('secao');
  const atual: Secao = secoes.some((x) => x.id === pedida) ? (pedida as Secao) : 'identidade';

  if (isLoading) return <EsqueletoDeTabela linhas={3} colunas={2} />;

  return (
    <section>
      <CabecalhoDaPagina
        titulo="Configurações"
        descricao="Identidade do gabinete, o que o cidadão vê e os avisos da equipe."
      />
      <AvisoDeErro erro={error} />
      {gabinete === null ? (
        <Aviso tipo="atencao" titulo="A identidade do gabinete ainda não foi configurada.">
          {edita ? 'Preencha os dados abaixo.' : 'Peça ao Chefe de Gabinete ou ao Administrador.'}
        </Aviso>
      ) : null}

      <div className="configuracoes">
        <nav className="configuracoes__menu" aria-label="Seções das configurações">
          {secoes.map((x) => (
            <button
              key={x.id}
              type="button"
              className="configuracoes__item"
              aria-current={atual === x.id}
              onClick={() => definirParametros(x.id === 'identidade' ? {} : { secao: x.id })}
            >
              {x.icone}
              {x.rotulo}
            </button>
          ))}
        </nav>

        <div className="configuracoes__secao">
          {atual === 'identidade' ? (
            // A chave recria o formulário quando os dados chegam ou mudam.
            <Formulario
              key={gabinete ? gabinete.nome + gabinete.parlamentarNome : 'novo'}
              inicial={gabinete ?? null}
              edita={edita}
            />
          ) : null}
          {atual === 'politica' ? <PoliticaDePublicacao sessao={sessao} /> : null}
          {atual === 'avisos' ? <AvisosDePrazo /> : null}
          {atual === 'foto' ? (
            <Cartao
              titulo="Foto do gabinete"
              descricao="Aparece na página do cidadão e nos e-mails."
            >
              {gabinete?.temFoto ? (
                <img
                  className="foto foto--grande"
                  src={`/api/gabinete/foto?v=${versaoDaFoto}`}
                  alt="Foto do gabinete"
                />
              ) : (
                <p className="campo__ajuda">Nenhuma foto enviada.</p>
              )}
              {edita && gabinete ? (
                <EnvioDeFoto
                  rotulo="Trocar a foto do gabinete"
                  endereco="/api/gabinete/foto"
                  aoEnviar={() => {
                    setVersaoDaFoto((v) => v + 1);
                    void cliente.invalidateQueries({ queryKey: chaves.gabinete });
                  }}
                />
              ) : null}
            </Cartao>
          ) : null}
        </div>
      </div>
    </section>
  );
}
