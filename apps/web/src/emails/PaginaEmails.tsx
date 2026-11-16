import { estadosDeEnvio, type EstadoDeEnvioDto } from '@gabinete/compartilhado';
import { Mail } from 'lucide-react';
import { useState } from 'react';
import { useFilaDeEmails } from '../api/cidadao';
import { Ban, CheckCheck, Clock, MailWarning, Send } from 'lucide-react';
import { CabecalhoDaPagina } from '../componentes/cabecalho';
import { CartaoDeIndicador, GradeDeIndicadores } from '../componentes/indicador';
import { EstadoVazio } from '../componentes/dicas';
import { BarraDeFerramentas, EsqueletoDeTabela, Paginacao } from '../componentes/tabela';
import { AvisoDeErro, Campo, Selo, type TomDoSelo } from '../componentes/ui';
import { formatarDataHora } from '../formatos';
import { rotuloDoEstadoDeEnvio, rotuloDoEventoDeEmail } from '../rotulos';

const tomDoEnvio: Record<EstadoDeEnvioDto, TomDoSelo> = {
  pendente: 'info',
  enviando: 'primario',
  enviado: 'sucesso',
  falhou: 'perigo',
  cancelado: 'neutro',
};

/**
 * Fila de e-mails ao cidadão (Supervisor em diante): o que foi enviado, o que falhou e o que foi
 * cancelado, com o motivo. Não mostra o endereço de e-mail nem o conteúdo: só o protocolo.
 */
const iconesDoEstado = {
  pendente: <Clock size={18} />,
  enviando: <Send size={18} />,
  enviado: <CheckCheck size={18} />,
  falhou: <MailWarning size={18} />,
  cancelado: <Ban size={18} />,
};

export function PaginaEmails() {
  const [estado, setEstado] = useState<EstadoDeEnvioDto | ''>('');
  const [pagina, setPagina] = useState(1);
  const { data, isLoading, error } = useFilaDeEmails({ pagina, estado });
  const totalDePaginas = data ? Math.max(1, Math.ceil(data.total / data.porPagina)) : 1;

  return (
    <section>
      <CabecalhoDaPagina
        titulo="E-mails ao cidadão"
        descricao="Os avisos de andamento enviados a quem autorizou. Uma falha de envio nunca desfaz o ato que a gerou: o envio é repetido, e o resultado aparece aqui."
      />

      {data ? (
        <GradeDeIndicadores rotulo="Resumo por situação">
          {estadosDeEnvio.map((e) => (
            <CartaoDeIndicador
              key={e}
              rotulo={rotuloDoEstadoDeEnvio[e]}
              valor={data.porEstado[e]}
              icone={iconesDoEstado[e]}
            />
          ))}
        </GradeDeIndicadores>
      ) : null}

      <BarraDeFerramentas rotulo="Filtro dos e-mails">
        <Campo rotulo="Situação">
          {(p) => (
            <select
              {...p}
              value={estado}
              onChange={(e) => {
                setEstado(e.target.value as EstadoDeEnvioDto | '');
                setPagina(1);
              }}
            >
              <option value="">Todas</option>
              {estadosDeEnvio.map((e) => (
                <option key={e} value={e}>
                  {rotuloDoEstadoDeEnvio[e]}
                </option>
              ))}
            </select>
          )}
        </Campo>
      </BarraDeFerramentas>

      <AvisoDeErro erro={error} />
      {isLoading ? <EsqueletoDeTabela colunas={6} /> : null}
      {data ? (
        <div className="cartao cartao--tabela">
          <div className="tabela-rolavel">
            <table className="tabela">
              <caption>
                {data.total} e-mail(s), página {data.pagina} de {totalDePaginas}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Protocolo</th>
                  <th scope="col">Motivo do e-mail</th>
                  <th scope="col">Situação</th>
                  <th scope="col">Tentativas</th>
                  <th scope="col">Quando</th>
                  <th scope="col">Observação</th>
                </tr>
              </thead>
              <tbody>
                {data.itens.map((i) => (
                  <tr key={i.id}>
                    <td>{i.protocolo}</td>
                    <td>{rotuloDoEventoDeEmail[i.evento]}</td>
                    <td>
                      <Selo tom={tomDoEnvio[i.estado]} ponto>
                        {rotuloDoEstadoDeEnvio[i.estado]}
                      </Selo>
                    </td>
                    <td className="e-numero">{i.tentativas}</td>
                    <td>
                      {i.enviadoEm
                        ? `Enviado em ${formatarDataHora(i.enviadoEm)}`
                        : i.proximaTentativa
                          ? `Próxima tentativa em ${formatarDataHora(i.proximaTentativa)}`
                          : `Criado em ${formatarDataHora(i.criadoEm)}`}
                    </td>
                    <td>{i.erro ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.itens.length === 0 ? (
            <EstadoVazio icone={<Mail size={24} />} titulo="Nenhum e-mail encontrado." />
          ) : null}
          <Paginacao pagina={pagina} totalDePaginas={totalDePaginas} aoMudar={setPagina} />
        </div>
      ) : null}
    </section>
  );
}
