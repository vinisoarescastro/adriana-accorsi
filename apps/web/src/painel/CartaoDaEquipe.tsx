import type { PainelDaEquipe } from '@gabinete/compartilhado';
import { UsersRound } from 'lucide-react';
import { Link } from 'react-router';
import { Abas } from '../componentes/abas';
import { Cartao } from '../componentes/cartao';
import { usarPreferencia } from '../componentes/usar-preferencia';
import { CargaDaEquipe } from '../graficos/CargaDaEquipe';
import { Rosca } from '../graficos/Rosca';
import { rotuloDoPerfil } from '../rotulos';

type Visao = 'pessoas' | 'perfis';

/** Carga da equipe: por pessoa (demandas e tarefas em andamento) ou por perfil (quantas pessoas em cada um). */
export function CartaoDaEquipe({ dados }: { dados: PainelDaEquipe }) {
  const [visao, mudar] = usarPreferencia<Visao>('equipe', 'pessoas', ['pessoas', 'perfis']);
  const comTrabalho = dados.pessoas.filter((p) => p.demandasAbertas + p.tarefasAbertas > 0).length;
  return (
    <Cartao
      titulo="Carga da equipe"
      descricao={`Em andamento por pessoa; concluídas em ${dados.periodoDias} dias.`}
      icone={<UsersRound size={18} />}
      acoes={
        <Abas
          segmentada
          discreta
          rotulo="Como mostrar a equipe"
          valor={visao}
          aoMudar={mudar}
          itens={[
            { id: 'pessoas', rotulo: 'Pessoas' },
            { id: 'perfis', rotulo: 'Perfis' },
          ]}
        />
      }
      rodape={
        <>
          <span>
            {comTrabalho} de {dados.pessoas.length} pessoas com trabalho em andamento
          </span>
          <Link className="cartao__ver" to="/g/equipe">
            Ver equipe
          </Link>
        </>
      }
    >
      {visao === 'pessoas' ? (
        <CargaDaEquipe pessoas={dados.pessoas} periodoDias={dados.periodoDias} />
      ) : (
        <Rosca
          rotulo="Pessoas por perfil"
          fatias={dados.porPerfil.map((p) => ({
            id: p.perfil,
            rotulo: rotuloDoPerfil[p.perfil],
            valor: p.total,
          }))}
          centro={{ valor: String(dados.pessoas.length), rotulo: 'pessoas' }}
        />
      )}
    </Cartao>
  );
}
