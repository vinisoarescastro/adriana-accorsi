# 08. CEAP: Cota para o Exercício da Atividade Parlamentar

Estado: **proposta para validação (PV-B)**. Nada aqui deve ser tratado como a norma. A norma vigente é a da Câmara dos Deputados e muda; por isso o sistema guarda **parâmetros com vigência**, e não regras fixas no código.

## 8.1 O que o sistema é e não é

- É **controle interno e preparação da prestação de contas** do gabinete: lançar despesa, anexar comprovante, conferir, aprovar, acompanhar saldo e reunir o pacote de documentos.
- **Não substitui** o sistema oficial da Câmara (CotasNet) nem a apresentação do requerimento de reembolso, que é do parlamentar e segue os canais da Câmara.
- A guarda legal dos originais é do gabinete (a norma consultada fala em guarda por 5 anos dos originais físicos; confirmar em PV-B).

## 8.2 Fontes consultadas (para conferir em PV-B)

- Ato da Mesa nº 43/2009 (texto atualizado), na Legislação Informatizada da Câmara. Estabelece a CEAP.
- Alterações posteriores. A pesquisa indicou, entre outras, os Atos da Mesa 148/2024 e 196/2025, e a recomposição dos limites mensais pelo Ato da Mesa 244/2026 (20/02/2026).
- O texto consultado trazia valores de teto que podem estar **desatualizados** em relação ao Ato 244/2026. **Nenhum valor em reais está fixado neste documento nem deve ser copiado para o código.** Os valores entram como dados, conferidos no anexo oficial vigente.

## 8.3 Estrutura conceitual (derivada do Mandatus e da norma)

O Mandatus tinha uma "verba indenizatória" com vigência livre. A CEAP tem características próprias, então o modelo muda:

| Mandatus (verba) | Este sistema (CEAP) |
| --- | --- |
| Verba com início e fim livres | **Exercício** (ano) com **competência mensal** |
| Valor disponível cadastrado por verba | **Cota mensal** vinda de parâmetro com vigência (varia por UF e por recomposição) |
| Saldo = disponível − aprovadas − em análise | Saldo do exercício = soma das cotas mensais até a competência − despesas aprovadas − despesas em análise. A norma consultada diz que o saldo não usado acumula **dentro do exercício** e **não passa ao ano seguinte** |
| Categorias fixas de provisionamento | Categorias vindas de parâmetro, mapeadas aos itens de despesa da norma |
| Sem teto por categoria | Teto por categoria quando a norma o prevê, como parâmetro |

## 8.4 Parâmetros configuráveis, com vigência

Cada parâmetro tem **vigência (início e fim)**. Alterar um parâmetro fecha a vigência anterior e abre a nova. Assim, o saldo e as decisões de períodos passados continuam reconstituíveis com as regras que valiam à época. Só o Administrador altera, e toda alteração vai para a trilha.

| Parâmetro | Descrição |
| --- | --- |
| Cota mensal | Valor mensal da cota do mandato (depende da UF da parlamentar) |
| Adicionais de cota | Valores adicionais previstos (por exemplo, por cargo de liderança), se aplicáveis |
| Categorias de despesa | Lista de categorias, cada uma mapeada a um item do art. 2º da norma. Pode ser ativada e desativada |
| Teto por categoria | Valor máximo mensal por categoria, quando a norma define; vazio quando não há |
| Teto por percentual da menor cota | Para categorias limitadas a uma fração da menor cota mensal (informar a base) |
| Comprovante obrigatório | Por categoria; padrão sim |
| Prazo para apresentar a despesa | Em dias após o fornecimento (a norma consultada fala em 90 dias; confirmar) |
| Guarda dos originais | Em anos (a norma consultada fala em 5; confirmar) |
| Limite de alerta de saldo | Valor ou percentual abaixo do qual se gera aviso |
| Bloqueio de divulgação em período eleitoral | Categoria "divulgação da atividade parlamentar" vedada nos N dias anteriores a eleições, salvo exceção; o sistema só **avisa**, não decide (confirmar) |
| Acúmulo de saldo | Regra de acúmulo dentro do exercício e de zeragem na virada |
| Proporcionalidade | Cota proporcional aos dias de exercício do mandato, no início e no fim |

