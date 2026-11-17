-- 0016: CEAP (fase 6, bloco D): parâmetros com vigência, categorias de despesa, encerramento de competência e
-- despesa. Nada da norma fica fixo no código: o que a Câmara pode mudar é dado, com vigência. O saldo e a cota
-- aplicada NÃO são colunas: são derivados (a cota vem do parâmetro que valia no mês; o saldo, da conta sobre as despesas).
-- Nenhum valor em reais é semeado: a cota e os tetos são cadastrados pelo Administrador, conferidos na norma vigente.

-- ---------------------------------------------------------------------------
-- Parâmetros com vigência. Alterar um fecha a vigência anterior e abre a nova (feito pelo serviço, na mesma
-- transação). O banco impede duas vigências da mesma chave se sobreporem.
-- ---------------------------------------------------------------------------

CREATE TABLE ceap_parametro (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    chave text NOT NULL,
    valor numeric(14, 2) NOT NULL,
    vigente_de date NOT NULL,
    vigente_ate date,
    definido_por bigint NOT NULL REFERENCES usuario (id),
    definido_em timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ceap_parametro_chave_valida CHECK (chave IN (
        'cota_mensal', 'prazo_apresentacao_dias', 'guarda_originais_anos', 'limite_alerta_saldo'
    )),
    CONSTRAINT ceap_parametro_valor_nao_negativo CHECK (valor >= 0),
    CONSTRAINT ceap_parametro_vigencia_valida CHECK (vigente_ate IS NULL OR vigente_ate >= vigente_de)
);
CREATE INDEX ceap_parametro_chave_idx ON ceap_parametro (chave, vigente_de);

CREATE FUNCTION ceap_parametro_sem_sobreposicao() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM ceap_parametro p
        WHERE p.chave = NEW.chave AND p.id <> NEW.id
          AND daterange(p.vigente_de, p.vigente_ate, '[]') && daterange(NEW.vigente_de, NEW.vigente_ate, '[]')
    ) THEN
        RAISE EXCEPTION 'A vigência se sobrepõe a outra do mesmo parâmetro'
            USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER ceap_parametro_sem_sobreposicao AFTER INSERT OR UPDATE ON ceap_parametro
    FOR EACH ROW EXECUTE FUNCTION ceap_parametro_sem_sobreposicao();

-- O valor e a data de início de um parâmetro não mudam (a história se preserva): só se encerra a vigência.
CREATE FUNCTION ceap_parametro_so_encerra() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.chave <> OLD.chave OR NEW.valor <> OLD.valor OR NEW.vigente_de <> OLD.vigente_de
       OR NEW.definido_por <> OLD.definido_por OR NEW.definido_em <> OLD.definido_em THEN
        RAISE EXCEPTION 'Um parâmetro da CEAP não se altera: abre-se outro com nova vigência'
            USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER ceap_parametro_so_encerra BEFORE UPDATE ON ceap_parametro
    FOR EACH ROW EXECUTE FUNCTION ceap_parametro_so_encerra();
CREATE FUNCTION ceap_parametro_nao_apaga() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'Um parâmetro da CEAP não se apaga' USING ERRCODE = 'integrity_constraint_violation';
END;
$$;
CREATE TRIGGER ceap_parametro_nao_apaga BEFORE DELETE ON ceap_parametro
    FOR EACH ROW EXECUTE FUNCTION ceap_parametro_nao_apaga();

-- ---------------------------------------------------------------------------
-- Categorias de despesa. A lista inicial é a PROPOSTA de docs/especificacao/08-ceap.md (item 8.5), sem tetos.
-- O Administrador ajusta nomes, tetos e comprovante conforme a norma vigente.
-- ---------------------------------------------------------------------------

CREATE TABLE ceap_categoria (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nome text NOT NULL,
    item_norma text,
    teto_mensal numeric(14, 2),
    comprovante_obrigatorio boolean NOT NULL DEFAULT true,
    situacao text NOT NULL DEFAULT 'ativa',
    criado_em timestamptz NOT NULL DEFAULT now(),
    atualizado_em timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ceap_categoria_nome_preenchido CHECK (length(btrim(nome)) > 0),
    CONSTRAINT ceap_categoria_teto_positivo CHECK (teto_mensal IS NULL OR teto_mensal > 0),
    CONSTRAINT ceap_categoria_situacao_valida CHECK (situacao IN ('ativa', 'inativa'))
);
CREATE UNIQUE INDEX ceap_categoria_nome_unico ON ceap_categoria (lower(nome));

