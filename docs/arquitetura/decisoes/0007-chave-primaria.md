# 0007. Chave primária das tabelas

- Estado: aceita
- Data: 2026-11-12

## Contexto

Os identificadores dos registros aparecem em endereços internos (por exemplo `/g/demandas?demanda=<id>`) e na API. A alternativa recomendada pelo projeto era UUID v7. A decisão do usuário foi usar `bigint`.

## Decisão

- Chave primária `bigint generated always as identity` em todas as tabelas de aplicação.
- Exceções: `sessao` (ticket aleatório de 256 bits, que é segredo e nunca sequencial), `protocolo_emitido` (o próprio protocolo de 12 caracteres), `ceap_exercicio` (o ano) e o segredo do link de acompanhamento (aleatório, guardado como hash).
- No Drizzle, `bigint` em modo `number`. Os volumes de um único gabinete ficam muito abaixo do limite seguro de inteiros do JavaScript (2^53). Os identificadores trafegam como número na API, ao contrário dos valores monetários, que trafegam como texto.

## Alternativas consideradas

- **UUID v7:** não adivinhável e ordenável, mas sem função nativa no PostgreSQL 17 (gerado no aplicativo). Preterido por simplicidade.
- **UUID v4:** nativo, mas fragmenta índices.
- **`bigint` interno com código público separado:** mais proteção, mais código; descartado.

## Consequências

- Identificadores sequenciais são **adivinháveis**: quem vê `demanda=412` pode tentar `413`. Isso é aceito porque a autorização barra o acesso e porque recusa e inexistência respondem igual (RN-PUB-09 e decisor de autorização). Mesmo assim, o volume de registros pode ser inferido pelos números. Não é um risco para o cidadão, porque a área pública nunca usa o identificador interno: usa o protocolo e o segredo do link.
- **Regra de projeto:** nenhum identificador sequencial é exposto na área pública, em e-mails ou em links enviados a cidadãos.
- A suíte de alcance deve incluir testes de sondagem de identificadores vizinhos para perfis sem acesso.
- Chaves compactas e rápidas; índices menores.
- Migrações e testes ficam mais legíveis (ids pequenos).
