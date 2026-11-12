# Modelo de dados

Estado: rascunho da fase 0. Derivado do modelo conceitual do Mandatus (34 entidades, 9 globais e 25 de gabinete), sem `gabinete_id`, sem camada de plataforma, com tabelas novas para CEAP com vigência e notificações.

PostgreSQL 17. Nomes em `snake_case`. Enums gravados como texto com restrição `CHECK`. Chaves primárias `bigint generated always as identity` (ver ADR 0007). Exceções: `sessao` (ticket aleatório opaco), `protocolo_emitido` (o próprio protocolo) e `ceap_exercicio` (o ano). Toda tabela tem `criado_em` e, quando alterável, `atualizado_em`. Valores monetários em `numeric(14,2)`, trafegando como texto na API.

## 1. Mapa

| Grupo | Tabelas |
| --- | --- |
| Acesso | `usuario`, `conta_acesso`, `sessao`, `habilitacao`, `senha_inicial` |
| Identidade do gabinete | `gabinete` (linha única), `parametro` |
| Estrutura configurável | `tipo_processo`, `etapa`, `politica_publicacao`, `categoria` |
| Pessoas | `pessoa`, `consentimento_notificacao` |
| Atendimento | `protocolo_emitido`, `demanda`, `publicacao_andamento` |
| Ligação | `movimentacao`, `vinculo` |
| Trabalho | `tarefa`, `aviso` |
| Agenda | `compromisso`, `participante_interno`, `participante_externo`, `bloqueio_indisponibilidade`, `evento`, `participacao_evento` |
| Legislativo | `beneficiario`, `projeto_lei`, `projeto_assunto`, `projeto_coautor`, `tramitacao_comissao`, `votacao_projeto` |
| Emendas | `emenda`, `destinacao`, `execucao_destinacao` |
| CEAP | `ceap_parametro`, `ceap_categoria`, `ceap_exercicio`, `ceap_competencia`, `despesa` |
| Apoio | `documento`, `comentario_interno`, `pacote_documentos` |
| Notificação | `envio_notificacao` (outbox) |
| Auditoria | `trilha` |

O Mandatus tinha 9 entidades globais (gabinete, conta, módulo contratado, modelo padrão, parâmetro global, auditoria da plataforma, sessão, acesso de suporte, protocolo emitido). Aqui só sobrevivem sessão, protocolo emitido e uma linha de `gabinete` (identidade). `modulo_contratado`, `modelo_padrao`, `acesso_suporte` e `trilha_plataforma` somem.

## 2. Acesso

| Tabela | Colunas principais | Observações |
| --- | --- | --- |
| `conta_acesso` | `id`, `email` (único, minúsculo), `verificador_senha` (Argon2id), `bloqueada_ate`, `tentativas_falhas`, `senha_troca_obrigatoria` | |
| `usuario` | `id`, `conta_id`, `nome`, `contato`, `foto_chave`, `perfil` (parlamentar, administrador, chefe, supervisor, assessor_interno, assessor_externo), `situacao` (ativo, inativo) | Foto é chave no armazenamento privado, nunca URL |
| `habilitacao` | `usuario_id`, `area` (AT, AG, LG, FI), `concedida_por`, `concedida_em` | Entidade própria, auditável por item |
| `sessao` | `ticket_hash` (chave primária: SHA-256 em hexadecimal do ticket), `usuario_id`, `perfil`, `habilitacoes` (fixadas), `criada_em`, `ultimo_uso_em`, `expira_em` | Invalidável por usuário. O ticket em claro nunca é guardado: vazar o banco não vaza sessões |
| `senha_inicial` | `usuario_id`, `expira_em`, `usada_em` | Uso único, com prazo. O hash da senha fica em `conta_acesso.verificador_senha` |

Gatilho diferido: sempre existe ao menos um `usuario` com perfil administrador e situação ativo.

Índice único parcial: no máximo **um** `usuario` ativo com perfil `parlamentar`.

## 3. Identidade e configuração

| Tabela | Colunas principais |
| --- | --- |
| `gabinete` | Linha única (restrição garante só uma): nome do gabinete, parlamentar, cargo, partido, mandato, contatos públicos, foto, fuso |
| `parametro` | Parâmetros operacionais (limites de "parado", antecedência do aviso, etc.), com `chave` única e valor tipado |

## 4. Estrutura configurável