CREATE TRIGGER ceap_categoria_atualizado_em BEFORE UPDATE ON ceap_categoria
    FOR EACH ROW EXECUTE FUNCTION definir_atualizado_em();

-- A última categoria ativa não se desativa.
CREATE FUNCTION ceap_categoria_ultima_ativa() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.situacao = 'inativa' AND OLD.situacao = 'ativa'
       AND NOT EXISTS (SELECT 1 FROM ceap_categoria WHERE situacao = 'ativa' AND id <> NEW.id) THEN
        RAISE EXCEPTION 'A última categoria ativa não se desativa' USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER ceap_categoria_ultima_ativa BEFORE UPDATE ON ceap_categoria
    FOR EACH ROW EXECUTE FUNCTION ceap_categoria_ultima_ativa();

INSERT INTO ceap_categoria (nome, item_norma) VALUES
    ('Passagens aéreas', 'Proposta: a conferir na norma vigente'),
    ('Telefonia', NULL),
    ('Escritório de apoio', NULL),
    ('Assinaturas de publicações', NULL),
    ('Alimentação do parlamentar', NULL),
    ('Hospedagem', NULL),
    ('Locomoção', NULL),
    ('Combustíveis', NULL),
    ('Segurança privada', NULL),
    ('Divulgação da atividade parlamentar', NULL),
    ('Cursos, palestras e congressos', NULL),
    ('Auxílio-moradia (complemento)', NULL),
    ('Certificados e tokens digitais', NULL),
    ('Serviços postais', NULL),
    ('Outros', NULL);

-- ---------------------------------------------------------------------------
-- Encerramento de competência (mês): depois de encerrada, não recebe despesa nova nem muda.
-- ---------------------------------------------------------------------------

CREATE TABLE ceap_encerramento (
    ano integer NOT NULL,
    mes integer NOT NULL,
    encerrada_por bigint NOT NULL REFERENCES usuario (id),
    encerrada_em timestamptz NOT NULL DEFAULT now(),
    reaberta_por bigint REFERENCES usuario (id),
    reaberta_em timestamptz,
    PRIMARY KEY (ano, mes),
    CONSTRAINT ceap_encerramento_mes_valido CHECK (mes BETWEEN 1 AND 12 AND ano BETWEEN 2000 AND 2100),
    CONSTRAINT ceap_encerramento_reabertura_coerente CHECK ((reaberta_por IS NULL) = (reaberta_em IS NULL))
);

-- ---------------------------------------------------------------------------
-- Despesa. Percorre o fluxo despesa_ceap pelo mecanismo único de movimentação. A competência é o mês da
-- data do documento (RN-CEAP-07). Quem decide a própria despesa só pode ser Chefe, Administrador ou Parlamentar,
-- e a coincidência fica marcada (RN-CEAP-10 a 12), no banco também.
-- ---------------------------------------------------------------------------

