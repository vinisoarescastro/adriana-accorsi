-- 0015: emendas parlamentares (fase 6, bloco A): emenda, valor ao longo do tempo, destinações a beneficiários
-- e execuções. Só o valor DISPONIBILIZADO é gravado (com histórico); comprometido, utilizado, disponível e
-- "a executar" são derivados na leitura. Não há coluna de saldo.

INSERT INTO categoria (natureza, nome) VALUES
    ('tipo_emenda', 'Individual'),
    ('tipo_emenda', 'De bancada'),
    ('tipo_emenda', 'De comissão');

CREATE TABLE emenda (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    criador_id bigint NOT NULL REFERENCES usuario (id),
    responsavel_id bigint NOT NULL REFERENCES usuario (id),
    identificacao text NOT NULL,
    exercicio integer NOT NULL,
    tipo_id bigint NOT NULL REFERENCES categoria (id),
    finalidade text NOT NULL,
    prazo_destinacao date,
    prazo_empenho date,
    prazo_execucao date,
    etapa_atual_id bigint NOT NULL REFERENCES etapa (id),
    cancelada_em timestamptz,
    cancelada_por bigint REFERENCES usuario (id),
    justificativa_cancelamento text,
    criado_em timestamptz NOT NULL DEFAULT now(),
    atualizado_em timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT emenda_identificacao_preenchida CHECK (length(btrim(identificacao)) > 0),
    CONSTRAINT emenda_finalidade_preenchida CHECK (length(btrim(finalidade)) > 0),
    CONSTRAINT emenda_exercicio_valido CHECK (exercicio BETWEEN 2000 AND 2100),
    CONSTRAINT emenda_cancelamento_coerente CHECK (
        (cancelada_em IS NULL) = (cancelada_por IS NULL)
        AND (cancelada_em IS NULL) = (justificativa_cancelamento IS NULL)
    ),
    CONSTRAINT emenda_justificativa_minima CHECK (
        justificativa_cancelamento IS NULL OR length(btrim(justificativa_cancelamento)) >= 10
    )
);

-- A mesma identificação não se repete no mesmo exercício entre as emendas não canceladas.
CREATE UNIQUE INDEX emenda_identificacao_unica ON emenda (lower(identificacao), exercicio)
    WHERE cancelada_em IS NULL;
CREATE INDEX emenda_responsavel_idx ON emenda (responsavel_id);
CREATE INDEX emenda_etapa_idx ON emenda (etapa_atual_id);
CREATE INDEX emenda_exercicio_idx ON emenda (exercicio, id);

CREATE TRIGGER emenda_atualizado_em BEFORE UPDATE ON emenda
    FOR EACH ROW EXECUTE FUNCTION definir_atualizado_em();

CREATE FUNCTION emenda_protegida() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF OLD.cancelada_em IS NOT NULL THEN
        RAISE EXCEPTION 'Emenda cancelada não se altera' USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    IF NEW.criador_id <> OLD.criador_id OR NEW.criado_em <> OLD.criado_em THEN
        RAISE EXCEPTION 'O criador e a data de criação da emenda não mudam' USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER emenda_protegida BEFORE UPDATE ON emenda
    FOR EACH ROW EXECUTE FUNCTION emenda_protegida();

-- ---------------------------------------------------------------------------
-- O valor disponibilizado ao longo do tempo. Só acrescenta: o atual é o mais recente, e o de uma data
-- passada é o que valia nela (reconstituição).
-- ---------------------------------------------------------------------------

CREATE TABLE emenda_valor (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    emenda_id bigint NOT NULL REFERENCES emenda (id),
    valor numeric(14, 2) NOT NULL,
    definido_por bigint NOT NULL REFERENCES usuario (id),
    definido_em timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT emenda_valor_positivo CHECK (valor > 0)
);
CREATE INDEX emenda_valor_idx ON emenda_valor (emenda_id, definido_em DESC, id DESC);

CREATE FUNCTION emenda_valor_atual(p_emenda bigint) RETURNS numeric
LANGUAGE sql STABLE AS $$
    SELECT valor FROM emenda_valor WHERE emenda_id = p_emenda ORDER BY definido_em DESC, id DESC LIMIT 1
$$;

CREATE FUNCTION emenda_valor_so_acrescenta() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'O histórico do valor da emenda só acrescenta' USING ERRCODE = 'integrity_constraint_violation';
END;
$$;

CREATE TRIGGER emenda_valor_imutavel BEFORE UPDATE OR DELETE ON emenda_valor
    FOR EACH ROW EXECUTE FUNCTION emenda_valor_so_acrescenta();

-- ---------------------------------------------------------------------------
-- Destinação a um beneficiário. O valor não se altera: corrigir é cancelar (com justificativa) e destinar de novo.
-- ---------------------------------------------------------------------------

