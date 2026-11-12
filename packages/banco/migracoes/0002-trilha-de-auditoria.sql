-- 0002: trilha de auditoria imutável (RN-AUD-02, RN-AUD-04).

CREATE TABLE trilha (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ocorrida_em timestamptz NOT NULL DEFAULT now(),
    autor_id bigint REFERENCES usuario (id),
    origem text NOT NULL,
    operacao text NOT NULL,
    entidade text NOT NULL,
    registro_id text,
    valor_anterior jsonb,
    valor_novo jsonb,
    justificativa text,
    CONSTRAINT trilha_origem_valida CHECK (origem IN ('usuario', 'publico', 'comando')),
    CONSTRAINT trilha_operacao_preenchida CHECK (length(btrim(operacao)) > 0),
    CONSTRAINT trilha_entidade_preenchida CHECK (length(btrim(entidade)) > 0),
    -- A trilha nunca contém senha nem segredo (RN-AUD-04).
    CONSTRAINT trilha_sem_segredo_anterior CHECK (
        valor_anterior IS NULL
        OR jsonb_typeof(valor_anterior) <> 'object'
        OR NOT (valor_anterior ?| ARRAY['senha', 'verificador_senha', 'segredo', 'segredo_link', 'ticket', 'ticket_hash'])
    ),
    CONSTRAINT trilha_sem_segredo_novo CHECK (
        valor_novo IS NULL
        OR jsonb_typeof(valor_novo) <> 'object'
        OR NOT (valor_novo ?| ARRAY['senha', 'verificador_senha', 'segredo', 'segredo_link', 'ticket', 'ticket_hash'])
    )
);

CREATE INDEX trilha_ocorrida_em_idx ON trilha (ocorrida_em DESC);
CREATE INDEX trilha_entidade_registro_idx ON trilha (entidade, registro_id);
CREATE INDEX trilha_autor_idx ON trilha (autor_id);

CREATE FUNCTION trilha_recusar_alteracao() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'A trilha de auditoria é imutável (% recusado)', TG_OP
        USING ERRCODE = 'integrity_constraint_violation';
END;
$$;

CREATE TRIGGER trilha_imutavel_linha BEFORE UPDATE OR DELETE ON trilha
    FOR EACH ROW EXECUTE FUNCTION trilha_recusar_alteracao();

CREATE TRIGGER trilha_imutavel_truncate BEFORE TRUNCATE ON trilha
    FOR EACH STATEMENT EXECUTE FUNCTION trilha_recusar_alteracao();
