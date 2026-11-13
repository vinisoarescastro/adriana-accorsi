import type { EventoDeNotificacaoDto } from '@gabinete/compartilhado';

/**
 * Modelos de e-mail (minuta para revisão jurídica, PV-F). Regras: vocabulário de cidadão
 * ("solicitação", "situação", "novidade"); nada de título, descrição, prioridade, prazo ou dado
 * financeiro (RN-NOT-06); só o texto do andamento publicado, o protocolo e os dois links;
 * versão em texto simples e em HTML.
 */
export interface DadosDoEmail {
  readonly evento: EventoDeNotificacaoDto;
  readonly primeiroNome: string;
  readonly protocolo: string;
  /** Rótulo público da situação, quando há. */
  readonly rotulo: string | null;
  /** Texto do andamento publicado (só no evento `andamento_publicado`). */
  readonly texto: string | null;
  readonly linkDeAcompanhamento: string;
  readonly linkDeDescadastro: string;
  readonly gabinete: {
    readonly nome: string | null;
    readonly telefone: string | null;
    readonly email: string | null;
  };
}

const escapar = (valor: string) =>
  valor
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

const assuntos: Record<EventoDeNotificacaoDto, (protocolo: string) => string> = {
  andamento_publicado: (p) => `Novidade sobre a sua solicitação (protocolo ${p})`,
  etapa_visivel: (p) => `Atualização da sua solicitação (protocolo ${p})`,
  conclusao: (p) => `Sua solicitação foi concluída (protocolo ${p})`,
  cancelamento: (p) => `Sua solicitação foi encerrada (protocolo ${p})`,
};

function abertura(d: DadosDoEmail): string {
  switch (d.evento) {
    case 'andamento_publicado':
      return `Há uma novidade sobre a sua solicitação, protocolo ${d.protocolo}.`;
    case 'etapa_visivel':
      return `A sua solicitação, protocolo ${d.protocolo}, foi atualizada.`;
    case 'conclusao':
      return `A sua solicitação, protocolo ${d.protocolo}, foi concluída.`;
    case 'cancelamento':
      return `O gabinete encerrou o acompanhamento da sua solicitação, protocolo ${d.protocolo}.`;
  }
}

export function montarEmail(d: DadosDoEmail): { assunto: string; texto: string; html: string } {
  const nome = d.primeiroNome ? `Olá, ${d.primeiroNome}.` : 'Olá.';
  const contato = [
    d.gabinete.telefone ? `Telefone: ${d.gabinete.telefone}` : null,
    d.gabinete.email ? `E-mail: ${d.gabinete.email}` : null,
  ].filter((x): x is string => x !== null);
  const assinatura = d.gabinete.nome ?? 'Gabinete da Deputada Adriana Accorsi';
  const rodape =
    'Você recebe esta mensagem porque autorizou o aviso por e-mail sobre esta solicitação.';
  // O cancelamento tem texto padrão: o motivo é interno e nunca vai ao cidadão.
  const encerramento =
    d.evento === 'cancelamento' ? 'Se tiver dúvidas, fale com o gabinete.' : null;

  const texto = [
    nome,
    '',
    abertura(d),
    '',
    d.rotulo ? `Situação: ${d.rotulo}` : null,
    d.rotulo ? '' : null,
    d.evento === 'andamento_publicado' && d.texto ? d.texto : null,
    d.evento === 'andamento_publicado' && d.texto ? '' : null,
    encerramento,
    encerramento ? '' : null,
    `Para acompanhar, acesse: ${d.linkDeAcompanhamento}`,
    '',
    contato.length > 0 ? `Em caso de dúvida, fale com o gabinete.\n${contato.join('\n')}` : null,
    contato.length > 0 ? '' : null,
    `${rodape} Para deixar de receber, acesse: ${d.linkDeDescadastro}`,
    '',
    assinatura,
  ]
    .filter((linha): linha is string => linha !== null)
    .join('\n');

  const html = `<!doctype html>
<html lang="pt-BR"><body style="font-family: sans-serif; line-height: 1.5; color: #1b1f23;">
<p>${escapar(nome)}</p>
<p>${escapar(abertura(d))}</p>
${d.rotulo ? `<p><strong>Situação:</strong> ${escapar(d.rotulo)}</p>` : ''}
${d.evento === 'andamento_publicado' && d.texto ? `<p>${escapar(d.texto)}</p>` : ''}
${encerramento ? `<p>${escapar(encerramento)}</p>` : ''}
<p><a href="${escapar(d.linkDeAcompanhamento)}">Acompanhar a minha solicitação</a></p>
${contato.length > 0 ? `<p>Em caso de dúvida, fale com o gabinete.<br>${contato.map(escapar).join('<br>')}</p>` : ''}
<p style="color: #57606a; font-size: 0.9em;">${escapar(rodape)} <a href="${escapar(d.linkDeDescadastro)}">Deixar de receber</a></p>
<p>${escapar(assinatura)}</p>
</body></html>`;

  return { assunto: assuntos[d.evento](d.protocolo), texto, html };
}
