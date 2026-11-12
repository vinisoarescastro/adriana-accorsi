-- 0006: conjuntos federais de etapas (docs/especificacao/09-fluxos-de-trabalho.md).
-- PROPOSTA a validar com o gabinete (PV-A). O gabinete ajusta depois pela tela de fluxos.
-- Papéis: entrada, intermediaria, conclusao, arquivamento.

INSERT INTO tipo_processo (tipo, nome) VALUES
    ('demanda', 'Demanda'),
    ('tarefa', 'Tarefa'),
    ('projeto_lei', 'Projeto de Lei'),
    ('emenda', 'Emenda'),
    ('despesa_ceap', 'Despesa da CEAP');

INSERT INTO etapa (tipo_processo_id, nome_interno, ordem, papel, rotulo_publico, visivel_publico, prazo_padrao_dias)
SELECT t.id, v.nome, v.ordem, v.papel, v.rotulo, v.visivel, v.prazo
FROM tipo_processo t
JOIN (VALUES
    -- Demanda: o único fluxo com rótulo público e visibilidade ao cidadão.
    ('demanda', 'Recebida',              1, 'entrada',       'Recebida',     true,  NULL::int),
    ('demanda', 'Em triagem',            2, 'intermediaria', 'Em análise',   true,  2),
    ('demanda', 'Em andamento',          3, 'intermediaria', 'Em andamento', true,  15),
    ('demanda', 'Aguardando terceiros',  4, 'intermediaria', 'Em andamento', true,  30),
    ('demanda', 'Concluída',             5, 'conclusao',     'Concluída',    true,  NULL),
    ('demanda', 'Sem solução',           6, 'conclusao',     'Concluída',    true,  NULL),
    ('demanda', 'Arquivada',             7, 'arquivamento',  'Encerrada',    true,  NULL),

    -- Tarefa
    ('tarefa', 'A fazer',      1, 'entrada',       NULL::text, false, NULL),
    ('tarefa', 'Em andamento', 2, 'intermediaria', NULL, false, NULL),
    ('tarefa', 'Concluída',    3, 'conclusao',     NULL, false, NULL),
    ('tarefa', 'Encerrada',    4, 'arquivamento',  NULL, false, NULL),

    -- Projeto de lei (Câmara dos Deputados)
    ('projeto_lei', 'Em redação',                          1,  'entrada',       NULL::text, false, NULL),
    ('projeto_lei', 'Protocolado',                         2,  'intermediaria', NULL, false, NULL),
    ('projeto_lei', 'Na comissão de constituição e justiça', 3, 'intermediaria', NULL, false, NULL),
    ('projeto_lei', 'Nas comissões de mérito',             4,  'intermediaria', NULL, false, NULL),
    ('projeto_lei', 'Pronto para pauta',                   5,  'intermediaria', NULL, false, NULL),
    ('projeto_lei', 'Em votação',                          6,  'intermediaria', NULL, false, NULL),
    ('projeto_lei', 'Na casa revisora',                    7,  'intermediaria', NULL, false, NULL),
    ('projeto_lei', 'Aprovado, aguardando sanção',         8,  'intermediaria', NULL, false, NULL),
    ('projeto_lei', 'Sancionado',                          9,  'conclusao',     NULL, false, NULL),
    ('projeto_lei', 'Vetado',                              10, 'conclusao',     NULL, false, NULL),
    ('projeto_lei', 'Rejeitado',                           11, 'conclusao',     NULL, false, NULL),
    ('projeto_lei', 'Arquivado',                           12, 'arquivamento',  NULL, false, NULL),

    -- Emenda parlamentar (federal): separa empenho, liquidação e pagamento.
    ('emenda', 'Disponível',            1, 'entrada',       NULL::text, false, NULL),
    ('emenda', 'Indicada',              2, 'intermediaria', NULL, false, NULL),
    ('emenda', 'Em análise pelo órgão', 3, 'intermediaria', NULL, false, 60),
    ('emenda', 'Empenhada',             4, 'intermediaria', NULL, false, NULL),
    ('emenda', 'Liquidada',             5, 'intermediaria', NULL, false, NULL),
    ('emenda', 'Paga',                  6, 'intermediaria', NULL, false, NULL),
    ('emenda', 'Executada',             7, 'conclusao',     NULL, false, NULL),
    ('emenda', 'Não executada',         8, 'conclusao',     NULL, false, NULL),
    ('emenda', 'Encerrada',             9, 'arquivamento',  NULL, false, NULL),

    -- Despesa da CEAP, com as etapas após a aprovação interna (decidido em 2026-11-12).
    ('despesa_ceap', 'Lançada',               1, 'entrada',       NULL::text, false, NULL),
    ('despesa_ceap', 'Em análise',            2, 'intermediaria', NULL, false, 14),
    ('despesa_ceap', 'Aprovada',              3, 'intermediaria', NULL, false, NULL),
    ('despesa_ceap', 'Apresentada à Câmara',  4, 'intermediaria', NULL, false, NULL),
    ('despesa_ceap', 'Ressarcida',            5, 'conclusao',     NULL, false, NULL),
    ('despesa_ceap', 'Reprovada',             6, 'conclusao',     NULL, false, NULL),
    ('despesa_ceap', 'Glosada pela Câmara',   7, 'conclusao',     NULL, false, NULL),
    ('despesa_ceap', 'Arquivada',             8, 'arquivamento',  NULL, false, NULL)
) AS v (tipo, nome, ordem, papel, rotulo, visivel, prazo) ON v.tipo = t.tipo;
