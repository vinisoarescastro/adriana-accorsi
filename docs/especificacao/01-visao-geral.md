# 01. Visão geral

Estado: rascunho da fase 0, para aprovação. Derivado da especificação do Mandatus (ver `docs/referencia/`), adaptado a um único gabinete.

## 1.1 Finalidade

Substituir planilhas, mensagens e memória por um sistema único onde o gabinete da Deputada Federal Adriana Accorsi:

- atende cidadãos e acompanha cada solicitação até o desfecho;
- distribui e acompanha tarefas da equipe;
- controla a agenda da parlamentar, com níveis de privacidade;
- acompanha projetos de lei;
- administra emendas parlamentares;
- controla e presta contas da CEAP (Cota para o Exercício da Atividade Parlamentar);
- mantém trilha de auditoria de tudo.

## 1.2 Público

| Quem | Como usa |
| --- | --- |
| A Deputada (Parlamentar) | Perfil próprio: vê tudo, opera e acompanha; tem acesso total à CEAP; não administra o sistema. Usa o próprio login |
| Equipe do gabinete | Área interna autenticada, em cinco perfis (ver 03) |
| Cidadão atendido | Página pública de acompanhamento, sem conta, somente leitura; recebe e-mail de andamento se consentir |
| Administrador | Administra o próprio sistema: equipe, configurações e parâmetros. Não há operador externo de plataforma |

## 1.3 Problemas que resolve

1. O cidadão deixa de ligar para saber o andamento: recebe um link, consulta pelo protocolo e é avisado por e-mail.
2. O trabalho da equipe fica distribuído e visível: tarefas com responsável e prazo, agenda, avisos.
3. Dinheiro público tem saldo derivado, nunca editado, e toda decisão sobre despesa guarda quem lançou e quem decidiu.
4. Cada ato fica registrado em trilha imutável, na mesma transação da operação.

## 1.4 Diferenças em relação ao Mandatus

| Mandatus | Este sistema |
| --- | --- |
| Multi-inquilino: vários gabinetes isolados por política de linha | Um único gabinete. Sem `gabinete_id`, sem política de linha |
| Operador da plataforma cadastra e administra gabinetes | Sem camada de plataforma. O Administrador do gabinete administra tudo |
| Acesso de suporte com justificativa e prazo | Removido. Acesso operacional à VPS é assunto de infraestrutura |
| Esfera escolhida por gabinete (municipal, estadual, federal) | Esfera fixa: **federal** |
| Módulos contratáveis | Todos os módulos ativos; habilitações por usuário continuam |
| Verba indenizatória genérica | **CEAP**, com parâmetros configuráveis e vigência |
| Segregação "quem lança não aprova" revogada | Mantida, com exceção de Chefe de Gabinete e Administrador, com coincidência registrada |
| Sem notificação ao cidadão | E-mail de andamento, com consentimento (LGPD) |
| Expiração do link público gravada e não aplicada | Aplicada de verdade |
| Código C# .NET | TypeScript: React, Fastify, PostgreSQL |

## 1.5 Fora do escopo

- Verba de gabinete (pessoal, secretários parlamentares): possível fase 9.
- WhatsApp e SMS: possível fase 9; só e-mail inicialmente.
- Substituir o sistema oficial da Câmara (CotasNet) na apresentação da CEAP: o sistema é controle interno e preparação do pacote.
- Integração com dados abertos da Câmara: a avaliar na fase 5.
- Assinatura externa de agenda.
- Segundo fator de autenticação: fase 8.

## 1.6 Princípios

1. Autorização em um único lugar (o decisor).
2. Auditoria na mesma transação; trilha imutável.
3. Status derivado do papel da etapa; saldo derivado das movimentações.
4. Mecanismo único de movimentação para todos os processos acompanhados.
5. Nada é público por padrão; o cidadão vê uma projeção explícita.
6. Nenhuma automação decide; o processo de fundo só gera avisos e envios.
7. Dinheiro exato: `numeric` no banco, texto na API, nunca negativo.
8. Nada se apaga em operação comum: cancela-se, inativa-se ou arquiva-se.