| Tabela | Colunas principais | Observações |
| --- | --- | --- |
| `tipo_processo` | `tipo` (demanda, tarefa, projeto_lei, emenda, despesa_ceap) | Cinco linhas |
| `etapa` | `tipo_processo_id`, `nome_interno`, `ordem`, `papel` (entrada, intermediaria, conclusao, arquivamento), `rotulo_publico`, `visivel_publico`, `prazo_padrao_dias`, `situacao` | `rotulo_publico` e `visivel_publico` só no tipo demanda; nome interno único entre ativas do tipo |
| `politica_publicacao` | `versao`, `exibir_titulo`, `exibicao_nome`, `exibicao_telefone`, `expiracao_dias`, `vigente_de`, `vigente_ate` | Histórico versionado; uma vigente |
| `categoria` | `natureza` (assunto_projeto, tipo_proposicao, natureza_documento, tipo_emenda), `nome`, `situacao` | Vocabulários controlados. Categorias de despesa ficam em `ceap_categoria` |

Restrições: uma etapa de Entrada, uma de Arquivamento e ao menos uma de Conclusão por tipo (verificadas no serviço e por gatilho diferido).

## 5. Pessoas e consentimento

| Tabela | Colunas principais | Observações |
| --- | --- | --- |
| `pessoa` | `nome_completo`, `telefone_normalizado`, `email`, `contatos`, `endereco`, `situacao` (ativa, inativa, dados_eliminados) | Telefone único entre pessoas ativas (índice parcial) |
| `consentimento_notificacao` | `pessoa_id`, `consentido` (bool), `registrado_por`, `registrado_em`, `origem`, `versao_texto`, `cancelado_em` | Histórico; o vigente é o mais recente |

## 6. Atendimento

| Tabela | Colunas principais | Observações |
| --- | --- | --- |
| `protocolo_emitido` | `protocolo` (único) | Garante unicidade e nunca reutilização |
| `demanda` | `protocolo`, `segredo_link_hash`, `solicitante_id`, `responsavel_id`, `autor_id`, `titulo`, `descricao`, `prioridade`, `etapa_atual_id`, `prazo`, `publicacao_link` (ativa, suspensa, revogada, expirada), `desfecho_em`, `link_expira_em`, `cancelada_em`, `justificativa_cancelamento`, `criado_em`, `atualizado_em` | Sem coluna de status. Gatilho: `protocolo` imutável. O segredo do link é guardado como hash |
| `publicacao_andamento` | `demanda_id`, `autor_id`, `texto`, `publicado_em`, `situacao` (publicada, removida) | Entidade distinta de `comentario_interno` |

## 7. Ligação

| Tabela | Colunas principais | Observações |
| --- | --- | --- |
| `movimentacao` | `registro_tipo`, `registro_id`, `tipo_processo_id`, `etapa_origem_id` (nula na entrada), `etapa_destino_id`, `autor_id`, `observacao`, `criada_em` | Transição de etapa de qualquer tipo. **Imutável** (gatilho). O banco recusa etapa de outro fluxo ou inativa. A etapa atual de um registro é o destino da última movimentação. (Mudança em relação ao rascunho: o registro é referenciado direto, sem passar por `vinculo`, para evitar a referência circular movimentação↔vínculo) |
| `vinculo` | `origem_tipo`, `origem_id`, `destino_tipo`, `destino_id`, `criado_por`, `criado_em` | Polimórfico, auditável; origem: tarefa, compromisso, documento, comentário, aviso; uma origem aponta para **um** registro (única); destino: demanda, projeto, emenda, destinação, despesa, tarefa, compromisso, evento, pessoa |

## 8. Trabalho e agenda

| Tabela | Colunas principais |
| --- | --- |
| `tarefa` | `criador_id`, `responsavel_id`, `titulo`, `descricao`, `prioridade`, `prazo`, `etapa_atual_id`, `concluida_em`, `concluida_por`, `cancelada_em`, `justificativa_cancelamento` |
| `aviso` | `destinatario_id`, `natureza` (9 valores), `vinculo_id`, `gerado_em`, `lido_em`, `expira_em`; sem texto, sem valor |
| `compromisso` | `criador_id`, `titulo`, `local`, `inicio`, `fim`, `dia_inteiro`, `visibilidade` (aberto, participantes, restrito), `envolve_parlamentar` (bool, padrão verdadeiro), `serie_id`, `cancelado_em` |
| `participante_interno` | `compromisso_id`, `usuario_id`, `resposta` (sem_resposta, confirmado, recusado) |
| `participante_externo` | `compromisso_id`, `pessoa_id` ou `beneficiario_id` |
| `bloqueio_indisponibilidade` | `criador_id`, `inicio`, `fim`, `dia_inteiro`, `cancelado_em` |
| `evento` | `criador_id`, `nome`, `inicio`, `local`, `situacao` (aberto, encerrado) |
| `participacao_evento` | `evento_id`, `pessoa_id`, `registrado_por`, `registrado_em`, `observacao`; única por evento e pessoa |

