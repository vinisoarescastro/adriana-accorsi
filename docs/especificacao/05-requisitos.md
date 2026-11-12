# 05. Requisitos

Estado: rascunho da fase 0. Os requisitos funcionais estão nas regras de negócio (`04`) e nos módulos (`02`). Aqui ficam os **requisitos não funcionais** e os **critérios de aceite por fase**, que são a ponte com o plano.

## 5.1 Requisitos não funcionais

| Id | Requisito |
| --- | --- |
| RNF-SEG-01 | Autorização por um único decisor, usado por rotas e pela navegação |
| RNF-SEG-02 | Senhas com Argon2id; sessão com ticket no servidor, invalidável no ato; cookie `HttpOnly`, `SameSite=Strict`, `Secure` fora de desenvolvimento |
| RNF-SEG-03 | Cabeçalhos: HSTS de um ano, `nosniff`, `X-Frame-Options: DENY`, Referrer-Policy, Content-Security-Policy, sem cabeçalho Server |
| RNF-SEG-04 | Segredos fora do repositório; segredo do link nunca na trilha |
| RNF-SEG-05 | Limite de requisições por IP no login e nas rotas sensíveis |
| RNF-SEG-06 | Área pública sem rota de escrita (exceto a consulta por protocolo, por POST, que só lê), com papel de banco só de leitura da visão pública e sem credencial do armazenamento de arquivos |
| RNF-DAD-01 | Valores monetários em `numeric`, trafegando como texto na API; nunca negativos; sem coluna de saldo |
| RNF-DAD-02 | Trilha imutável por gatilho; operação e trilha na mesma transação |
| RNF-DAD-03 | Nada se apaga em operação comum |
| RNF-DAD-04 | Datas no fuso `America/Sao_Paulo`, não no do navegador |
| RNF-DAD-05 | Migrações versionadas em SQL; gatilhos, visões e restrições fazem parte delas |
| RNF-DES-01 | Listagens paginadas e filtradas no servidor; nenhuma tela carrega o conjunto completo |
| RNF-DES-02 | Painel, busca e exportação usam a mesma leitura das listagens |
| RNF-USA-01 | Interface em português, sem jargão técnico para o cidadão |
| RNF-USA-02 | Funcional em celular; presença registrada em poucos toques |
| RNF-USA-03 | Nenhuma informação depende só de cor; gráficos têm equivalente tabular |
| RNF-USA-04 | Contraste da paleta medido por teste |
| RNF-OPE-01 | Backup diário para fora da VPS, criptografado, com restauração testada |
| RNF-OPE-02 | Monitoramento de saúde, disco, certificado, fila e falhas do worker, com alerta |
| RNF-OPE-03 | Troca de domínio apenas por configuração |
| RNF-OPE-04 | Logs estruturados sem dados pessoais |
| RNF-MAN-01 | Telas e arquivos longos divididos por responsabilidade; limite de tamanho no lint |
| RNF-MAN-02 | Cada fase fecha com documentação atualizada |

## 5.2 Verificações que valem em toda fase

Em vez de numerá-las como o Mandatus (V-01 a V-85), este projeto as agrupa em suítes de teste que, uma vez criadas, **continuam rodando em todas as fases seguintes**:

| Suíte | Verifica |
| --- | --- |
| Matriz de permissão | Para cada operação, cada perfil e habilitação recebe o resultado esperado (gerada da definição única) |
| Alcance | Assessor Externo só alcança o que é seu; tarefa, documento e comentário herdam o alcance do registro; busca e exportação respeitam o alcance |
| Trilha | Toda escrita grava a trilha; falha na trilha desfaz; trilha imutável por SQL direto |
| Invariantes de banco | Sem coluna de saldo; valores não negativos; sempre um administrador; protocolo imutável; papéis de banco com as concessões certas |
| Área pública | Conjunto publicável fechado; respostas idênticas em falha; nenhuma rota de escrita; nenhum dado interno na resposta |
| Dinheiro | Somas sempre fecham; nenhum lançamento negativo ou zero; reconstituição por data confere |
| Segregação | Quem lança não aprova, exceto Chefe e Administrador; coincidência registrada |

## 5.3 Critérios de aceite

Estão no plano (`docs/plano/plano-de-implementacao.md`), por fase, e viram testes automatizados sempre que possível.
