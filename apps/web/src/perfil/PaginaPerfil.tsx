import type { Area, RespostaDaSessao } from '@gabinete/compartilhado';
import { useQueryClient } from '@tanstack/react-query';
import { Clock, Mail, ShieldCheck } from 'lucide-react';
import { FormularioDeTrocaDeSenha } from '../acesso/FormularioDeTrocaDeSenha';
import { chaves } from '../api/consultas';
import { EnvioDeFoto } from '../componentes/EnvioDeFoto';
import { CabecalhoDaPagina } from '../componentes/cabecalho';
import { Cartao } from '../componentes/cartao';
import { DicaDeUso } from '../componentes/dicas';
import { Selo } from '../componentes/ui';
import { formatarDataHora, iniciais } from '../formatos';
import { rotuloDaArea, rotuloDoPerfil } from '../rotulos';

const descricaoDaArea: Record<Area, string> = {
  AT: 'Demandas, pessoas e acompanhamento do cidadão.',
  AG: 'Agenda, eventos e compromissos.',
  LG: 'Atividade legislativa.',
  FI: 'Acompanhamento financeiro.',
};

export function PaginaPerfil({ sessao }: { sessao: RespostaDaSessao }) {
  const cliente = useQueryClient();
  const { usuario } = sessao;

  return (
    <section>
      <CabecalhoDaPagina
        titulo="Meu perfil"
        descricao="Seus dados, sua foto e a segurança da sua conta."
      />
      <div className="perfil-grade">
        <aside className="perfil-grade__lateral" aria-label="Resumo da conta">
          <Cartao>
            <div className="perfil-identidade">
              <span className="foto foto--grande" aria-hidden="true">
                {iniciais(usuario.nome)}
              </span>
              <h2 className="perfil-identidade__nome">{usuario.nome}</h2>
              <Selo tom="primario">{rotuloDoPerfil[usuario.perfil]}</Selo>
            </div>
            <dl className="perfil-dados">
              <div>
                <dt>
                  <Mail size={14} aria-hidden="true" /> E-mail
                </dt>
                <dd>{usuario.email}</dd>
              </div>
              <div>
                <dt>
                  <Clock size={14} aria-hidden="true" /> Sessão válida até
                </dt>
                <dd>{formatarDataHora(sessao.expiraEm)}</dd>
              </div>
            </dl>
            {usuario.perfil === 'parlamentar' ? (
              <DicaDeUso>
                Esta conta é <strong>pessoal e intransferível</strong>: os atos ficam registrados em
                seu nome.
              </DicaDeUso>
            ) : null}
          </Cartao>

          <Cartao titulo="Foto de perfil" descricao="Aparece na equipe e no seu cabeçalho.">
            <EnvioDeFoto
              rotulo="Enviar foto"
              endereco="/api/perfil/foto"
              aoEnviar={() => void cliente.invalidateQueries({ queryKey: chaves.equipe })}
            />
          </Cartao>
        </aside>

        <div className="perfil-grade__principal">
          <Cartao
            titulo="Áreas de acesso"
            descricao="O que você pode usar no gabinete. Para mudar, fale com a administração."
          >
            {usuario.habilitacoes.length > 0 ? (
              <ul className="perfil-areas">
                {usuario.habilitacoes.map((a) => (
                  <li key={a}>
                    <span className="perfil-areas__icone" aria-hidden="true">
                      <ShieldCheck size={16} />
                    </span>
                    <div>
                      <strong>{rotuloDaArea[a]}</strong>
                      <p>{descricaoDaArea[a]}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="campo__ajuda">Nenhuma área habilitada para a sua conta.</p>
            )}
          </Cartao>

          <Cartao
            titulo="Segurança"
            descricao="Ao trocar a senha, as suas outras sessões são encerradas."
          >
            <FormularioDeTrocaDeSenha />
          </Cartao>
        </div>
      </div>
    </section>
  );
}
