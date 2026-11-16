/** Temas de demanda: títulos, descrições e respostas fictícias. */

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
    nome: 'Iluminação pública',
    orgao: 'Secretaria de Infraestrutura',
    titulos: [
      'Lâmpada queimada na Rua {rua}',
      'Poste sem luz há semanas no bairro {bairro}',
      'Iluminação precária na praça do {bairro}',
    ],
    descricoes: [
      'Moradores relatam que a rua está escura à noite e já houve tentativa de assalto. Pedem a troca das lâmpadas.',
      'O poste em frente ao número {num} está apagado desde o mês passado. Já foi feito chamado no 156 sem retorno.',
    ],
    andamentos: [
      'Encaminhamos o pedido à Secretaria de Infraestrutura.',
      'A equipe técnica agendou a visita ao local.',
      'A troca das lâmpadas está programada para a próxima semana.',
    ],
    conclusoes: [
      'A iluminação foi restabelecida. Obrigado por nos avisar!',
      'Os reparos na rede elétrica foram concluídos.',
    ],
  },
  {
    nome: 'Pavimentação e buracos',
    orgao: 'Secretaria de Obras',
    titulos: [
      'Buraco grande na Rua {rua}',
      'Recape asfáltico na Rua {rua}',
      'Asfalto danificado após as chuvas no {bairro}',
    ],
    descricoes: [
      'Buraco com mais de um metro de diâmetro que já danificou vários veículos. Pede-se o tapa-buraco urgente.',
      'A rua não recebe manutenção há mais de dez anos e fica intransitável quando chove.',
    ],
    andamentos: [
      'Solicitamos a vistoria da Secretaria de Obras.',
      'O local foi incluído no cronograma de tapa-buracos.',
      'A equipe de asfalto está mobilizada para a região.',
    ],
    conclusoes: ['O buraco foi tapado e a via liberada.', 'A obra de recape foi finalizada.'],
  },
  {
    nome: 'Saúde',
    orgao: 'Secretaria de Saúde',
    titulos: [
      'Consulta com cardiologista para idoso',
      'Fila de espera para cirurgia de catarata',
      'Falta de medicamento na UBS do {bairro}',
      'Exame de ressonância magnética pendente',
    ],
    descricoes: [
      'Paciente aguarda há mais de seis meses a marcação da consulta. Há laudo médico anexado.',
      'A unidade de saúde está sem o medicamento de uso contínuo e a família não consegue comprar.',
      'Cirurgia indicada pelo médico e sem data. A paciente tem dificuldade de locomoção.',
    ],
    andamentos: [
      'Entramos em contato com a regulação municipal.',
      'A consulta foi agendada. A família será avisada por telefone.',
      'Aguardamos retorno da central de regulação.',
    ],
    conclusoes: [
      'O atendimento foi realizado conforme agendado.',
      'O medicamento foi entregue na UBS e retirado pela família.',
    ],
  },
  {
    nome: 'Educação',
    orgao: 'Secretaria de Educação',
    titulos: [
      'Vaga em creche para criança de 2 anos',
      'Transporte escolar rural suspenso',
      'Reforma urgente na escola do {bairro}',
      'Falta de professor na escola municipal',
    ],
    descricoes: [
      'A mãe trabalha o dia todo e não tem com quem deixar a criança. Está na lista de espera há oito meses.',
      'O ônibus escolar deixou de passar na comunidade e os alunos estão faltando às aulas.',
    ],
    andamentos: [
      'Pedimos prioridade à Secretaria de Educação.',
      'Foi aberta uma vaga e a família será chamada.',
      'A reforma entrou na programação do segundo semestre.',
    ],
    conclusoes: ['A matrícula foi confirmada.', 'O serviço de transporte foi retomado.'],
  },
  {
    nome: 'Saneamento e drenagem',
    orgao: 'Concessionária de Saneamento',
    titulos: [
      'Esgoto a céu aberto na Rua {rua}',
      'Alagamento recorrente no {bairro}',
      'Falta de água há três dias no {bairro}',
      'Bueiro entupido na Rua {rua}',
    ],
    descricoes: [
      'O esgoto transborda na calçada e causa mau cheiro e risco de doenças.',
      'A cada chuva forte a água invade as casas. Moradores pedem obra de drenagem.',
    ],
    andamentos: [
      'A concessionária foi acionada e abriu um protocolo.',
      'A equipe de desobstrução foi ao local.',
      'A obra de drenagem foi incluída no plano de investimentos.',
    ],
    conclusoes: [
      'A rede foi consertada e o problema, resolvido.',
      'O abastecimento foi normalizado.',
    ],
  },
  {
    nome: 'Assistência social',
    orgao: 'Secretaria de Assistência Social',
    titulos: [
      'Cesta básica para família em vulnerabilidade',
      'Cadastro no CadÚnico pendente',
      'Benefício de prestação continuada negado',
      'Auxílio aluguel para família desabrigada',
    ],
    descricoes: [
      'Família com quatro filhos pequenos, pai desempregado, sem renda no momento.',
      'A pessoa tem direito ao benefício, mas o pedido foi negado por falta de um documento.',
    ],
    andamentos: [
      'O CRAS da região fará a visita social.',
      'O cadastro foi atualizado e o pedido segue para análise.',
      'Orientamos a família sobre os documentos necessários.',
    ],
    conclusoes: [
      'O benefício foi concedido.',
      'A família foi incluída no programa de assistência.',
    ],
  },
  {
    nome: 'Segurança pública',
    orgao: 'Guarda Municipal',
    titulos: [
      'Pedido de patrulhamento na Rua {rua}',
      'Aumento de furtos no {bairro}',
      'Ponto de tráfico denunciado perto da escola',
    ],
    descricoes: [
      'Moradores relatam furtos frequentes e pedem ronda no período da noite.',
      'A denúncia foi feita de forma anônima e encaminhada aos órgãos competentes.',
    ],
    andamentos: [
      'O pedido foi encaminhado ao comando da Guarda Municipal.',
      'A região passou a receber rondas diárias.',
    ],
    conclusoes: ['A ronda foi reforçada e os moradores relatam melhora.'],
  },
  {
    nome: 'Meio ambiente e limpeza urbana',
    orgao: 'Secretaria de Meio Ambiente',
    titulos: [
      'Poda de árvore na Rua {rua}',
      'Terreno baldio com mato alto e entulho',
      'Coleta de lixo irregular no {bairro}',
      'Árvore com risco de queda',
    ],
    descricoes: [
      'Os galhos encostam na fiação e podem cair com o vento. A rua é de grande movimento.',
      'O lote abandonado acumula lixo e atrai animais peçonhentos. Pede-se a limpeza e a notificação do proprietário.',
    ],
    andamentos: [
      'Pedimos a vistoria da equipe de poda.',
      'A limpeza do terreno foi agendada.',
      'O proprietário do lote foi notificado.',
    ],
    conclusoes: ['A poda foi realizada.', 'O terreno foi limpo e a coleta, regularizada.'],
  },
  {
    nome: 'Habitação e regularização',
    orgao: 'Agência de Habitação',
    titulos: [
      'Regularização do imóvel no {bairro}',
      'Escritura pendente de conjunto habitacional',
      'Inscrição em programa de moradia popular',
    ],
    descricoes: [
      'A família mora no imóvel há quinze anos e não consegue a escritura definitiva.',
      'Foram entregues os documentos, mas o processo está parado há mais de um ano.',
    ],
    andamentos: [
      'O processo foi localizado na Agência de Habitação.',
      'Falta apenas a assinatura do termo. Entraremos em contato.',
    ],
    conclusoes: ['A escritura foi entregue à família.'],
  },
  {
    nome: 'Transporte e mobilidade',
    orgao: 'Agência de Transporte',
    titulos: [
      'Linha de ônibus cortada no {bairro}',
      'Ponto de ônibus sem abrigo na Rua {rua}',
      'Semáforo com defeito no cruzamento da Rua {rua}',
      'Faixa de pedestres apagada em frente à escola',
    ],
    descricoes: [
      'Moradores ficaram sem transporte coletivo e dependem de carona para trabalhar.',
      'O semáforo fica piscando e já ocorreram acidentes no cruzamento.',
    ],
    andamentos: [
      'Solicitamos a revisão do itinerário à Agência de Transporte.',
      'A manutenção do semáforo foi agendada.',
    ],
    conclusoes: ['A linha foi restabelecida.', 'O semáforo foi consertado.'],
  },
  {
    nome: 'Esporte, cultura e lazer',
    orgao: 'Fundação de Cultura',
    titulos: [
      'Apoio ao torneio de futsal do {bairro}',
      'Reforma da quadra poliesportiva',
      'Pedido de apoio a festival de cultura popular',
      'Praça sem manutenção no {bairro}',
    ],
    descricoes: [
      'A associação de moradores organiza o evento anual e pede apoio com o espaço e a divulgação.',
      'A quadra está com o piso quebrado e as redes rasgadas. Crianças e jovens deixaram de usar.',
    ],
    andamentos: [
      'Enviamos ofício à Fundação de Cultura.',
      'O apoio foi aprovado e a data, confirmada.',
    ],
    conclusoes: ['O evento foi realizado com sucesso.', 'A quadra foi reformada e reinaugurada.'],
  },
  {
    nome: 'Idosos e pessoas com deficiência',
    orgao: 'Secretaria de Assistência Social',
    titulos: [
      'Rampa de acesso em unidade de saúde',
      'Cadeira de rodas para idoso',
      'Transporte para pacientes de hemodiálise',
    ],
    descricoes: [
      'A unidade não tem rampa e uma moradora cadeirante não consegue ser atendida.',
      'O idoso tem laudo e não consegue comprar o equipamento. Pede-se o empréstimo por programa social.',
    ],
    andamentos: [
      'Pedimos a avaliação da equipe de acessibilidade.',
      'O equipamento foi localizado no banco de ajudas técnicas.',
    ],
    conclusoes: ['O equipamento foi entregue à família.'],
  },
];