## 9. Legislativo

| Tabela | Colunas principais |
| --- | --- |
| `beneficiario` | `nome_fantasia`, `razao_social`, `cnpj` (único entre ativos), `cep`, `logradouro`, `numero`, `complemento`, `bairro`, `cidade`, `estado`, `natureza`, `situacao` |
| `projeto_lei` | `responsavel_id`, `titulo`, `ementa`, `numero` (único entre ativos), `tipo_proposicao_id`, `etapa_atual_id`, `prazo`, `cancelado_em`, `justificativa_cancelamento` |
| `projeto_assunto` | `projeto_id`, `categoria_id` |
| `projeto_coautor` | `projeto_id`, `nome` |
| `tramitacao_comissao` | `projeto_id`, `comissao`, `data`, `parecer` |
| `votacao_projeto` | `projeto_id`, `data`, `resultado` (sem placar individual) |

## 10. Emendas

| Tabela | Colunas principais | Observações |
| --- | --- | --- |
| `emenda` | `responsavel_id`, `identificacao`, `exercicio`, `tipo_id`, `finalidade`, `valor_disponibilizado`, `prazo_destinacao`, `prazo_empenho`, `prazo_execucao`, `etapa_atual_id`, cancelamento | Único: (`identificacao`, `exercicio`). **Só `valor_disponibilizado` é cadastrado**; comprometido, utilizado, disponível e a executar são derivados por visão |
| `destinacao` | `emenda_id`, `beneficiario_id`, `valor`, `finalidade`, `etapa_atual_id`, `situacao`, justificativa | Valor não excede o disponível |
| `execucao_destinacao` | `destinacao_id`, `valor`, `data` | Valor maior que zero; data não futura |

## 11. CEAP

Esta é a parte que mais difere do Mandatus. Ver `docs/especificacao/08-ceap.md`.

| Tabela | Colunas principais | Observações |
| --- | --- | --- |
| `ceap_parametro` | `chave` (por exemplo `cota_mensal`, `prazo_apresentacao_dias`, `guarda_originais_anos`, `limite_alerta`), `valor`, `vigente_de`, `vigente_ate` | Sem sobreposição de vigência para a mesma chave (restrição de exclusão por intervalo) |
| `ceap_categoria` | `nome`, `item_norma`, `teto_mensal`, `teto_percentual_menor_cota`, `comprovante_obrigatorio`, `situacao`, `vigente_de`, `vigente_ate` | A última ativa não se desativa |
| `ceap_exercicio` | `ano` (único) | |
| `ceap_competencia` | `exercicio_id`, `mes`, `cota_mensal_aplicada`, `encerrada_em` | `cota_mensal_aplicada` é o valor do parâmetro vigente congelado na competência, para reconstituir |
| `despesa` | `competencia_id`, `categoria_id`, `responsavel_id`, `lancado_por`, `decidido_por`, `decisao_pelo_proprio_lancador` (bool), `descricao`, `valor`, `data_documento`, `fornecedor_documento`, `fornecedor_nome`, `numero_documento`, `comprovante_id`, `etapa_atual_id`, `motivo_reprovacao`, `decidida_em`, cancelamento | Restrição e gatilho de segregação; ver abaixo |

### Regra de segregação no banco

```
CHECK (
  decidido_por IS NULL
  OR decidido_por <> lancado_por
  OR decisao_pelo_proprio_lancador = true
)
```

E um gatilho que, ao gravar `decisao_pelo_proprio_lancador = true`, confirma que `decidido_por` tem perfil Chefe ou Administrador no momento da decisão. Assim a exceção só existe para quem pode.

### Saldo

Derivado por visão (`ceap_saldo`): para cada competência,

`saldo do exercício = soma das cotas mensais aplicadas até a competência − soma das despesas aprovadas e em análise (e das etapas seguintes que consomem) − nada para despesas reprovadas, canceladas e glosadas`

Não existe coluna de saldo. O acúmulo é limitado ao exercício (zera na virada).

## 12. Apoio