## 8.5 Categorias de despesa (proposta inicial, a conferir)

Mapeadas aos itens que a norma consultada lista como custeáveis. A lista exata e as vedações vêm de PV-B.

| Categoria | Observação |
| --- | --- |
| Passagens aéreas | Pode ser executada por assessor; autorização prévia conforme a norma |
| Telefonia | |
| Escritório de apoio | Aluguel, condomínio, energia, água, material de expediente, informática, internet, licenças de software, coworking, limpeza por empresa especializada |
| Assinaturas de publicações | |
| Alimentação do parlamentar | A norma consultada tem pontos internos que se contradizem sobre alimentação; confirmar |
| Hospedagem | Exceto no Distrito Federal, conforme a norma consultada |
| Locomoção | Aeronaves, veículos, embarcações, táxi, pedágio, estacionamento, passagens terrestres; há tetos por subitem |
| Combustíveis | Teto próprio |
| Segurança privada | Teto próprio |
| Divulgação da atividade parlamentar | Vedada em período eleitoral conforme a norma |
| Cursos, palestras e congressos | Limitado a fração da menor cota; vedados cursos de graduação e pós-graduação |
| Auxílio-moradia (complemento) | Teto próprio |
| Certificados e tokens digitais | |
| Serviços postais | |
| Outros | Residual deliberado, para ser vigiado e reclassificado |

**Vedações a avisar na tela (não decidir sozinho):** gastos eleitorais; compra de parentes ou servidores da Câmara; bens permanentes e gêneros alimentícios; fornecedor ligado ao parlamentar, a parentes até o terceiro grau ou a servidores. O sistema pode exibir alertas e campos de declaração; a responsabilidade sobre a conformidade é do parlamentar.

## 8.6 Despesa: campos e regras

| Id | Regra |
| --- | --- |
| RN-CEAP-01 | Exige descrição, valor maior que zero, categoria, data do documento (não futura) e responsável |
| RN-CEAP-02 | Fornecedor com CNPJ ou CPF, número e data do documento fiscal |
| RN-CEAP-03 | Comprovante anexado antes de ir para análise, quando a categoria o exige. Documento de despesa aprovada não pode ser removido |
| RN-CEAP-04 | A despesa não pode exceder o saldo do exercício, nem o teto da categoria no mês, quando houver |
| RN-CEAP-05 | Despesa em análise já reduz o saldo. Cancelar devolve o valor e exige justificativa |
| RN-CEAP-06 | Aprovar ou reprovar é terminal: despesa decidida não se edita nem se move. Reprovar exige motivo |
| RN-CEAP-07 | A competência da despesa é o mês da data do documento (a confirmar em PV-B) |
| RN-CEAP-08 | Despesa apresentada fora do prazo parametrizado gera alerta |
| RN-CEAP-09 | Nenhum valor de CEAP é publicável, em nenhuma configuração |

## 8.7 Segregação de função (decisão D6)

**Quem lança a despesa não a aprova, exceto o Chefe de Gabinete, o Administrador e a Parlamentar.**

| Quem decide | Despesa lançada por outra pessoa | Despesa que o próprio decisor lançou |
| --- | --- | --- |
| Assessor Interno | Não decide (nível insuficiente) | Não |
| Supervisor com FI | **Sim** | **Não** |
| Chefe de Gabinete | Sim | **Sim**, com coincidência registrada |
| Administrador | Sim | **Sim**, com coincidência registrada |
| Parlamentar | **Sim** | **Sim**, com coincidência registrada |

