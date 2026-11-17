/** Conteúdo fictício do legislativo para a demonstração: nada aqui é projeto nem entidade real. */

/** Município (ou órgão e entidade) com o CEP de base, para os beneficiários. */
export const beneficiariosDeExemplo: ReadonlyArray<{
  readonly nomeFantasia: string;
  readonly razaoSocial: string;
  readonly natureza: 'municipio' | 'orgao' | 'entidade';
  readonly cidade: string;
  readonly cep: string;
}> = [
  {
    nomeFantasia: 'Prefeitura de Goiânia',
    razaoSocial: 'Município de Goiânia',
    natureza: 'municipio',
    cidade: 'Goiânia',
    cep: '74015030',
  },
  {
    nomeFantasia: 'Prefeitura de Aparecida de Goiânia',
    razaoSocial: 'Município de Aparecida de Goiânia',
    natureza: 'municipio',
    cidade: 'Aparecida de Goiânia',
    cep: '74905030',
  },
  {
    nomeFantasia: 'Prefeitura de Anápolis',
    razaoSocial: 'Município de Anápolis',
    natureza: 'municipio',
    cidade: 'Anápolis',
    cep: '75020010',
  },
  {
    nomeFantasia: 'Prefeitura de Rio Verde',
    razaoSocial: 'Município de Rio Verde',
    natureza: 'municipio',
    cidade: 'Rio Verde',
    cep: '75901010',
  },
  {
    nomeFantasia: 'Prefeitura de Trindade',
    razaoSocial: 'Município de Trindade',
    natureza: 'municipio',
    cidade: 'Trindade',
    cep: '75380010',
  },
  {
    nomeFantasia: 'Prefeitura de Formosa',
    razaoSocial: 'Município de Formosa',
    natureza: 'municipio',
    cidade: 'Formosa',
    cep: '73801010',
  },
  {
    nomeFantasia: 'Prefeitura de Catalão',
    razaoSocial: 'Município de Catalão',
    natureza: 'municipio',
    cidade: 'Catalão',
    cep: '75701010',
  },
  {
    nomeFantasia: 'Prefeitura de Luziânia',
    razaoSocial: 'Município de Luziânia',
    natureza: 'municipio',
    cidade: 'Luziânia',
    cep: '72800010',
  },
  {
    nomeFantasia: 'Secretaria Municipal de Saúde de Goiânia',
    razaoSocial: 'Fundo Municipal de Saúde de Goiânia',
    natureza: 'orgao',
    cidade: 'Goiânia',
    cep: '74093250',
  },
  {
    nomeFantasia: 'Secretaria Municipal de Educação de Anápolis',
    razaoSocial: 'Secretaria Municipal de Educação de Anápolis',
    natureza: 'orgao',
    cidade: 'Anápolis',
    cep: '75024010',
  },
  {
    nomeFantasia: 'Defesa Civil de Senador Canedo',
    razaoSocial: 'Coordenadoria Municipal de Defesa Civil de Senador Canedo',
    natureza: 'orgao',
    cidade: 'Senador Canedo',
    cep: '75250000',
  },
  {
    nomeFantasia: 'Hospital filantrópico de Goiânia',
    razaoSocial: 'Associação Beneficente Hospitalar de Goiânia',
    natureza: 'entidade',
    cidade: 'Goiânia',
    cep: '74110010',
  },
  {
    nomeFantasia: 'Instituto Mulheres em Rede',
    razaoSocial: 'Instituto Mulheres em Rede de Goiás',
    natureza: 'entidade',
    cidade: 'Goiânia',
    cep: '74210010',
  },
  {
    nomeFantasia: 'Associação Rio Verde Solidário',
    razaoSocial: 'Associação Comunitária Rio Verde Solidário',
    natureza: 'entidade',
    cidade: 'Rio Verde',
    cep: '75905000',
  },
  {
    nomeFantasia: 'Clube de Mães do Jardim Novo Mundo',
    razaoSocial: 'Associação Clube de Mães do Jardim Novo Mundo',
    natureza: 'entidade',
    cidade: 'Goiânia',
    cep: '74715000',
  },
  {
    nomeFantasia: 'Cooperativa Cerrado Vivo',
    razaoSocial: 'Cooperativa de Produtores Cerrado Vivo',
    natureza: 'entidade',
    cidade: 'Pirenópolis',
    cep: '72980000',
  },
];

