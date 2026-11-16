-- Mais de um responsável por demanda e por tarefa: o responsável principal continua em
-- demanda.responsavel_id e tarefa.responsavel_id; estes são os demais, que também acompanham o registro.
-- ---------------------------------------------------------------------------

CREATE TABLE demanda_responsavel (
    demanda_id bigint NOT NULL REFERENCES demanda (id),
    usuario_id bigint NOT NULL REFERENCES usuario (id),
    adicionado_em timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (demanda_id, usuario_id)
);
CREATE INDEX demanda_responsavel_usuario_idx ON demanda_responsavel (usuario_id);

CREATE TABLE tarefa_responsavel (
    tarefa_id bigint NOT NULL REFERENCES tarefa (id),
    usuario_id bigint NOT NULL REFERENCES usuario (id),
    adicionado_em timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (tarefa_id, usuario_id)
);
CREATE INDEX tarefa_responsavel_usuario_idx ON tarefa_responsavel (usuario_id);

-- Quem entra como responsável de uma demanda também recebe um aviso.
ALTER TABLE aviso DROP CONSTRAINT aviso_natureza_valida;
ALTER TABLE aviso ADD CONSTRAINT aviso_natureza_valida CHECK (natureza IN (
    'tarefa_designada', 'tarefa_reatribuida', 'compromisso_indicacao', 'compromisso_remarcado',
    'compromisso_cancelado', 'prazo_proximo', 'prazo_vencido', 'despesa_aguardando_analise',
    'saldo_abaixo_limite', 'mencao', 'demanda_designada'
));

GRANT SELECT, INSERT, DELETE ON demanda_responsavel TO app_api;
GRANT SELECT, INSERT, DELETE ON tarefa_responsavel TO app_api;
