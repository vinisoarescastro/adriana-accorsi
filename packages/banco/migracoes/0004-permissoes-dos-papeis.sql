-- 0004: permissões mínimas dos papéis de aplicação.
-- Os papéis são criados antes das migrações (comando `papeis`). Esta migração só concede.
-- Quem concede é o dono do esquema (app_migracao). Nenhum papel de aplicação é dono de tabela.

GRANT USAGE ON SCHEMA public TO app_api, app_worker, app_publico;

-- API: acesso e equipe.
GRANT SELECT, INSERT, UPDATE ON conta_acesso TO app_api;
GRANT SELECT, INSERT, UPDATE ON usuario TO app_api;
GRANT SELECT, INSERT, DELETE ON habilitacao TO app_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON sessao TO app_api;
GRANT SELECT, INSERT, UPDATE ON senha_inicial TO app_api;
GRANT SELECT, INSERT, UPDATE ON gabinete TO app_api;
GRANT SELECT, INSERT, UPDATE ON parametro TO app_api;

-- Trilha: só ler e acrescentar. Nunca UPDATE, DELETE ou TRUNCATE (os gatilhos repetem a regra).
GRANT SELECT, INSERT ON trilha TO app_api;

GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO app_api;

-- app_worker e app_publico não recebem nenhuma concessão de tabela neste bloco.
-- O worker ganha INSERT em aviso e UPDATE de estado em envio_notificacao nas fases 3 e 4.
-- O app público ganha SELECT na visão pública na fase 3.