| Tabela | Colunas principais | Observações |
| --- | --- | --- |
| `documento` | `vinculo_id`, `natureza_id`, `nome`, `tipo_real`, `tamanho`, `chave_armazenamento`, `hash`, `autor_envio`, `enviado_em`, `situacao` (ativo, removido), `varredura` (limpo, infectado, pendente) | Herda o alcance do registro. Bytes no armazenamento S3 |
| `comentario_interno` | `vinculo_id`, `autor_id`, `texto`, `criado_em`, `situacao` (ativo, removido), `removido_por`, `removido_em` | Sem edição |
| `pacote_documentos` | `periodo_inicio`, `periodo_fim`, `gerado_por`, `gerado_em`, `chave_armazenamento`, `relacao_conteudo` | Geração registrada |

## 13. Notificação (outbox)

| Tabela | Colunas principais | Observações |
| --- | --- | --- |
| `envio_notificacao` | `pessoa_id`, `demanda_id`, `evento` (andamento_publicado, etapa_visivel, conclusao, cancelamento), `canal` (email), `payload`, `estado` (pendente, enviando, enviado, falhou, cancelado), `tentativas`, `proxima_tentativa_em`, `provedor_id_mensagem`, `erro`, `criado_em`, `enviado_em` | Inserido na mesma transação do ato. O worker lê e envia. `app_worker` só insere em `aviso` e atualiza `envio_notificacao` |

## 14. Auditoria

| Tabela | Colunas principais | Observações |
| --- | --- | --- |
| `trilha` | `ocorrida_em`, `autor_id`, `origem` (usuario, publico, comando), `operacao`, `entidade`, `registro_id`, `valor_anterior` (jsonb), `valor_novo` (jsonb), `justificativa` | Gatilho recusa UPDATE, DELETE e TRUNCATE. Nunca contém senha nem segredo de link |

## 15. Visão pública

A área pública só lê a visão `vw_acompanhamento_publico`, que expõe exclusivamente o conjunto publicável:

- protocolo, data de cadastro, data da última atualização;
- etapa atual pelo rótulo público e status derivado do papel;
- etapas concluídas e próximas previstas (sem data), só as visíveis;
- andamentos publicados;
- título, nome e telefone do solicitante **conforme a política vigente** (já filtrados e mascarados na visão);
- nome, apresentação e contato do gabinete.

O papel `app_publico` só tem `SELECT` nessa visão. Valores monetários, legislativo, comentários, documentos, tarefas e usuários **não existem** para esse papel.

## 16. Papéis de banco

| Papel | Pode |
| --- | --- |
| `app_migracao` | Dono do esquema; só usado para migrar |
| `app_api` | CRUD nas tabelas de aplicação, exceto UPDATE e DELETE em `trilha`; sem propriedade; sem `BYPASSRLS` |
| `app_worker` | `INSERT` em `aviso`; `SELECT` e `UPDATE` de estado em `envio_notificacao`; leitura do necessário para gerar prazos |
| `app_publico` | `SELECT` em `vw_acompanhamento_publico`. O registro de acesso do cidadão na trilha entra na fase 3, por uma função própria (hoje não tem nenhuma permissão de tabela) |

## 17. Invariantes verificados na subida

Implementados em `packages/banco/src/invariantes.ts` (8 na fase 1, bloco 1.B: papéis sem propriedade nem privilégio elevado, gatilhos da trilha e do administrador, ausência de coluna de saldo, trilha imutável por permissão, escrita de worker e público só onde declarada, ninguém cria objetos). Os demais entram com as tabelas que os motivam. A lista completa prevista:

O processo não sobe se qualquer um falhar:

1. Papéis de aplicação não são donos de tabela.
2. Papéis sem `BYPASSRLS`.
3. Gatilhos de imutabilidade da trilha presentes.
4. Nenhuma coluna de saldo armazenado.
5. Toda coluna monetária declarada e com restrição de não negativo.
6. Sessão com ticket no servidor.
7. Visões em `security_invoker`.
8. `app_publico` sem escrita, exceto o registro de acesso.
9. `app_worker` só com as escritas declaradas.
10. Gatilho do "sempre um administrador" presente.
11. Gatilho de protocolo imutável presente.
12. Restrição de segregação da CEAP presente.

## 18. Pontos em aberto

1. (Resolvido em 2026-11-12: chave primária `bigint` com identidade, ver ADR 0007.)
2. Detalhar índices e visões de consolidado na fase correspondente.
3. Confirmar a modelagem de competência da CEAP depois de PV-B.
