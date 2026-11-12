import { pode } from '@gabinete/autorizacao';
import type { IdentidadeDoGabinete, RespostaDaSessao } from '@gabinete/compartilhado';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { chamar } from '../api/cliente';
import { chaves, useGabinete } from '../api/consultas';
import { EnvioDeFoto } from '../componentes/EnvioDeFoto';
import { Aviso, AvisoDeErro, Botao, Campo, Carregando } from '../componentes/ui';

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
    onSuccess: (salvo) => cliente.setQueryData(chaves.gabinete, salvo),
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
    <form className="cartao" onSubmit={enviar}>
      <h2>Identidade</h2>
      <AvisoDeErro erro={salvar.error} />
      {salvar.isSuccess ? <Aviso tipo="sucesso" titulo="Identidade salva." /> : null}
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
      {edita ? (
        <Botao
          type="submit"
          disabled={salvar.isPending || !campos.nome || !campos.parlamentarNome || !campos.cargo}
        >
          {salvar.isPending ? 'Salvando…' : 'Salvar identidade'}
        </Botao>
      ) : null}
    </form>
  );
}

export function PaginaConfiguracoes({ sessao }: { sessao: RespostaDaSessao }) {
  const cliente = useQueryClient();
  const { data: gabinete, isLoading, error } = useGabinete();
  const [versaoDaFoto, setVersaoDaFoto] = useState(0);
  const edita = pode('gabinete.editar', {
    perfil: sessao.usuario.perfil,
    habilitacoes: sessao.usuario.habilitacoes,
  });

  if (isLoading) return <Carregando />;

  return (
    <section>
      <h1>Configurações</h1>
      <AvisoDeErro erro={error} />
      {gabinete === null ? (
        <Aviso tipo="atencao" titulo="A identidade do gabinete ainda não foi configurada.">
          {edita ? 'Preencha os dados abaixo.' : 'Peça ao Chefe de Gabinete ou ao Administrador.'}
        </Aviso>
      ) : null}
      {/* A chave recria o formulário quando os dados chegam ou mudam. */}
      <Formulario
        key={gabinete ? gabinete.nome + gabinete.parlamentarNome : 'novo'}
        inicial={gabinete ?? null}
        edita={edita}
      />

      {gabinete?.temFoto ? (
        <div className="cartao">
          <h2>Foto do gabinete</h2>
          <img
            className="foto foto--grande"
            src={`/api/gabinete/foto?v=${versaoDaFoto}`}
            alt="Foto do gabinete"
          />
        </div>
      ) : null}
      {edita && gabinete ? (
        <div className="cartao">
          <EnvioDeFoto
            rotulo="Trocar a foto do gabinete"
            endereco="/api/gabinete/foto"
            aoEnviar={() => {
              setVersaoDaFoto((v) => v + 1);
              void cliente.invalidateQueries({ queryKey: chaves.gabinete });
            }}
          />
        </div>
      ) : null}
    </section>
  );
}
