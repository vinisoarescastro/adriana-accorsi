-- 0014: legislativo (fase 5): beneficiários, projetos de lei, assuntos, coautores, comissões e votações.
-- O projeto de lei percorre etapas pelo mecanismo único de movimentação (fluxo "projeto_lei", fase 1).
-- Não há coluna de status nem de atraso: ambos derivam da etapa e do prazo, na leitura.

-- ---------------------------------------------------------------------------
-- CNPJ. Aceita o numérico e o alfanumérico (formato que a Receita adota a partir de julho de 2026):
-- 12 posições de dígitos ou letras maiúsculas e 2 dígitos verificadores. O valor de cada caractere é
-- o seu código ASCII menos 48, o que mantém o cálculo do CNPJ numérico como caso particular.
-- ---------------------------------------------------------------------------

CREATE FUNCTION cnpj_valido(valor text) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
    pesos_1 int[] := ARRAY[5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    pesos_2 int[] := ARRAY[6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    soma int;
    resto int;
    digito_1 int;
    digito_2 int;
    i int;
BEGIN
    IF valor IS NULL OR valor !~ '^[0-9A-Z]{12}[0-9]{2}$' OR valor ~ '^(.)\1{13}$' THEN
        RETURN false;
    END IF;

    soma := 0;
    FOR i IN 1..12 LOOP
        soma := soma + (ascii(substr(valor, i, 1)) - 48) * pesos_1[i];
    END LOOP;
    resto := soma % 11;
    digito_1 := CASE WHEN resto < 2 THEN 0 ELSE 11 - resto END;

    soma := 0;
    FOR i IN 1..13 LOOP
        soma := soma + (ascii(substr(valor, i, 1)) - 48) * pesos_2[i];
    END LOOP;
    resto := soma % 11;
    digito_2 := CASE WHEN resto < 2 THEN 0 ELSE 11 - resto END;

    RETURN digito_1 = substr(valor, 13, 1)::int AND digito_2 = substr(valor, 14, 1)::int;
END;
$$;

-- ---------------------------------------------------------------------------
-- Categoria: vocabulários controlados (assunto de projeto, tipo de proposição, e os das fases seguintes).
-- ---------------------------------------------------------------------------

CREATE TABLE categoria (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    natureza text NOT NULL,
    nome text NOT NULL,
    situacao text NOT NULL DEFAULT 'ativa',
    criado_em timestamptz NOT NULL DEFAULT now(),
    atualizado_em timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT categoria_natureza_valida CHECK (natureza IN (
        'assunto_projeto', 'tipo_proposicao', 'natureza_documento', 'tipo_emenda'
    )),
    CONSTRAINT categoria_nome_preenchido CHECK (length(btrim(nome)) > 0),
    CONSTRAINT categoria_situacao_valida CHECK (situacao IN ('ativa', 'inativa'))
);

-- O nome é único dentro da natureza, sem diferenciar maiúsculas: reativar vale mais que duplicar.
CREATE UNIQUE INDEX categoria_nome_unico ON categoria (natureza, lower(nome));

CREATE TRIGGER categoria_atualizado_em BEFORE UPDATE ON categoria
    FOR EACH ROW EXECUTE FUNCTION definir_atualizado_em();

-- Conjunto inicial, a ajustar pelo gabinete (Legislativo > Vocabulários).
INSERT INTO categoria (natureza, nome) VALUES
    ('tipo_proposicao', 'Projeto de lei'),
    ('tipo_proposicao', 'Projeto de lei complementar'),
    ('tipo_proposicao', 'Projeto de decreto legislativo'),
    ('tipo_proposicao', 'Proposta de emenda à Constituição'),
    ('tipo_proposicao', 'Requerimento'),
    ('tipo_proposicao', 'Indicação'),
    ('assunto_projeto', 'Saúde'),
    ('assunto_projeto', 'Educação'),
    ('assunto_projeto', 'Segurança pública'),
    ('assunto_projeto', 'Mulheres'),
    ('assunto_projeto', 'Direitos humanos'),
    ('assunto_projeto', 'Assistência social'),
    ('assunto_projeto', 'Meio ambiente'),
    ('assunto_projeto', 'Mobilidade e transporte'),
    ('assunto_projeto', 'Economia e trabalho'),
    ('assunto_projeto', 'Cultura e esporte');

-- ---------------------------------------------------------------------------
-- Beneficiário: município, órgão ou entidade. Também será usado pelas emendas (fase 6).
-- ---------------------------------------------------------------------------

CREATE TABLE beneficiario (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nome_fantasia text NOT NULL,
    razao_social text NOT NULL,
    cnpj text NOT NULL,
    cep text NOT NULL,
    logradouro text NOT NULL,
    numero text NOT NULL,
    complemento text,
    bairro text NOT NULL,
    cidade text NOT NULL,
    estado text NOT NULL,
    natureza text NOT NULL,
    situacao text NOT NULL DEFAULT 'ativo',
    criado_por bigint NOT NULL REFERENCES usuario (id),
    criado_em timestamptz NOT NULL DEFAULT now(),
    atualizado_em timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT beneficiario_nome_fantasia_preenchido CHECK (length(btrim(nome_fantasia)) > 0),
    CONSTRAINT beneficiario_razao_social_preenchida CHECK (length(btrim(razao_social)) > 0),
    CONSTRAINT beneficiario_cnpj_valido CHECK (cnpj_valido(cnpj)),
    CONSTRAINT beneficiario_cep_valido CHECK (cep ~ '^[0-9]{8}$'),
    CONSTRAINT beneficiario_endereco_preenchido CHECK (
        length(btrim(logradouro)) > 0 AND length(btrim(numero)) > 0
        AND length(btrim(bairro)) > 0 AND length(btrim(cidade)) > 0
    ),
    CONSTRAINT beneficiario_complemento_nao_vazio CHECK (complemento IS NULL OR length(btrim(complemento)) > 0),
    CONSTRAINT beneficiario_estado_valido CHECK (estado IN (
        'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
        'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
    )),
    CONSTRAINT beneficiario_natureza_valida CHECK (natureza IN ('municipio', 'orgao', 'entidade')),
    CONSTRAINT beneficiario_situacao_valida CHECK (situacao IN ('ativo', 'inativo'))
);

-- Sem dois beneficiários ativos com o mesmo CNPJ (RN-BEN-02). Inativo libera o CNPJ.
CREATE UNIQUE INDEX beneficiario_cnpj_unico_ativos ON beneficiario (cnpj) WHERE situacao = 'ativo';
CREATE INDEX beneficiario_nome_idx ON beneficiario (lower(nome_fantasia));

CREATE TRIGGER beneficiario_atualizado_em BEFORE UPDATE ON beneficiario
    FOR EACH ROW EXECUTE FUNCTION definir_atualizado_em();

-- ---------------------------------------------------------------------------
-- Projeto de lei. Sem coluna de status: deriva do papel da etapa.
-- ---------------------------------------------------------------------------

CREATE TABLE projeto_lei (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    criador_id bigint NOT NULL REFERENCES usuario (id),
    responsavel_id bigint NOT NULL REFERENCES usuario (id),
    titulo text NOT NULL,
    ementa text NOT NULL,
    autoria text NOT NULL,
    -- O número só existe depois do protocolo; enquanto o projeto está em redação, pode faltar.
    numero text,
    tipo_proposicao_id bigint NOT NULL REFERENCES categoria (id),
    etapa_atual_id bigint NOT NULL REFERENCES etapa (id),
    prazo date,
    cancelado_em timestamptz,
    cancelado_por bigint REFERENCES usuario (id),
    justificativa_cancelamento text,
    criado_em timestamptz NOT NULL DEFAULT now(),
    atualizado_em timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT projeto_titulo_preenchido CHECK (length(btrim(titulo)) > 0),
    CONSTRAINT projeto_ementa_preenchida CHECK (length(btrim(ementa)) > 0),
    CONSTRAINT projeto_autoria_preenchida CHECK (length(btrim(autoria)) > 0),
    CONSTRAINT projeto_numero_nao_vazio CHECK (numero IS NULL OR length(btrim(numero)) > 0),
    CONSTRAINT projeto_cancelamento_coerente CHECK (
        (cancelado_em IS NULL) = (cancelado_por IS NULL)
        AND (cancelado_em IS NULL) = (justificativa_cancelamento IS NULL)
    ),
    CONSTRAINT projeto_justificativa_minima CHECK (
        justificativa_cancelamento IS NULL OR length(btrim(justificativa_cancelamento)) >= 10
    )
);

-- Não pode haver dois projetos ativos (não cancelados) com o mesmo número (RN-PRO-01).
CREATE UNIQUE INDEX projeto_numero_unico_ativos ON projeto_lei (lower(numero))
    WHERE numero IS NOT NULL AND cancelado_em IS NULL;
CREATE INDEX projeto_responsavel_idx ON projeto_lei (responsavel_id);
CREATE INDEX projeto_etapa_idx ON projeto_lei (etapa_atual_id);
CREATE INDEX projeto_prazo_idx ON projeto_lei (prazo) WHERE prazo IS NOT NULL;
CREATE INDEX projeto_criado_em_idx ON projeto_lei (criado_em DESC, id DESC);

CREATE TRIGGER projeto_lei_atualizado_em BEFORE UPDATE ON projeto_lei
    FOR EACH ROW EXECUTE FUNCTION definir_atualizado_em();

CREATE FUNCTION projeto_lei_protegido() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF OLD.cancelado_em IS NOT NULL THEN
        RAISE EXCEPTION 'Projeto cancelado não se altera' USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    IF NEW.criador_id <> OLD.criador_id OR NEW.criado_em <> OLD.criado_em THEN
        RAISE EXCEPTION 'O criador e a data de criação do projeto não mudam' USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER projeto_lei_protegido BEFORE UPDATE ON projeto_lei
    FOR EACH ROW EXECUTE FUNCTION projeto_lei_protegido();

-- ---------------------------------------------------------------------------
-- O que cerca o projeto: assuntos, coautores, comissões e votações.
-- ---------------------------------------------------------------------------

CREATE TABLE projeto_assunto (
    projeto_id bigint NOT NULL REFERENCES projeto_lei (id),
    categoria_id bigint NOT NULL REFERENCES categoria (id),
    PRIMARY KEY (projeto_id, categoria_id)
);
CREATE INDEX projeto_assunto_categoria_idx ON projeto_assunto (categoria_id);

CREATE TABLE projeto_coautor (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    projeto_id bigint NOT NULL REFERENCES projeto_lei (id),
    nome text NOT NULL,
    CONSTRAINT projeto_coautor_nome_preenchido CHECK (length(btrim(nome)) > 0)
);
CREATE UNIQUE INDEX projeto_coautor_nome_unico ON projeto_coautor (projeto_id, lower(nome));

CREATE TABLE tramitacao_comissao (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    projeto_id bigint NOT NULL REFERENCES projeto_lei (id),
    comissao text NOT NULL,
    data date NOT NULL,
    parecer text,
    registrado_por bigint NOT NULL REFERENCES usuario (id),
    registrado_em timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT tramitacao_comissao_preenchida CHECK (length(btrim(comissao)) > 0),
    CONSTRAINT tramitacao_parecer_nao_vazio CHECK (parecer IS NULL OR length(btrim(parecer)) > 0)
);
CREATE INDEX tramitacao_comissao_projeto_idx ON tramitacao_comissao (projeto_id, data, id);

-- Votação registrada no projeto: data e resultado, sem placar individual (RN-PRO-05).
CREATE TABLE votacao_projeto (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    projeto_id bigint NOT NULL REFERENCES projeto_lei (id),
    data date NOT NULL,
    resultado text NOT NULL,
    local text,
    registrado_por bigint NOT NULL REFERENCES usuario (id),
    registrado_em timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT votacao_resultado_valido CHECK (resultado IN (
        'aprovado', 'aprovado_com_emendas', 'rejeitado', 'retirado_de_pauta', 'adiado'
    )),
    CONSTRAINT votacao_local_nao_vazio CHECK (local IS NULL OR length(btrim(local)) > 0)
);
CREATE INDEX votacao_projeto_idx ON votacao_projeto (projeto_id, data, id);

-- ---------------------------------------------------------------------------
-- Permissões. A API é a única que escreve; o worker e a área pública não alcançam nada daqui.
-- ---------------------------------------------------------------------------

GRANT SELECT, INSERT, UPDATE ON categoria TO app_api;
GRANT SELECT, INSERT, UPDATE ON beneficiario TO app_api;
GRANT SELECT, INSERT, UPDATE ON projeto_lei TO app_api;
GRANT SELECT, INSERT, DELETE ON projeto_assunto TO app_api;
GRANT SELECT, INSERT, DELETE ON projeto_coautor TO app_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON tramitacao_comissao TO app_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON votacao_projeto TO app_api;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO app_api;
