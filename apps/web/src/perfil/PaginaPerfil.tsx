import type { RespostaDaSessao } from '@gabinete/compartilhado';
import { useQueryClient } from '@tanstack/react-query';
import { FormularioDeTrocaDeSenha } from '../acesso/FormularioDeTrocaDeSenha';
import { chaves } from '../api/consultas';
import { EnvioDeFoto } from '../componentes/EnvioDeFoto';
import { rotuloDaArea, rotuloDoPerfil } from '../rotulos';

export function PaginaPerfil({ sessao }: { sessao: RespostaDaSessao }) {
  const cliente = useQueryClient();
  const { usuario } = sessao;

  return (
    <section>
      <h1>Meu perfil</h1>
      <div className="cartao">
        <h2>{usuario.nome}</h2>
        <p>{usuario.email}</p>
        <p>
          Perfil: <strong>{rotuloDoPerfil[usuario.perfil]}</strong>
        </p>
        <p>
          Habilitações:{' '}
          {usuario.habilitacoes.length > 0
            ? usuario.habilitacoes.map((a) => rotuloDaArea[a]).join(', ')
            : 'nenhuma'}
        </p>
        {usuario.perfil === 'parlamentar' ? (
          <p className="campo__ajuda">
            Esta conta é pessoal e intransferível: os atos ficam registrados em seu nome.
          </p>
        ) : null}
      </div>

      <div className="cartao">
        <h2>Foto de perfil</h2>
        <EnvioDeFoto
          rotulo="Enviar foto"
          endereco="/api/perfil/foto"
          aoEnviar={() => void cliente.invalidateQueries({ queryKey: chaves.equipe })}
        />
      </div>

      <div className="cartao">
        <h2>Trocar senha</h2>
        <p className="campo__ajuda">Ao trocar a senha, as suas outras sessões são encerradas.</p>
        <FormularioDeTrocaDeSenha />
      </div>
    </section>
  );
}
