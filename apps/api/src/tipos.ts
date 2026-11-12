import type { NomeDeOperacao } from '@gabinete/autorizacao';
import type { DadosDaSessao } from './acesso/sessoes.js';

declare module 'fastify' {
  interface FastifyRequest {
    /** Preenchida pela autenticação em toda rota que não é pública. */
    sessao?: DadosDaSessao;
  }
  interface FastifyContextConfig {
    /** Rota sem sessão (login, saúde). Todas as outras exigem sessão e uma operação declarada. */
    publica?: true;
    /** A operação (definida em @gabinete/autorizacao) que a rota realiza. O decisor a confere. */
    operacao?: NomeDeOperacao;
    /** Permite a sessão que ainda precisa trocar a senha inicial (sessão, sair, trocar senha). */
    permiteComSenhaPendente?: true;
  }
}