| Id | Regra |
| --- | --- |
| RN-CEAP-10 | O serviço recusa decisão de despesa quando decisor e lançador coincidem, exceto se o decisor for Chefe, Administrador ou Parlamentar |
| RN-CEAP-11 | O banco repete a regra por restrição e gatilho, para que não dependa só do código |
| RN-CEAP-12 | Quando decisor e lançador coincidem, a despesa recebe a marca **decisão pelo próprio lançador**, a trilha destaca o ato e o relatório de prestação de contas lista essas despesas |
| RN-CEAP-13 | Se nenhum Supervisor com FI puder decidir uma despesa (por exemplo, o único foi quem lançou), gera-se aviso ao Chefe e ao Administrador, para que a despesa não fique parada |

| Id | Regra |
| --- | --- |
| RN-CEAP-14 | O perfil Parlamentar tem acesso **total** à CEAP: consulta (despesas, saldo, relatório, pacote, reconstituição por data), lança, edita, anexa e remove comprovante, decide despesa (inclusive a que ela mesma lançou, com a marca de RN-CEAP-12) e altera parâmetros. Decisão do gabinete, confirmada em 2026-11-17 (PV-C). O fluxo da despesa continua sem passo de ateste da Deputada |

Por que há exceção: o Mandatus revogou a regra por completo (DT-114) porque gabinete pequeno tem um só supervisor financeiro e a despesa ficava parada. Aqui a regra se mantém para quem pode ser auditado de fora, e o Chefe e o Administrador, que respondem pelo gabinete, podem destravar com rastreabilidade.

**Ponto de atenção:** a coincidência é o tipo de dado que um órgão de controle olharia primeiro. Por isso fica explícita em relatório, não escondida em trilha.

## 8.8 Fluxo proposto da despesa

| Ordem | Etapa | Papel | Prazo padrão |
| --- | --- | --- | --- |
| 1 | Lançada | Entrada | |
| 2 | Em análise | Intermediária | 14 dias |
| 3 | Aprovada | Intermediária | |
| 4 | Apresentada à Câmara | Intermediária | |
| 5 | Ressarcida | Conclusão | |
| 6 | Reprovada | Conclusão | |
| 7 | Glosada pela Câmara | Conclusão | |
| 8 | Arquivada | Arquivamento | |

As etapas 4, 5 e 7 acompanham o que acontece depois da aprovação interna. **Decidido em 2026-11-12:** o fluxo acompanha as etapas pós-aprovação (Apresentada à Câmara, Ressarcida, Glosada pela Câmara). Os nomes e a ordem seguem sujeitos à validação com a assessoria financeira (PV-B). Como o fluxo é configurável, ajustes não exigem mudança de código.

Cálculo do saldo: despesa aprovada (e as que seguem a ela) e em análise reduzem o saldo; reprovada, cancelada e glosada **devolvem**. Ressarcida não muda o saldo (a cota já foi consumida).

## 8.9 Relatório e pacote

- **Relatório de prestação de contas** por período: despesas por categoria, saldo, despesas fora do prazo, despesas decididas pelo próprio lançador, vedações sinalizadas.
- **Pacote de documentos financeiros** por período (pela data de envio do documento), com relação de conteúdo e geração registrada na trilha. Download: Chefe ou superior.

## 8.10 Reconstituição

O Administrador pode reconstituir, para uma data passada, o saldo e a composição, usando os parâmetros que valiam naquela data. Isso depende de a vigência ser respeitada em todo cálculo.

## 8.11 Pontos em aberto (PV-B)

1. Obter a norma vigente (Ato 43/2009 consolidado e os atos posteriores) e o anexo de limites por UF.
2. Confirmar a UF da parlamentar e a cota mensal.
3. Confirmar quais categorias o gabinete realmente usa e quais subtetos se aplicam.
4. Confirmar a competência (mês do documento ou mês do requerimento).
5. Confirmar o prazo de apresentação, a guarda de originais e as regras de período eleitoral.
6. Validar os nomes e a ordem das etapas pós-aprovação (item 8.8), já decididas como parte do fluxo.
7. Validar com a assessoria financeira o relatório de prestação de contas.
