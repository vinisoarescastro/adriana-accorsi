import { pode, podeAtribuirPerfil } from '@gabinete/autorizacao';
import {
  areas,
  perfis,
  perfisComTodasAsHabilitacoes,
  type Area,
  type Perfil,
  type RespostaDaSessao,
  type UsuarioComSenhaInicial,
  type UsuarioDaEquipe,
} from '@gabinete/compartilhado';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { chamar } from '../api/cliente';
import { chaves } from '../api/consultas';
import { useConfirmacao } from '../componentes/modal';
import { AvisoDeErro, Botao, Campo, Carregando, SenhaInicial } from '../componentes/ui';
import { formatarDataHora } from '../formatos';
import { rotuloDaArea, rotuloDoPerfil } from '../rotulos';

interface Registro {
  id: number;
  ocorridaEm: string;
  autorId: number | null;
  operacao: string;
  valorAnterior: unknown;
  valorNovo: unknown;
}

/** Tudo o que se pode fazer com um usuário. Cada ação grava na trilha e derruba as sessões dele. */
export function PainelDoUsuario({
  usuario,
  sessao,
}: {
  usuario: UsuarioDaEquipe;
  sessao: RespostaDaSessao;
}) {
  const { pedir, elemento: confirmacao } = useConfirmacao();
  const cliente = useQueryClient();
  const autoridade = { perfil: sessao.usuario.perfil, habilitacoes: sessao.usuario.habilitacoes };
  const fixas = perfisComTodasAsHabilitacoes.includes(usuario.perfil);

  const [nome, setNome] = useState(usuario.nome);
  const [contato, setContato] = useState(usuario.contato ?? '');
  const [perfil, setPerfil] = useState<Perfil>(usuario.perfil);
  const [habilitacoes, setHabilitacoes] = useState<Area[]>([...usuario.habilitacoes]);
  const [novaSenha, setNovaSenha] = useState<UsuarioComSenhaInicial | null>(null);
  const [verHistorico, setVerHistorico] = useState(false);

  const atualizar = () => cliente.invalidateQueries({ queryKey: chaves.equipe });
  const base = `/api/equipe/${usuario.id}`;

  const salvarDados = useMutation({
    mutationFn: () => chamar('PATCH', base, { corpo: { nome, contato: contato || null } }),
    onSuccess: atualizar,
  });
  const salvarPerfil = useMutation({
    mutationFn: () => chamar('PUT', `${base}/perfil`, { corpo: { perfil } }),
    onSuccess: atualizar,
  });
  const alternarSituacao = useMutation({
    mutationFn: () =>
      chamar('PUT', `${base}/situacao`, {
        corpo: { situacao: usuario.situacao === 'ativo' ? 'inativo' : 'ativo' },
      }),
    onSuccess: atualizar,
  });
  const salvarHabilitacoes = useMutation({
    mutationFn: () => chamar('PUT', `${base}/habilitacoes`, { corpo: { habilitacoes } }),
    onSuccess: atualizar,
  });
  const redefinir = useMutation({
    mutationFn: () => chamar<UsuarioComSenhaInicial>('POST', `${base}/redefinir-senha`),
    onSuccess: async (resposta) => {
      setNovaSenha(resposta);
      await atualizar();
    },
  });

  const historico = useQuery({
    queryKey: chaves.historico(usuario.id),
    queryFn: () => chamar<Registro[]>('GET', `${base}/historico`),
    enabled: verHistorico && pode('equipe.historico', autoridade),
  });

  const erro =
    salvarDados.error ??
    salvarPerfil.error ??
    alternarSituacao.error ??
    salvarHabilitacoes.error ??
    redefinir.error;
  const possiveis = areas.filter((a) => sessao.usuario.habilitacoes.includes(a));
  const perfisPossiveis = perfis.filter((p) => podeAtribuirPerfil(sessao.usuario.perfil, p));

  const alternar = (area: Area) =>
    setHabilitacoes((atual) =>
      atual.includes(area) ? atual.filter((a) => a !== area) : [...atual, area],
    );

  return (
    <div className="painel-do-usuario">
      {confirmacao}
      <AvisoDeErro erro={erro} />
      {novaSenha ? (
        <SenhaInicial
          senha={novaSenha.senhaInicial}
          validaAte={novaSenha.senhaInicialValidaAte}
          onFechar={() => setNovaSenha(null)}
        />
      ) : null}

      <h3>Dados</h3>
      <div className="grade-formulario">
        <Campo rotulo="Nome">
          {(p) => <input {...p} value={nome} onChange={(e) => setNome(e.target.value)} />}
        </Campo>
        <Campo rotulo="Contato">
          {(p) => <input {...p} value={contato} onChange={(e) => setContato(e.target.value)} />}
        </Campo>
      </div>
      <Botao pequeno onClick={() => salvarDados.mutate()} disabled={salvarDados.isPending || !nome}>
        Salvar dados
      </Botao>

      <h3>Perfil</h3>
      <div className="grade-formulario">
        <Campo rotulo="Perfil">
          {(p) => (
            <select {...p} value={perfil} onChange={(e) => setPerfil(e.target.value as Perfil)}>
              {perfisPossiveis.map((valor) => (
                <option key={valor} value={valor}>
                  {rotuloDoPerfil[valor]}
                </option>
              ))}
            </select>
          )}
        </Campo>
      </div>
      <Botao
        pequeno
        onClick={() => salvarPerfil.mutate()}
        disabled={salvarPerfil.isPending || perfil === usuario.perfil}
      >
        Alterar perfil
      </Botao>

      <h3>Habilitações</h3>
      {fixas ? (
        <p className="campo__ajuda">
          Este perfil tem todas as habilitações, que não podem ser removidas.
        </p>
      ) : (
        <>
          <fieldset className="grupo-de-opcoes">
            <legend className="somente-leitor">Habilitações</legend>
            {possiveis.map((area) => (
              <label key={area} className="opcao">
                <input
                  type="checkbox"
                  checked={habilitacoes.includes(area)}
                  onChange={() => alternar(area)}
                />
                {rotuloDaArea[area]}
              </label>
            ))}
          </fieldset>
          <Botao
            pequeno
            onClick={() => salvarHabilitacoes.mutate()}
            disabled={salvarHabilitacoes.isPending}
          >
            Salvar habilitações
          </Botao>
        </>
      )}

      <h3>Acesso</h3>
      <div className="acoes">
        <Botao
          pequeno
          variante={usuario.situacao === 'ativo' ? 'perigo' : 'secundario'}
          onClick={() => alternarSituacao.mutate()}
          disabled={alternarSituacao.isPending}
        >
          {usuario.situacao === 'ativo' ? 'Inativar usuário' : 'Reativar usuário'}
        </Botao>
        <Botao
          pequeno
          variante="secundario"
          onClick={() => {
            pedir({
              titulo: 'Gerar uma nova senha inicial?',
              mensagem: 'As sessões deste usuário serão encerradas.',
              rotuloDeConfirmar: 'Redefinir senha',
              aoConfirmar: () => redefinir.mutate(),
            });
          }}
          disabled={redefinir.isPending}
        >
          Redefinir senha
        </Botao>
        {pode('equipe.historico', autoridade) ? (
          <Botao pequeno variante="secundario" onClick={() => setVerHistorico((v) => !v)}>
            {verHistorico ? 'Ocultar histórico' : 'Ver histórico'}
          </Botao>
        ) : null}
      </div>

      {verHistorico ? (
        historico.isLoading ? (
          <Carregando />
        ) : (
          <ul>
            {historico.data?.map((r) => (
              <li key={r.id}>
                {formatarDataHora(r.ocorridaEm)}: {r.operacao}
              </li>
            ))}
          </ul>
        )
      ) : null}
    </div>
  );
}