CREATE TABLE despesa (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    categoria_id bigint NOT NULL REFERENCES ceap_categoria (id),
    responsavel_id bigint NOT NULL REFERENCES usuario (id),
    lancado_por bigint NOT NULL REFERENCES usuario (id),
    descricao text NOT NULL,
    valor numeric(14, 2) NOT NULL,
    data_documento date NOT NULL,
    competencia_ano integer GENERATED ALWAYS AS (extract(year FROM data_documento)::integer) STORED,
    competencia_mes integer GENERATED ALWAYS AS (extract(month FROM data_documento)::integer) STORED,
    fornecedor_nome text NOT NULL,
    fornecedor_documento text NOT NULL,
    numero_documento text NOT NULL,
    etapa_atual_id bigint NOT NULL REFERENCES etapa (id),
    decidido_por bigint REFERENCES usuario (id),
    decidida_em timestamptz,
    decisao_pelo_proprio_lancador boolean NOT NULL DEFAULT false,
    motivo_reprovacao text,
    cancelada_em timestamptz,
    cancelada_por bigint REFERENCES usuario (id),
    justificativa_cancelamento text,
    criado_em timestamptz NOT NULL DEFAULT now(),
    atualizado_em timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT despesa_descricao_preenchida CHECK (length(btrim(descricao)) > 0),
    CONSTRAINT despesa_valor_positivo CHECK (valor > 0),
    CONSTRAINT despesa_fornecedor_preenchido CHECK (
        length(btrim(fornecedor_nome)) > 0 AND length(btrim(numero_documento)) > 0
    ),
    -- CPF (11) ou CNPJ numérico ou alfanumérico (14), só os caracteres.
    CONSTRAINT despesa_fornecedor_documento_valido CHECK (
        fornecedor_documento ~ '^[0-9]{11}$' OR fornecedor_documento ~ '^[0-9A-Z]{12}[0-9]{2}$'
    ),
    CONSTRAINT despesa_decisao_coerente CHECK ((decidido_por IS NULL) = (decidida_em IS NULL)),
    CONSTRAINT despesa_cancelamento_coerente CHECK (
        (cancelada_em IS NULL) = (cancelada_por IS NULL)
        AND (cancelada_em IS NULL) = (justificativa_cancelamento IS NULL)
    ),
    CONSTRAINT despesa_justificativa_minima CHECK (
        justificativa_cancelamento IS NULL OR length(btrim(justificativa_cancelamento)) >= 10
    ),
    CONSTRAINT despesa_motivo_minimo CHECK (
        motivo_reprovacao IS NULL OR length(btrim(motivo_reprovacao)) >= 10
    ),
    -- Segregação de função (RN-CEAP-10 a 12): quem decide a própria despesa precisa ter marcado a coincidência.
    CONSTRAINT despesa_segregacao CHECK (
        decidido_por IS NULL OR decidido_por <> lancado_por OR decisao_pelo_proprio_lancador = true
    ),
    CONSTRAINT despesa_marca_so_com_coincidencia CHECK (
        decisao_pelo_proprio_lancador = false OR decidido_por = lancado_por
    )
);
CREATE INDEX despesa_competencia_idx ON despesa (competencia_ano, competencia_mes);
CREATE INDEX despesa_categoria_idx ON despesa (categoria_id, competencia_ano, competencia_mes);
CREATE INDEX despesa_etapa_idx ON despesa (etapa_atual_id);
CREATE INDEX despesa_responsavel_idx ON despesa (responsavel_id);

CREATE TRIGGER despesa_atualizado_em BEFORE UPDATE ON despesa
    FOR EACH ROW EXECUTE FUNCTION definir_atualizado_em();

-- A exceção da segregação só vale para Chefe, Administrador e Parlamentar (no momento da decisão), e a despesa
-- decidida ou cancelada não se altera, exceto pelo acompanhamento posterior (etapa).
CREATE FUNCTION despesa_protegida() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    perfil_do_decisor text;
BEGIN
    IF OLD.cancelada_em IS NOT NULL THEN
        RAISE EXCEPTION 'Despesa cancelada não se altera' USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    IF NEW.lancado_por <> OLD.lancado_por OR NEW.criado_em <> OLD.criado_em THEN
        RAISE EXCEPTION 'Quem lançou e quando não mudam' USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    IF OLD.decidido_por IS NOT NULL AND (
        NEW.decidido_por IS DISTINCT FROM OLD.decidido_por OR NEW.decidida_em IS DISTINCT FROM OLD.decidida_em
        OR NEW.decisao_pelo_proprio_lancador <> OLD.decisao_pelo_proprio_lancador
        OR NEW.motivo_reprovacao IS DISTINCT FROM OLD.motivo_reprovacao
        OR NEW.valor <> OLD.valor OR NEW.categoria_id <> OLD.categoria_id
        OR NEW.data_documento <> OLD.data_documento OR NEW.descricao <> OLD.descricao
        OR NEW.fornecedor_nome <> OLD.fornecedor_nome OR NEW.fornecedor_documento <> OLD.fornecedor_documento
        OR NEW.numero_documento <> OLD.numero_documento
    ) THEN
        RAISE EXCEPTION 'Despesa decidida não se edita' USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    IF NEW.decisao_pelo_proprio_lancador = true AND OLD.decisao_pelo_proprio_lancador = false THEN
        SELECT perfil INTO perfil_do_decisor FROM usuario WHERE id = NEW.decidido_por;
        IF perfil_do_decisor NOT IN ('chefe', 'administrador', 'parlamentar') THEN
            RAISE EXCEPTION 'Só Chefe, Administrador ou Parlamentar decidem a própria despesa'
                USING ERRCODE = 'integrity_constraint_violation';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER despesa_protegida BEFORE UPDATE ON despesa
    FOR EACH ROW EXECUTE FUNCTION despesa_protegida();

GRANT SELECT, INSERT ON ceap_parametro TO app_api;
GRANT UPDATE (vigente_ate) ON ceap_parametro TO app_api;
GRANT SELECT, INSERT, UPDATE ON ceap_categoria TO app_api;
GRANT SELECT, INSERT, UPDATE ON ceap_encerramento TO app_api;
GRANT SELECT, INSERT, UPDATE ON despesa TO app_api;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO app_api;
