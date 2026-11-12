-- 0005: fluxos de trabalho (tipos de processo, etapas), movimentação e vínculo (bloco 1.G).
-- O status de todo registro acompanhado é DERIVADO do papel da etapa: nunca há coluna de status.

CREATE TABLE tipo_processo (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tipo text NOT NULL UNIQUE,
    nome text NOT NULL,
    CONSTRAINT tipo_processo_tipo_valido CHECK (tipo IN (
        'demanda', 'tarefa', 'projeto_lei', 'emenda', 'despesa_ceap'
    ))
);

CREATE TABLE etapa (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tipo_processo_id bigint NOT NULL REFERENCES tipo_processo (id),
    nome_interno text NOT NULL,
    ordem integer NOT NULL,
    papel text NOT NULL,
    rotulo_publico text,
    visivel_publico boolean NOT NULL DEFAULT false,
    prazo_padrao_dias integer,
    situacao text NOT NULL DEFAULT 'ativa',
    criado_em timestamptz NOT NULL DEFAULT now(),
    atualizado_em timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT etapa_nome_preenchido CHECK (length(btrim(nome_interno)) > 0),
    CONSTRAINT etapa_papel_valido CHECK (papel IN ('entrada', 'intermediaria', 'conclusao', 'arquivamento')),
    CONSTRAINT etapa_situacao_valida CHECK (situacao IN ('ativa', 'inativa')),
    CONSTRAINT etapa_prazo_positivo CHECK (prazo_padrao_dias IS NULL OR prazo_padrao_dias > 0)
);

-- O nome interno é único entre as etapas ativas do tipo (sem diferenciar maiúsculas).
CREATE UNIQUE INDEX etapa_nome_unico_ativas ON etapa (tipo_processo_id, lower(nome_interno))
    WHERE situacao = 'ativa';

CREATE TRIGGER etapa_atualizado_em BEFORE UPDATE ON etapa
    FOR EACH ROW EXECUTE FUNCTION definir_atualizado_em();

CREATE TABLE vinculo (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    origem_tipo text NOT NULL,
    origem_id bigint NOT NULL,
    destino_tipo text NOT NULL,
    destino_id bigint NOT NULL,
    criado_por bigint NOT NULL REFERENCES usuario (id),
    criado_em timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT vinculo_origem_valida CHECK (origem_tipo IN (
        'tarefa', 'compromisso', 'documento', 'comentario', 'aviso'
    )),
    CONSTRAINT vinculo_destino_valido CHECK (destino_tipo IN (
        'demanda', 'projeto_lei', 'emenda', 'destinacao', 'despesa',
        'tarefa', 'compromisso', 'evento', 'pessoa'
    )),
    -- Cada origem aponta para UM registro.
    CONSTRAINT vinculo_origem_unica UNIQUE (origem_tipo, origem_id)
);

CREATE INDEX vinculo_destino_idx ON vinculo (destino_tipo, destino_id);

CREATE TABLE movimentacao (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    registro_tipo text NOT NULL,
    registro_id bigint NOT NULL,
    tipo_processo_id bigint NOT NULL REFERENCES tipo_processo (id),
    etapa_origem_id bigint REFERENCES etapa (id),
    etapa_destino_id bigint NOT NULL REFERENCES etapa (id),
    autor_id bigint NOT NULL REFERENCES usuario (id),
    observacao text,
    criada_em timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT movimentacao_registro_valido CHECK (registro_tipo IN (
        'demanda', 'tarefa', 'projeto_lei', 'emenda', 'destinacao', 'despesa'
    ))
);

CREATE INDEX movimentacao_registro_idx ON movimentacao (registro_tipo, registro_id, id);
CREATE INDEX movimentacao_etapa_destino_idx ON movimentacao (etapa_destino_id);

-- ---------------------------------------------------------------------------
-- Regras estruturais do fluxo (RN-FLU-01 a RN-FLU-03)
-- ---------------------------------------------------------------------------

-- Cada tipo tem exatamente uma Entrada ativa, exatamente uma de Arquivamento ativa e ao menos
-- uma de Conclusão ativa. Verificado no commit: uma transação pode reorganizar o fluxo.
CREATE FUNCTION exigir_estrutura_do_fluxo() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    tipo_id bigint := COALESCE(NEW.tipo_processo_id, OLD.tipo_processo_id);
BEGIN
    IF (SELECT count(*) FROM etapa WHERE tipo_processo_id = tipo_id AND papel = 'entrada') <> 1
       OR (SELECT count(*) FROM etapa
           WHERE tipo_processo_id = tipo_id AND papel = 'entrada' AND situacao = 'ativa') <> 1 THEN
        RAISE EXCEPTION 'Cada tipo de processo deve ter exatamente uma etapa de Entrada, e ela deve estar ativa'
            USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    IF (SELECT count(*) FROM etapa WHERE tipo_processo_id = tipo_id AND papel = 'arquivamento') <> 1
       OR (SELECT count(*) FROM etapa
           WHERE tipo_processo_id = tipo_id AND papel = 'arquivamento' AND situacao = 'ativa') <> 1 THEN
        RAISE EXCEPTION 'Cada tipo de processo deve ter exatamente uma etapa de Arquivamento, e ela deve estar ativa'
            USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM etapa
        WHERE tipo_processo_id = tipo_id AND papel = 'conclusao' AND situacao = 'ativa'
    ) THEN
        RAISE EXCEPTION 'Cada tipo de processo deve ter ao menos uma etapa de Conclusão ativa'
            USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER etapa_estrutura_do_fluxo
    AFTER INSERT OR UPDATE OR DELETE ON etapa
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION exigir_estrutura_do_fluxo();

