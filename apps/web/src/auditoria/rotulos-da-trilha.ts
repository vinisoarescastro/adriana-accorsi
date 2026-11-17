import type { TomDoSelo } from '../componentes/ui';

const maiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** "projeto_lei" vira "Projeto lei"; o que não tem nome melhor ganha este. */
export const humanizar = (texto: string) => maiuscula(texto.replace(/_/g, ' '));

export const rotuloDaEntidade: Record<string, string> = {
  usuario: 'Usuário',
  gabinete: 'Gabinete',
  pessoa: 'Pessoa',
  demanda: 'Demanda',
  tarefa: 'Tarefa',
  compromisso: 'Compromisso',
  evento: 'Evento',
  beneficiario: 'Beneficiário',
  projeto_lei: 'Projeto de lei',
  emenda: 'Emenda',
  despesa: 'Despesa da CEAP',
  fluxo: 'Fluxo',
  etapa: 'Etapa',
  categoria: 'Categoria',
};

export const nomeDaEntidade = (entidade: string) =>
  rotuloDaEntidade[entidade] ?? humanizar(entidade);

const verbos: Record<string, string> = {
  criar: 'Criou',
  cadastrar: 'Cadastrou',
  lancar: 'Lançou',
  atualizar: 'Alterou',
  editar: 'Editou',
  alterar: 'Alterou',
  mover: 'Moveu',
  cancelar: 'Cancelou',
  remover: 'Removeu',
  excluir: 'Excluiu',
  inativar: 'Inativou',
  reativar: 'Reativou',
  decidir: 'Decidiu',
  enviar: 'Enviou',
  entrada: 'Entrou no sistema',
  entrar: 'Entrou no sistema',
  sair: 'Saiu do sistema',
  destinar: 'Destinou',
  executar: 'Registrou execução',
  reatribuir: 'Reatribuiu',
  encerrar: 'Encerrou',
  reabrir: 'Reabriu',
};

/** A última parte da operação ("demanda.mover" → "mover"). */
export const acaoDaOperacao = (operacao: string) =>
  operacao.split('.').slice(1).join('.') || operacao;

/** "Moveu", "Criou"… ou, sem tradução, a própria ação com a inicial maiúscula. */
export function descricaoDaOperacao(operacao: string): string {
  const acao = acaoDaOperacao(operacao);
  return verbos[acao] ?? humanizar(acao.replace(/\./g, ' '));
}

/** O tom só reforça o texto: o que remove ou cancela chama atenção; o que cria é positivo. */
export function tomDaOperacao(operacao: string): TomDoSelo {
  const acao = acaoDaOperacao(operacao);
  if (/(cancel|remov|exclu|inativ|reprov|glos)/.test(acao)) return 'perigo';
  if (/(cri|cadastr|lanc|entrada|entrar|reativ)/.test(acao)) return 'sucesso';
  if (/(mover|decid|reatribu|encerr|reabr|destin|execut|enviar)/.test(acao)) return 'info';
  return 'neutro';
}
