/** Temas de demanda de um gabinete de deputada federal: títulos, descrições e respostas fictícias. */

export interface Tema {
  readonly nome: string;
  readonly titulos: readonly string[];
  readonly descricoes: readonly string[];
  readonly andamentos: readonly string[];
  readonly conclusoes: readonly string[];
  readonly orgao: string;
}

export const temas: readonly Tema[] = [
  {
    nome: 'Previdência e INSS',
    orgao: 'INSS',
    titulos: [
      'Aposentadoria por idade parada há meses no INSS',
      'Perícia médica do INSS sem data marcada',
      'Auxílio por incapacidade temporária negado',
      'Revisão de benefício solicitada e sem resposta',
      'Pensão por morte em análise há mais de um ano',
    ],
    descricoes: [
      'O segurado deu entrada no pedido há mais de seis meses e o processo segue "em análise" no aplicativo Meu INSS.',
      'A perícia foi remarcada duas vezes e a pessoa está sem renda. Há laudos médicos anexados.',
      'O benefício foi negado por divergência de vínculo, mas a carteira de trabalho comprova o período.',
    ],
    andamentos: [
      'Encaminhamos o caso à Assessoria Parlamentar do INSS.',
      'O INSS informou que o processo entrou na fila de análise prioritária.',
      'A perícia foi reagendada. A família será avisada por telefone.',
    ],
    conclusoes: [
      'O benefício foi concedido e o primeiro pagamento, liberado.',
      'A perícia foi realizada e o resultado, comunicado ao segurado.',
    ],
  },
  {
    nome: 'Benefícios sociais (BPC, CadÚnico e Bolsa Família)',
    orgao: 'Ministério do Desenvolvimento e Assistência Social',
    titulos: [
      'Benefício de Prestação Continuada negado',
      'Cadastro no CadÚnico bloqueado',
      'Bolsa Família suspenso sem aviso',
      'BPC de pessoa com deficiência pendente de avaliação',
    ],
    descricoes: [
      'A pessoa tem direito ao benefício, mas o pedido foi negado por falta de um documento que a família já entregou.',
      'Família com quatro filhos pequenos teve o benefício suspenso e está sem renda no momento.',
    ],
    andamentos: [
      'O CRAS do município fará a atualização do cadastro.',
      'Orientamos a família sobre os documentos necessários e acompanhamos o recurso.',
      'O Ministério informou que o caso será reanalisado.',
    ],
    conclusoes: ['O benefício foi restabelecido.', 'A família foi incluída novamente no programa.'],
  },
  {
    nome: 'Saúde (SUS e Ministério da Saúde)',
    orgao: 'Ministério da Saúde',
    titulos: [
      'Medicamento de alto custo não entregue',
      'Tratamento fora de domicílio negado',
      'Habilitação de leitos de UTI pendente em {municipio}',
      'Recurso de custeio do hospital filantrópico atrasado',
      'Fila de cirurgia de grande porte no SUS',
    ],
    descricoes: [
      'O paciente tem prescrição e o medicamento do componente especializado está em falta na farmácia estadual.',
      'A família precisa viajar para tratamento em outra cidade e o transporte não foi autorizado.',
      'O município enviou o pedido de habilitação ao Ministério há mais de um ano, sem resposta.',
    ],
    andamentos: [
      'Pedimos prioridade ao Ministério da Saúde e à Secretaria Estadual.',
      'A regulação informou que o paciente está na fila prioritária.',
      'O pedido de habilitação foi localizado e segue para análise técnica.',
    ],
    conclusoes: [
      'O medicamento foi entregue e o tratamento, retomado.',
      'A habilitação foi publicada e o recurso, liberado ao município.',
    ],
  },
  {
    nome: 'Emendas parlamentares',
    orgao: 'Ministério responsável pela emenda',
    titulos: [
      'Prefeitura de {municipio} pede emenda para ambulância',
      'Entidade pede recurso para reforma da sede',
      'Emenda indicada e ainda não empenhada',
      'Pagamento de emenda parado na Caixa',
      'Pedido de emenda para equipamentos de hospital',
    ],
    descricoes: [
      'A prefeitura apresenta o plano de trabalho e pede a indicação de emenda individual para o exercício.',
      'A emenda foi indicada, mas o empenho não saiu e a obra está parada à espera do recurso.',
      'A entidade filantrópica atende centenas de famílias e precisa de apoio para equipamentos.',
    ],
    andamentos: [
      'O plano de trabalho foi analisado pela equipe técnica do gabinete.',
      'A emenda foi indicada na plataforma e aguarda a análise de impedimentos técnicos.',
      'Cobramos o empenho junto ao ministério.',
    ],
    conclusoes: [
      'A emenda foi paga e o município, avisado.',
      'O empenho foi realizado e a obra pôde ser retomada.',
    ],
  },
  {
    nome: 'Educação federal',
    orgao: 'Ministério da Educação',
    titulos: [
      'Financiamento do Fies com parcela em atraso',
      'Pé-de-Meia não depositado',
      'Vaga no Instituto Federal de Goiás',
      'Recurso do FNDE para a escola de {municipio} parado',
      'Bolsa do Prouni cancelada',
    ],
    descricoes: [
      'A família não consegue regularizar o contrato do Fies e o estudante corre o risco de perder a matrícula.',
      'O estudante cumpriu todos os requisitos e o depósito do incentivo não foi feito.',
    ],
    andamentos: [
      'Encaminhamos o caso ao FNDE.',
      'O MEC informou que o pagamento está em conciliação.',
      'A instituição foi acionada para a revisão da bolsa.',
    ],
    conclusoes: ['O contrato foi regularizado.', 'O depósito foi realizado e a família, avisada.'],
  },
  {
    nome: 'Rodovias e infraestrutura federal',
    orgao: 'DNIT',
    titulos: [
      'Buracos na BR-153 no trecho de {municipio}',
      'Sinalização apagada na BR-060',
      'Duplicação da BR-070 parada',
      'Passarela de pedestres na BR-153 em {municipio}',
      'Acostamento destruído na BR-050',
    ],
    descricoes: [
      'Os buracos já causaram acidentes e danos a veículos. Caminhoneiros e moradores pedem a recuperação urgente.',
      'A rodovia corta o bairro e não há passarela. Pedestres atravessam em risco, inclusive crianças.',
    ],
    andamentos: [
      'Encaminhamos ofício ao DNIT e à superintendência regional.',
      'O DNIT informou que o trecho entrou no programa de manutenção.',
      'A obra foi incluída no cronograma do próximo semestre.',
    ],
    conclusoes: ['A recuperação do trecho foi concluída.', 'A sinalização foi refeita.'],
  },
  {
    nome: 'Receita Federal e documentos',
    orgao: 'Receita Federal',
    titulos: [
      'Restituição do imposto de renda retida na malha fina',
      'Pendência no CPF impedindo a matrícula',
      'Fila de passaporte na Polícia Federal',
      'Regularização de CNPJ de microempreendedor',
    ],
    descricoes: [
      'A declaração está em malha há mais de um ano e o contribuinte já entregou toda a documentação.',
      'O passaporte é necessário para viagem de tratamento de saúde e não há data disponível para atendimento.',
    ],
    andamentos: [
      'A Receita Federal foi acionada pela Assessoria Parlamentar.',
      'A Polícia Federal reservou uma vaga de atendimento prioritário.',
    ],
    conclusoes: ['A pendência foi regularizada.', 'O documento foi emitido e entregue.'],
  },
  {
    nome: 'Trabalho e emprego',
    orgao: 'Ministério do Trabalho e Emprego',
    titulos: [
      'Seguro-desemprego negado',
      'Carteira de trabalho com vínculo não registrado',
      'Curso de qualificação para jovens em {municipio}',
      'Fiscalização de empresa que não paga salários',
    ],
    descricoes: [
      'O trabalhador foi demitido e o seguro-desemprego foi negado por erro de registro do empregador.',
      'Funcionários relatam salários atrasados há três meses e pedem a fiscalização do trabalho.',
    ],
    andamentos: [
      'Pedimos a revisão ao Ministério do Trabalho.',
      'A superintendência regional agendou a fiscalização.',
    ],
    conclusoes: ['O benefício foi liberado.', 'A empresa regularizou os pagamentos.'],
  },
  {
    nome: 'Segurança pública e fronteiras',
    orgao: 'Polícia Federal e Polícia Rodoviária Federal',
    titulos: [
      'Reforço de efetivo da PRF na BR-153',
      'Delegacia da Mulher sem plantão noturno em {municipio}',
      'Pedido de apoio da Polícia Federal a investigação',
      'Aumento de roubos de carga na BR-060',
    ],
    descricoes: [
      'Caminhoneiros e comerciantes relatam aumento de assaltos na rodovia e pedem policiamento.',
      'O município não tem atendimento especializado à mulher fora do horário comercial.',
    ],
    andamentos: [
      'O pedido foi encaminhado à superintendência regional.',
      'A região passou a receber operações semanais.',
    ],
    conclusoes: ['O policiamento foi reforçado e os relatos diminuíram.'],
  },
  {
    nome: 'Mulheres e direitos humanos',
    orgao: 'Ministério das Mulheres',
    titulos: [
      'Apoio a mulher vítima de violência doméstica',
      'Casa-abrigo sem recursos em {municipio}',
      'Pedido de acolhimento e medida protetiva',
      'Centro de referência da mulher fechado',
    ],
    descricoes: [
      'A vítima precisa de acolhimento e não encontra vaga na rede. O caso exige sigilo.',
      'O equipamento atende dezenas de mulheres por mês e corre o risco de fechar por falta de recursos.',
    ],
    andamentos: [
      'Acionamos a rede de proteção e a delegacia especializada.',
      'O caso foi encaminhado à Secretaria da Mulher com pedido de prioridade.',
    ],
    conclusoes: [
      'A vítima foi acolhida e está sob proteção.',
      'O recurso foi liberado e o centro, reaberto.',
    ],
  },
  {
    nome: 'Agricultura e regularização fundiária',
    orgao: 'INCRA e Ministério da Agricultura',
    titulos: [
      'Regularização de assentamento em {municipio}',
      'Financiamento do Pronaf negado',
      'Garantia-Safra não paga após a seca',
      'Georreferenciamento de propriedade rural pendente',
    ],
    descricoes: [
      'As famílias vivem na área há anos e aguardam o título definitivo do INCRA.',
      'O pequeno produtor perdeu a safra e o auxílio ainda não foi liberado.',
    ],
    andamentos: [
      'Encaminhamos o pedido à superintendência do INCRA em Goiás.',
      'O processo foi localizado e segue para a análise técnica.',
    ],
    conclusoes: ['O título foi entregue às famílias.', 'O auxílio foi pago aos produtores.'],
  },
  {
    nome: 'Pessoa idosa e pessoa com deficiência',
    orgao: 'Ministério dos Direitos Humanos e da Cidadania',
    titulos: [
      'Cadeira de rodas para idoso',
      'Isenção de imposto na compra de veículo adaptado',
      'Acessibilidade em agência do INSS',
    ],
    descricoes: [
      'O idoso tem laudo e não consegue comprar o equipamento. Pede-se o apoio por programa federal.',
      'A agência não tem rampa nem atendimento prioritário e uma moradora cadeirante não consegue ser atendida.',
    ],
    andamentos: [
      'Pedimos a avaliação da equipe de acessibilidade.',
      'O equipamento foi localizado no banco de ajudas técnicas.',
    ],
    conclusoes: ['O equipamento foi entregue à família.'],
  },
];