-- Rótulo e visibilidade públicos existem só no fluxo de Demanda; o papel nunca muda; etapa
-- já usada em movimentação não é desativada; Entrada e Arquivamento não se desativam.
CREATE FUNCTION validar_alteracao_de_etapa() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    tipo_do_fluxo text;
BEGIN
    SELECT tipo INTO tipo_do_fluxo FROM tipo_processo WHERE id = NEW.tipo_processo_id;

    IF tipo_do_fluxo <> 'demanda' AND (NEW.rotulo_publico IS NOT NULL OR NEW.visivel_publico) THEN
        RAISE EXCEPTION 'Rótulo e visibilidade públicos só existem no fluxo de Demanda'
            USING ERRCODE = 'check_violation';
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF NEW.tipo_processo_id <> OLD.tipo_processo_id THEN
            RAISE EXCEPTION 'Uma etapa não muda de tipo de processo' USING ERRCODE = 'check_violation';
        END IF;
        IF NEW.papel <> OLD.papel THEN
            RAISE EXCEPTION 'O papel de uma etapa não pode ser alterado' USING ERRCODE = 'check_violation';
        END IF;
        IF OLD.situacao = 'ativa' AND NEW.situacao = 'inativa' THEN
            IF OLD.papel IN ('entrada', 'arquivamento') THEN
                RAISE EXCEPTION 'As etapas de Entrada e de Arquivamento não podem ser desativadas'
                    USING ERRCODE = 'check_violation';
            END IF;
            IF EXISTS (SELECT 1 FROM movimentacao WHERE etapa_destino_id = OLD.id) THEN
                RAISE EXCEPTION 'Etapa com registros não pode ser desativada'
                    USING ERRCODE = 'check_violation';
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER etapa_validar_alteracao BEFORE INSERT OR UPDATE ON etapa
    FOR EACH ROW EXECUTE FUNCTION validar_alteracao_de_etapa();

-- ---------------------------------------------------------------------------
-- Movimentação: acrescenta apenas, e só para etapa do tipo certo e ativa.
-- ---------------------------------------------------------------------------

CREATE FUNCTION validar_movimentacao() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    tipo_esperado text;
    tipo_do_fluxo text;
    destino etapa%ROWTYPE;
    origem etapa%ROWTYPE;
BEGIN
    tipo_esperado := CASE NEW.registro_tipo
        WHEN 'emenda' THEN 'emenda'
        WHEN 'destinacao' THEN 'emenda'
        WHEN 'despesa' THEN 'despesa_ceap'
        ELSE NEW.registro_tipo
    END;
    SELECT tipo INTO tipo_do_fluxo FROM tipo_processo WHERE id = NEW.tipo_processo_id;
    IF tipo_do_fluxo IS DISTINCT FROM tipo_esperado THEN
        RAISE EXCEPTION 'O registro do tipo % usa o fluxo %, não %', NEW.registro_tipo, tipo_esperado, tipo_do_fluxo
            USING ERRCODE = 'check_violation';
    END IF;

    SELECT * INTO destino FROM etapa WHERE id = NEW.etapa_destino_id;
    IF destino.tipo_processo_id <> NEW.tipo_processo_id THEN
        RAISE EXCEPTION 'A etapa de destino não pertence ao fluxo do registro' USING ERRCODE = 'check_violation';
    END IF;
    IF destino.situacao <> 'ativa' THEN
        RAISE EXCEPTION 'A etapa de destino está inativa' USING ERRCODE = 'check_violation';
    END IF;

    IF NEW.etapa_origem_id IS NOT NULL THEN
        SELECT * INTO origem FROM etapa WHERE id = NEW.etapa_origem_id;
        IF origem.tipo_processo_id <> NEW.tipo_processo_id THEN
            RAISE EXCEPTION 'A etapa de origem não pertence ao fluxo do registro' USING ERRCODE = 'check_violation';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER movimentacao_validar BEFORE INSERT ON movimentacao
    FOR EACH ROW EXECUTE FUNCTION validar_movimentacao();

CREATE FUNCTION movimentacao_recusar_alteracao() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'A movimentação é imutável (% recusado)', TG_OP
        USING ERRCODE = 'integrity_constraint_violation';
END;
$$;

CREATE TRIGGER movimentacao_imutavel_linha BEFORE UPDATE OR DELETE ON movimentacao
    FOR EACH ROW EXECUTE FUNCTION movimentacao_recusar_alteracao();

CREATE TRIGGER movimentacao_imutavel_truncate BEFORE TRUNCATE ON movimentacao
    FOR EACH STATEMENT EXECUTE FUNCTION movimentacao_recusar_alteracao();

-- ---------------------------------------------------------------------------
-- Permissões
-- ---------------------------------------------------------------------------

GRANT SELECT ON tipo_processo TO app_api;
GRANT SELECT, INSERT, UPDATE ON etapa TO app_api;
GRANT SELECT, INSERT ON movimentacao TO app_api;
GRANT SELECT, INSERT, DELETE ON vinculo TO app_api;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO app_api;
