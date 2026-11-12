import type { RespostaDaSessao } from '@gabinete/compartilhado';
import { useEquipe } from '../api/consultas';
import { Aviso } from '../componentes/ui';
import { rotuloDoPerfil } from '../rotulos';

/**
 * O painel de verdade (atendimento, tarefas, agenda, legislativo, emendas, CEAP) chega com
 * os módulos, a partir da fase 2. Aqui só há o que a fundação já sabe.
 */
export function PaginaPainel({ sessao }: { sessao: RespostaDaSessao }) {
  const { data: equipe } = useEquipe();
  const ativos = equipe?.filter((u) => u.situacao === 'ativo').length;

  return (
    <section>
      <h1>Painel</h1>
      <div className="cartao">
        <h2>Olá, {sessao.usuario.nome}</h2>
        <p>
          Seu perfil: <strong>{rotuloDoPerfil[sessao.usuario.perfil]}</strong>.
        </p>
        {ativos !== undefined ? <p>Usuários ativos na equipe: {ativos}.</p> : null}
      </div>
      <Aviso tipo="atencao" titulo="Em construção.">
        Os blocos do painel entram junto com os módulos de atendimento, tarefas, agenda, legislativo
        e financeiro.
      </Aviso>
    </section>
  );
}
