# 0013. Financeiro: dinheiro, emendas parlamentares e CEAP

- Estado: aceita
- Data: 2026-11-17

## Contexto

A fase 6 controla o dinheiro do mandato: as emendas parlamentares (valor disponibilizado, destinações a beneficiários, execução) e a CEAP (cota mensal, despesas, análise e prestação de contas). Os riscos são: calcular com ponto flutuante; gravar saldo ou status em coluna, que envelhece ou diverge das parcelas; inventar regra da norma (cota, tetos, prazos) que o gabinete precisa conferir; deixar quem lança a despesa também aprová-la; e perder a capacidade de reconstituir o que valia em uma data passada, que é o que uma prestação de contas exige.

## Decisão

**Dinheiro**

- **`numeric(14,2)` no banco, texto na API, centavos inteiros na conta em JavaScript** (`packages/compartilhado/src/dinheiro.ts`). Nunca `number` com casas decimais. A API recusa valor com mais de duas casas, zero e negativo; a tela aceita "1.234,56" e envia "1234.56".
- **Nada é saldo ou status em coluna.** Comprometido, utilizado, a executar, disponível e o saldo da CEAP são calculados na leitura, a partir das parcelas. O status das emendas e das despesas deriva do papel da etapa, pelo mecanismo único de movimentação (fluxos `emenda` e `despesa_ceap`, migração 0006).
- **Invariantes no banco**, além da API: a soma das destinações ativas não passa do valor da emenda; a execução não passa da destinação nem fica no futuro; histórico de valor e de execução só acrescenta (permissão e gatilho). Os gatilhos travam a linha-pai antes de somar, para duas escritas simultâneas não furarem o limite.

**Emendas (migração 0015)**

- Só o **valor disponibilizado** é digitado, e como histórico (`emenda_valor`, só acrescenta): o valor atual é o mais recente, e o de uma data passada é o que valia nela. Uma destinação (a um beneficiário da fase 5) e suas execuções são registros próprios. Destinação com execução não se cancela. Emenda cancelada não se altera.
- **Reconstituição por data** (Administrador e Parlamentar): valores e etapa de qualquer emenda em um dia passado.
- Tipo da emenda (individual, de bancada…) é vocabulário em `categoria` (`tipo_emenda`), provisório.

**CEAP (migração 0016)**

- **Nenhum valor em reais é semeado.** A cota mensal, o limite de alerta e os prazos são **parâmetros com vigência** (`ceap_parametro`): o valor e o início não mudam; encerra-se a vigência e abre-se outra, e o banco impede sobreposição. As categorias de despesa são uma **proposta** do gabinete a conferir, sem teto; o teto mensal é opcional por categoria.
- **Saldo derivado por mês de exercício**: a cota de cada mês conta no dia 1, o consumo é o das despesas nas etapas Em análise, Aprovada, Apresentada à Câmara e Ressarcida, e o saldo é **acumulado** no exercício. Mês sem cota vigente é avisado na tela e não cresce o saldo. A competência da despesa é a da data do documento (coluna gerada).
- **Consumo concorrente**: a decisão que consome saldo toma uma trava consultiva (`advisory lock`), para duas aprovações simultâneas não estourarem a cota.
- **Segregação de funções**: quem lançou a despesa não a decide. Exceção: Chefe, Administrador e Parlamentar podem decidir a própria, e a despesa fica marcada ("decidida por quem lançou"), tanto na API quanto num gatilho do banco. Despesa decidida não se edita; reprovar exige motivo de 10 caracteres.
- **Comprovantes** usam o mecanismo de documentos da fase 2 (antivírus e link com segredo); algumas categorias exigem comprovante para enviar à análise.
- **Competência encerrada**: o Supervisor em diante encerra e reabre o mês; em mês encerrado não se lança, não se edita e não se envia despesa. **Parâmetros e categorias** são do Chefe em diante e da Parlamentar; o **relatório e o pacote**, do Chefe em diante.
- **Prestação de contas**: relatório por período de competências e **pacote ZIP dos comprovantes**, do Chefe em diante.
- A lógica depende dos **nomes das etapas** do fluxo `despesa_ceap`; a API confere (`etapasDaDespesa`) e recusa se o gabinete as renomeou a ponto de não reconhecê-las.

**Acesso**

- Acompanhar emendas (cadastrar, destinar, executar, mover) exige LG; **ver** emendas e valores aceita LG ou FI. A CEAP exige FI. A Parlamentar tem acesso total à CEAP. O Assessor Externo não alcança as emendas. Operações novas e a matriz esperada estão em `packages/autorizacao` (teste de matriz escrito à mão).
- O painel ganha o bloco financeiro (saldo, comprometido, disponível, despesas em análise) para quem pode vê-lo.

## Consequências

- Uma divergência entre as parcelas e o total é impossível de gravar; o que se vê é sempre conta, e a reconstituição é a mesma conta com a data.
- O gabinete **precisa cadastrar a cota mensal** em CEAP > Parâmetros antes de a CEAP funcionar; sem ela a despesa é recusada. Os valores da demonstração são fictícios.
- Renomear etapas dos fluxos financeiros exige cuidado: a página Fluxos não impede, a API acusa.
- Reconstituir o saldo à data reaproveita a última movimentação até a data; não há tabela de fotografias.
- Ficam para depois: integração com o portal da Transparência/Câmara, mais de uma cota por tipo de despesa, e tetos por categoria preenchidos (dependem da norma conferida pelo gabinete).