export const logradourosDeExemplo = [
  'Avenida Goiás',
  'Avenida Anhanguera',
  'Avenida Tocantins',
  'Rua 24 de Outubro',
  'Avenida Independência',
  'Rua 90',
];

/** Projetos fictícios: título, ementa e o tipo de proposição preferido. */
export const projetosDeExemplo: ReadonlyArray<{
  readonly titulo: string;
  readonly ementa: string;
  readonly tipo: string;
  readonly assuntos: readonly string[];
}> = [
  {
    titulo: 'Programa nacional de atenção à saúde da mulher no campo',
    ementa:
      'Institui o programa nacional de atenção integral à saúde da mulher em áreas rurais, com unidades móveis de exame preventivo.',
    tipo: 'Projeto de lei',
    assuntos: ['Saúde', 'Mulheres'],
  },
  {
    titulo: 'Atendimento prioritário a vítimas de violência doméstica',
    ementa:
      'Garante atendimento prioritário e sigiloso às vítimas de violência doméstica nos serviços públicos de saúde e assistência social.',
    tipo: 'Projeto de lei',
    assuntos: ['Mulheres', 'Direitos humanos'],
  },
  {
    titulo: 'Merenda escolar com produtos da agricultura familiar',
    ementa:
      'Amplia para quarenta por cento o percentual mínimo de compras da agricultura familiar na alimentação escolar.',
    tipo: 'Projeto de lei',
    assuntos: ['Educação', 'Economia e trabalho'],
  },
  {
    titulo: 'Poda segura de árvores em vias urbanas',
    ementa:
      'Estabelece diretrizes nacionais para a poda de árvores em vias urbanas, com protocolo de segurança e destinação do material.',
    tipo: 'Projeto de lei',
    assuntos: ['Meio ambiente', 'Mobilidade e transporte'],
  },
  {
    titulo: 'Combate à evasão escolar no ensino médio',
    ementa:
      'Cria o sistema de alerta precoce de evasão escolar e a busca ativa de estudantes do ensino médio.',
    tipo: 'Projeto de lei',
    assuntos: ['Educação'],
  },
  {
    titulo: 'Transporte gratuito para tratamento fora do domicílio',
    ementa:
      'Assegura transporte gratuito e acompanhante a pacientes em tratamento de saúde fora do município de residência.',
    tipo: 'Projeto de lei',
    assuntos: ['Saúde', 'Mobilidade e transporte'],
  },
  {
    titulo: 'Plano nacional de segurança nas escolas',
    ementa:
      'Institui o plano nacional de prevenção e resposta a situações de violência no ambiente escolar.',
    tipo: 'Projeto de lei complementar',
    assuntos: ['Segurança pública', 'Educação'],
  },
  {
    titulo: 'Incentivo a creches em horário estendido',
    ementa:
      'Autoriza a União a apoiar municípios que ofereçam creches em horário estendido para famílias com mães trabalhadoras.',
    tipo: 'Projeto de lei',
    assuntos: ['Educação', 'Assistência social', 'Mulheres'],
  },
  {
    titulo: 'Proteção das nascentes do Cerrado',
    ementa:
      'Dispõe sobre a proteção das nascentes e áreas de recarga hídrica do Cerrado, berço das águas do Brasil.',
    tipo: 'Projeto de lei',
    assuntos: ['Meio ambiente'],
  },
  {
    titulo: 'Requerimento de informações sobre filas de cirurgia eletiva',
    ementa:
      'Requer ao Ministério da Saúde informações sobre o tempo de espera por cirurgias eletivas no estado.',
    tipo: 'Requerimento',
    assuntos: ['Saúde'],
  },
  {
    titulo: 'Indicação de pavimentação de acesso a comunidade rural',
    ementa:
      'Indica ao Ministério dos Transportes a pavimentação do acesso a comunidade rural de grande produção agrícola.',
    tipo: 'Indicação',
    assuntos: ['Mobilidade e transporte', 'Economia e trabalho'],
  },
  {
    titulo: 'Acesso à cultura nas periferias',
    ementa:
      'Cria linha de apoio a espaços culturais comunitários em regiões periféricas das cidades.',
    tipo: 'Projeto de lei',
    assuntos: ['Cultura e esporte'],
  },
  {
    titulo: 'Esporte nas escolas públicas',
    ementa:
      'Garante a oferta de práticas esportivas e quadra coberta em escolas públicas de tempo integral.',
    tipo: 'Projeto de lei',
    assuntos: ['Cultura e esporte', 'Educação'],
  },
  {
    titulo: 'Fundo de apoio ao microempreendedor',
    ementa:
      'Institui fundo de garantia de crédito para microempreendedores individuais em situação de vulnerabilidade.',
    tipo: 'Projeto de lei',
    assuntos: ['Economia e trabalho'],
  },
  {
    titulo: 'Saúde mental na rede pública',
    ementa:
      'Amplia a oferta de atendimento psicológico na atenção básica, com prioridade a adolescentes.',
    tipo: 'Projeto de lei',
    assuntos: ['Saúde', 'Direitos humanos'],
  },
  {
    titulo: 'Moradia para famílias atingidas por enchentes',
    ementa:
      'Estabelece prioridade de atendimento habitacional a famílias desabrigadas por enchentes e alagamentos.',
    tipo: 'Projeto de lei',
    assuntos: ['Assistência social', 'Meio ambiente'],
  },
  {
    titulo: 'Transparência nas emendas parlamentares municipais',
    ementa:
      'Determina a divulgação, em formato aberto, da aplicação de recursos de emendas recebidos pelos municípios.',
    tipo: 'Projeto de lei',
    assuntos: ['Economia e trabalho'],
  },
  {
    titulo: 'Proposta de acesso universal à internet nas escolas rurais',
    ementa:
      'Acrescenta dispositivo à Constituição para garantir conectividade às escolas da zona rural.',
    tipo: 'Proposta de emenda à Constituição',
    assuntos: ['Educação'],
  },
  {
    titulo: 'Capacitação de agentes comunitários em primeiros socorros',
    ementa:
      'Obriga a capacitação periódica de agentes comunitários de saúde em primeiros socorros e suporte básico de vida.',
    tipo: 'Projeto de lei',
    assuntos: ['Saúde'],
  },
  {
    titulo: 'Calçadas acessíveis em áreas de grande circulação',
    ementa:
      'Exige adequação de calçadas à acessibilidade em entornos de hospitais, escolas e terminais de transporte.',
    tipo: 'Projeto de lei',
    assuntos: ['Mobilidade e transporte', 'Direitos humanos'],
  },
  {
    titulo: 'Programa de proteção à pessoa idosa',
    ementa: 'Cria canal único de denúncia e acompanhamento de violações contra a pessoa idosa.',
    tipo: 'Projeto de lei',
    assuntos: ['Direitos humanos', 'Assistência social'],
  },
  {
    titulo: 'Requerimento de audiência pública sobre segurança no trânsito',
    ementa:
      'Requer a realização de audiência pública para debater a segurança no trânsito em rodovias federais de Goiás.',
    tipo: 'Requerimento',
    assuntos: ['Segurança pública', 'Mobilidade e transporte'],
  },
  {
    titulo: 'Decreto legislativo sobre acordo de cooperação em saúde',
    ementa:
      'Aprova o texto do acordo de cooperação técnica em saúde entre os países da América do Sul.',
    tipo: 'Projeto de decreto legislativo',
    assuntos: ['Saúde'],
  },
  {
    titulo: 'Incentivo à energia solar em escolas públicas',
    ementa:
      'Institui programa de instalação de energia solar em escolas públicas, com economia revertida à educação.',
    tipo: 'Projeto de lei',
    assuntos: ['Meio ambiente', 'Educação'],
  },
  {
    titulo: 'Combate à violência contra profissionais de saúde',
    ementa: 'Agrava a pena de agressões a profissionais de saúde no exercício da função.',
    tipo: 'Projeto de lei',
    assuntos: ['Saúde', 'Segurança pública'],
  },
];

export const comissoesDeExemplo = [
  'Comissão de Constituição e Justiça e de Cidadania',
  'Comissão de Saúde',
  'Comissão de Educação',
  'Comissão de Defesa dos Direitos da Mulher',
  'Comissão de Segurança Pública e Combate ao Crime Organizado',
  'Comissão de Meio Ambiente e Desenvolvimento Sustentável',
  'Comissão de Desenvolvimento Urbano',
  'Comissão de Finanças e Tributação',
];

export const pareceresDeExemplo = [
  'Parecer favorável do relator.',
  'Parecer favorável, com substitutivo.',
  'Parecer favorável, com duas emendas.',
  'Aguardando a designação do relator.',
  'Parecer pela aprovação, com ressalvas quanto à técnica legislativa.',
];