CREATE TABLE destinacao (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    emenda_id bigint NOT NULL REFERENCES emenda (id),
    beneficiario_id bigint NOT NULL REFERENCES beneficiario (id),
    valor numeric(14, 2) NOT NULL,
    finalidade text NOT NULL,
    etapa_atual_id bigint NOT NULL REFERENCES etapa (id),
    criada_por bigint NOT NULL REFERENCES usuario (id),
    criada_em timestamptz NOT NULL DEFAULT now(),
    cancelada_em timestamptz,
    cancelada_por bigint REFERENCES usuario (id),
    justificativa_cancelamento text,
    CONSTRAINT destinacao_valor_positivo CHECK (valor > 0),
    CONSTRAINT destinacao_finalidade_preenchida CHECK (length(btrim(finalidade)) > 0),
    CONSTRAINT destinacao_cancelamento_coerente CHECK (
        (cancelada_em IS NULL) = (cancelada_por IS NULL)
        AND (cancelada_em IS NULL) = (justificativa_cancelamento IS NULL)
    ),
    CONSTRAINT destinacao_justificativa_minima CHECK (
        justificativa_cancelamento IS NULL OR length(btrim(justificativa_cancelamento)) >= 10
    )
);
CREATE INDEX destinacao_emenda_idx ON destinacao (emenda_id, id);
CREATE INDEX destinacao_beneficiario_idx ON destinacao (beneficiario_id);

CREATE TABLE execucao_destinacao (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    destinacao_id bigint NOT NULL REFERENCES destinacao (id),
    valor numeric(14, 2) NOT NULL,
    data date NOT NULL,
    observacao text,
    registrado_por bigint NOT NULL REFERENCES usuario (id),
    registrado_em timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT execucao_valor_positivo CHECK (valor > 0)
);
CREATE INDEX execucao_destinacao_idx ON execucao_destinacao (destinacao_id, id);

-- ---------------------------------------------------------------------------
-- Invariantes do dinheiro, no banco (a API também confere; aqui ninguém passa por fora).
-- Cada gatilho trava a emenda (ou a destinação) antes de somar, para duas escritas simultâneas não furarem o limite.
-- ---------------------------------------------------------------------------

-- A soma das destinações não canceladas nunca passa do valor disponibilizado.
CREATE FUNCTION emenda_comprometido_cabe() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    alvo bigint;
    comprometido numeric;
BEGIN
    alvo := NEW.emenda_id;
    PERFORM 1 FROM emenda WHERE id = alvo FOR UPDATE;
    SELECT COALESCE(sum(valor), 0) INTO comprometido
        FROM destinacao WHERE emenda_id = alvo AND cancelada_em IS NULL;
    IF comprometido > emenda_valor_atual(alvo) THEN
        RAISE EXCEPTION 'O valor destinado excede o valor disponível da emenda'
            USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    RETURN NULL;
END;
$$;

CREATE TRIGGER destinacao_cabe AFTER INSERT OR UPDATE ON destinacao
    FOR EACH ROW EXECUTE FUNCTION emenda_comprometido_cabe();
CREATE TRIGGER emenda_valor_cabe AFTER INSERT ON emenda_valor
    FOR EACH ROW EXECUTE FUNCTION emenda_comprometido_cabe();

-- A destinação nunca se altera, exceto para ser cancelada; e não se cancela com execução registrada.
CREATE FUNCTION destinacao_protegida() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF OLD.cancelada_em IS NOT NULL THEN
        RAISE EXCEPTION 'Destinação cancelada não se altera' USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    IF NEW.valor <> OLD.valor OR NEW.emenda_id <> OLD.emenda_id OR NEW.beneficiario_id <> OLD.beneficiario_id
       OR NEW.criada_em <> OLD.criada_em OR NEW.criada_por <> OLD.criada_por THEN
        RAISE EXCEPTION 'O valor, a emenda e o beneficiário da destinação não mudam'
            USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    IF NEW.cancelada_em IS NOT NULL AND EXISTS (SELECT 1 FROM execucao_destinacao WHERE destinacao_id = OLD.id) THEN
        RAISE EXCEPTION 'Destinação com execução registrada não se cancela'
            USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER destinacao_protegida BEFORE UPDATE ON destinacao
    FOR EACH ROW EXECUTE FUNCTION destinacao_protegida();

-- A execução não excede a destinação, não tem data futura e só entra em destinação não cancelada. Só acrescenta.
CREATE FUNCTION execucao_cabe() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    d destinacao%ROWTYPE;
    executado numeric;
BEGIN
    SELECT * INTO d FROM destinacao WHERE id = NEW.destinacao_id FOR UPDATE;
    IF d.cancelada_em IS NOT NULL THEN
        RAISE EXCEPTION 'Destinação cancelada não recebe execução' USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    IF NEW.data > (now() AT TIME ZONE 'America/Sao_Paulo')::date THEN
        RAISE EXCEPTION 'A data da execução não pode ser futura' USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    SELECT COALESCE(sum(valor), 0) INTO executado FROM execucao_destinacao WHERE destinacao_id = NEW.destinacao_id;
    IF executado + NEW.valor > d.valor THEN
        RAISE EXCEPTION 'A execução excede o valor da destinação' USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER execucao_cabe BEFORE INSERT ON execucao_destinacao
    FOR EACH ROW EXECUTE FUNCTION execucao_cabe();
CREATE TRIGGER execucao_imutavel BEFORE UPDATE OR DELETE ON execucao_destinacao
    FOR EACH ROW EXECUTE FUNCTION emenda_valor_so_acrescenta();

GRANT SELECT, INSERT, UPDATE ON emenda TO app_api;
GRANT SELECT, INSERT ON emenda_valor TO app_api;
GRANT SELECT, INSERT, UPDATE ON destinacao TO app_api;
GRANT SELECT, INSERT ON execucao_destinacao TO app_api;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO app_api;
