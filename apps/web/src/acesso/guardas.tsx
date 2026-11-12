import type { RespostaDaSessao } from '@gabinete/compartilhado';
import type { ReactNode } from 'react';
import { Navigate } from 'react-router';
import { useSessao } from '../api/consultas';
import { Carregando } from '../componentes/ui';

/** Exige sessão e a senha inicial já trocada. Sem sessão, vai para a entrada. */
export function ExigeSessao({ children }: { children: (sessao: RespostaDaSessao) => ReactNode }) {
  const { data: sessao, isLoading } = useSessao();
  if (isLoading) return <Carregando />;
  if (!sessao) return <Navigate to="/entrar" replace />;
  if (sessao.senhaTrocaObrigatoria) return <Navigate to="/trocar-senha" replace />;
  return <>{children(sessao)}</>;
}

/**
 * A página só existe para quem o servidor diz que alcança. Falha fechada: o front usa a
 * lista que o MESMO decisor das rotas calculou, e não decide nada por conta própria.
 */
export function ExigePagina({
  id,
  sessao,
  children,
}: {
  id: string;
  sessao: RespostaDaSessao;
  children: ReactNode;
}) {
  const alcanca = sessao.paginasAlcancaveis.some((p) => p.id === id);
  return alcanca ? <>{children}</> : <NaoEncontrada />;
}

export function NaoEncontrada() {
  return (
    <section>
      <h1>Página não encontrada</h1>
      <p>Esta página não existe ou você não tem acesso a ela.</p>
    </section>
  );
}
