import type { CodigoDeErro, RespostaDeErro } from '@gabinete/compartilhado';

/** Erro previsto, com status HTTP e um código estável para o front. */
export class ErroDeNegocio extends Error {
  constructor(
    readonly status: number,
    readonly codigo: CodigoDeErro,
    mensagem: string,
    readonly detalhes?: readonly string[],
  ) {
    super(mensagem);
    this.name = 'ErroDeNegocio';
  }

  paraResposta(): RespostaDeErro {
    return this.detalhes
      ? { codigo: this.codigo, mensagem: this.message, detalhes: this.detalhes }
      : { codigo: this.codigo, mensagem: this.message };
  }
}

/**
 * A mesma mensagem serve para e-mail inexistente, senha errada, conta bloqueada e usuário
 * inativo: nada na resposta revela se a conta existe (RN-ACE-06).
 */
const mensagemDeCredenciais =
  'E-mail ou senha incorretos, ou acesso temporariamente bloqueado. Tente novamente em alguns minutos.';

export const erros = {
  requisicaoInvalida: () =>
    new ErroDeNegocio(400, 'requisicao_invalida', 'A requisição está incompleta ou inválida.'),
  credenciaisInvalidas: () =>
    new ErroDeNegocio(401, 'credenciais_invalidas', mensagemDeCredenciais),
  senhaInicialVencida: () =>
    new ErroDeNegocio(
      403,
      'senha_inicial_vencida',
      'A senha inicial venceu. Peça ao administrador para gerar outra.',
    ),
  naoAutenticado: () =>
    new ErroDeNegocio(401, 'nao_autenticado', 'Entre no sistema para continuar.'),
  naoEncontrado: () => new ErroDeNegocio(404, 'nao_encontrado', 'Não encontrado.'),
  semPermissao: (mensagem: string) => new ErroDeNegocio(403, 'sem_permissao', mensagem),
  conflito: (mensagem: string) => new ErroDeNegocio(409, 'conflito', mensagem),
  arquivoInvalido: (mensagem: string) => new ErroDeNegocio(400, 'arquivo_invalido', mensagem),
  trocaDeSenhaObrigatoria: () =>
    new ErroDeNegocio(
      403,
      'troca_de_senha_obrigatoria',
      'Troque a senha inicial antes de usar o sistema.',
    ),
  senhaAtualIncorreta: () =>
    new ErroDeNegocio(403, 'senha_atual_incorreta', 'A senha atual não confere.'),
  senhaFraca: (problemas: readonly string[]) =>
    new ErroDeNegocio(422, 'senha_fraca', 'A nova senha não atende às regras.', problemas),
  origemNaoPermitida: () =>
    new ErroDeNegocio(403, 'origem_nao_permitida', 'Origem da requisição não permitida.'),
  muitasRequisicoes: () =>
    new ErroDeNegocio(
      429,
      'muitas_requisicoes',
      'Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.',
    ),
};
