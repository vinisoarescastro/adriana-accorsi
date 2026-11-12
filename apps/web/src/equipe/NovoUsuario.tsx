import { podeAtribuirPerfil } from '@gabinete/autorizacao';
import {
  areas,
  perfis,
  perfisComTodasAsHabilitacoes,
  type Area,
  type Perfil,
  type RespostaDaSessao,
  type UsuarioComSenhaInicial,
} from '@gabinete/compartilhado';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { chamar } from '../api/cliente';
import { chaves } from '../api/consultas';
import { AvisoDeErro, Botao, Campo, SenhaInicial } from '../componentes/ui';
import { rotuloDaArea, rotuloDoPerfil } from '../rotulos';

/** Cadastro de um usuário. Só oferece o que quem cadastra pode conceder (as regras vêm do mesmo pacote da API). */
export function NovoUsuario({
  sessao,
  aoFechar,
}: {
  sessao: RespostaDaSessao;
  aoFechar: () => void;
}) {
  const cliente = useQueryClient();
  const perfisPossiveis = perfis.filter((p) => podeAtribuirPerfil(sessao.usuario.perfil, p));

  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [contato, setContato] = useState('');
  const [perfil, setPerfil] = useState<Perfil>(
    perfisPossiveis[perfisPossiveis.length - 1] ?? 'assessor_externo',
  );
  const [habilitacoes, setHabilitacoes] = useState<Area[]>([]);
  const [criado, setCriado] = useState<UsuarioComSenhaInicial | null>(null);

  const todas = perfisComTodasAsHabilitacoes.includes(perfil);
  const possiveis = areas.filter((a) => sessao.usuario.habilitacoes.includes(a));

  const criar = useMutation({
    mutationFn: () =>
      chamar<UsuarioComSenhaInicial>('POST', '/api/equipe', {
        corpo: {
          nome,
          email,
          perfil,
          habilitacoes: todas ? [] : habilitacoes,
          ...(contato ? { contato } : {}),
        },
      }),
    onSuccess: async (usuario) => {
      setCriado(usuario);
      await cliente.invalidateQueries({ queryKey: chaves.equipe });
    },
  });

  if (criado) {
    return (
      <div className="cartao">
        <h2>Usuário criado: {criado.nome}</h2>
        <SenhaInicial
          senha={criado.senhaInicial}
          validaAte={criado.senhaInicialValidaAte}
          onFechar={aoFechar}
        />
      </div>
    );
  }

  const alternar = (area: Area) =>
    setHabilitacoes((atual) =>
      atual.includes(area) ? atual.filter((a) => a !== area) : [...atual, area],
    );

  const enviar = (evento: FormEvent) => {
    evento.preventDefault();
    criar.mutate();
  };

  return (
    <form className="cartao" onSubmit={enviar} noValidate>
      <h2>Novo usuário</h2>
      <AvisoDeErro erro={criar.error} />
      <div className="grade-formulario">
        <Campo rotulo="Nome completo">
          {(p) => (
            <input
              {...p}
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
              maxLength={120}
            />
          )}
        </Campo>
        <Campo rotulo="E-mail">
          {(p) => (
            <input
              {...p}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          )}
        </Campo>
        <Campo rotulo="Contato (opcional)">
          {(p) => (
            <input
              {...p}
              value={contato}
              onChange={(e) => setContato(e.target.value)}
              maxLength={200}
            />
          )}
        </Campo>
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
      {todas ? (
        <p className="campo__ajuda">
          Este perfil tem todas as habilitações, que não podem ser removidas.
        </p>
      ) : (
        <fieldset className="grupo-de-opcoes">
          <legend>Habilitações</legend>
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
      )}
      <div className="acoes">
        <Botao type="submit" disabled={criar.isPending || !nome || !email}>
          {criar.isPending ? 'Criando…' : 'Criar usuário'}
        </Botao>
        <Botao variante="secundario" onClick={aoFechar}>
          Cancelar
        </Botao>
      </div>
    </form>
  );
}
