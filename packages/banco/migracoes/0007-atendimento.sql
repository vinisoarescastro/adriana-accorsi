-- 0007: atendimento (fase 2): pessoas, protocolo, demandas, comentários internos e documentos.
-- Nada se apaga em operação comum: não há permissão de DELETE em nenhuma destas tabelas.

-- Recusa qualquer alteração: serve às tabelas em que só se acrescenta.
CREATE FUNCTION tabela_somente_acrescimo() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'Esta tabela só aceita acréscimos (% recusado em %)', TG_OP, TG_TABLE_NAME
        USING ERRCODE = 'integrity_constraint_violation';
END;
$$;

-- ---------------------------------------------------------------------------
-- Pessoas (o cidadão atendido)
-- ---------------------------------------------------------------------------

CREATE TABLE pessoa (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nome_completo text,
    telefone_normalizado text,
    email text,
    contatos text,
    endereco text,
    situacao text NOT NULL DEFAULT 'ativa',
    criado_por bigint REFERENCES usuario (id),
    criado_em timestamptz NOT NULL DEFAULT now(),
    atualizado_em timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT pessoa_situacao_valida CHECK (situacao IN ('ativa', 'inativa', 'dados_eliminados')),
    CONSTRAINT pessoa_nome_obrigatorio CHECK (
        situacao = 'dados_eliminados' OR (nome_completo IS NOT NULL AND length(btrim(nome_completo)) > 0)
    ),
    CONSTRAINT pessoa_telefone_obrigatorio CHECK (situacao = 'dados_eliminados' OR telefone_normalizado IS NOT NULL),
    CONSTRAINT pessoa_telefone_formato CHECK (telefone_normalizado IS NULL OR telefone_normalizado ~ '^[0-9]{10,11}$'),
    -- Eliminar dados esvazia TODOS os dados pessoais, mantendo a linha para que protocolo e histórico sigam de pé.
    CONSTRAINT pessoa_eliminada_sem_dados CHECK (
        situacao <> 'dados_eliminados'
        OR (nome_completo IS NULL AND telefone_normalizado IS NULL AND email IS NULL
            AND contatos IS NULL AND endereco IS NULL)
    )
);

-- Não há duas pessoas ATIVAS com o mesmo telefone (RN-PES-01).
CREATE UNIQUE INDEX pessoa_telefone_unico_ativas ON pessoa (telefone_normalizado)
    WHERE situacao = 'ativa' AND telefone_normalizado IS NOT NULL;

CREATE TRIGGER pessoa_atualizado_em BEFORE UPDATE ON pessoa
    FOR EACH ROW EXECUTE FUNCTION definir_atualizado_em();

-- Dados eliminados não voltam (a eliminação é irreversível).
CREATE FUNCTION pessoa_eliminada_e_definitiva() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF OLD.situacao = 'dados_eliminados' THEN
        RAISE EXCEPTION 'Os dados desta pessoa foram eliminados e não podem ser alterados'
            USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER pessoa_eliminada_definitiva BEFORE UPDATE ON pessoa
    FOR EACH ROW EXECUTE FUNCTION pessoa_eliminada_e_definitiva();

-- ---------------------------------------------------------------------------
-- Protocolo: nunca reutilizado, nem se a demanda for cancelada.
-- 12 caracteres de um alfabeto de 31 símbolos, sem 0 O 1 I L.
-- ---------------------------------------------------------------------------

CREATE TABLE protocolo_emitido (
    protocolo text PRIMARY KEY,
    emitido_em timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT protocolo_formato CHECK (protocolo ~ '^[2-9A-HJKMNP-Z]{12}$')
);

CREATE TRIGGER protocolo_emitido_imutavel_linha BEFORE UPDATE OR DELETE ON protocolo_emitido
    FOR EACH ROW EXECUTE FUNCTION tabela_somente_acrescimo();
CREATE TRIGGER protocolo_emitido_imutavel_truncate BEFORE TRUNCATE ON protocolo_emitido
    FOR EACH STATEMENT EXECUTE FUNCTION tabela_somente_acrescimo();

-- ---------------------------------------------------------------------------
-- Demanda. Não há coluna de status: o status é derivado do papel da etapa.
-- ---------------------------------------------------------------------------

CREATE TABLE demanda (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    protocolo text NOT NULL UNIQUE REFERENCES protocolo_emitido (protocolo),
    -- O segredo do link: o hash serve à busca (a área pública só conhece o segredo que o cidadão traz);
    -- a cópia cifrada permite a equipe obter o link de novo. O segredo nunca vai para a trilha.
    segredo_link_hash text NOT NULL UNIQUE,
    segredo_link_cifrado text NOT NULL,
    publicacao_link text NOT NULL DEFAULT 'ativa',
    solicitante_id bigint NOT NULL REFERENCES pessoa (id),
    responsavel_id bigint NOT NULL REFERENCES usuario (id),
    autor_id bigint NOT NULL REFERENCES usuario (id),
    titulo text NOT NULL,
    descricao text,
    prioridade text NOT NULL DEFAULT 'media',
    etapa_atual_id bigint NOT NULL REFERENCES etapa (id),
    prazo date,
    cancelada_em timestamptz,
    cancelada_por bigint REFERENCES usuario (id),
    justificativa_cancelamento text,
    criado_em timestamptz NOT NULL DEFAULT now(),
    atualizado_em timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT demanda_titulo_preenchido CHECK (length(btrim(titulo)) > 0),
    CONSTRAINT demanda_prioridade_valida CHECK (prioridade IN ('baixa', 'media', 'alta', 'urgente')),
    CONSTRAINT demanda_link_valido CHECK (publicacao_link IN ('ativa', 'suspensa', 'revogada', 'expirada')),
    CONSTRAINT demanda_cancelamento_coerente CHECK (
        (cancelada_em IS NULL) = (cancelada_por IS NULL)
        AND (cancelada_em IS NULL) = (justificativa_cancelamento IS NULL)
    ),
    -- Cancelar exige justificativa de 10 caracteres ou mais (RN-DEM-09).
    CONSTRAINT demanda_justificativa_minima CHECK (
        justificativa_cancelamento IS NULL OR length(btrim(justificativa_cancelamento)) >= 10
    )
);

CREATE INDEX demanda_etapa_idx ON demanda (etapa_atual_id);
CREATE INDEX demanda_responsavel_idx ON demanda (responsavel_id);
CREATE INDEX demanda_solicitante_idx ON demanda (solicitante_id);
CREATE INDEX demanda_criado_em_idx ON demanda (criado_em DESC, id DESC);

CREATE TRIGGER demanda_atualizado_em BEFORE UPDATE ON demanda
    FOR EACH ROW EXECUTE FUNCTION definir_atualizado_em();

CREATE FUNCTION demanda_protegida() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.protocolo <> OLD.protocolo THEN
        RAISE EXCEPTION 'O protocolo é imutável' USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    IF OLD.cancelada_em IS NOT NULL THEN
        RAISE EXCEPTION 'Demanda cancelada não se altera' USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER demanda_protegida BEFORE UPDATE ON demanda
    FOR EACH ROW EXECUTE FUNCTION demanda_protegida();

-- ---------------------------------------------------------------------------
-- Comentário interno: sempre interno, não se edita. Remover deixa marca.
-- ---------------------------------------------------------------------------

CREATE TABLE comentario_interno (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    registro_tipo text NOT NULL,
    registro_id bigint NOT NULL,
    autor_id bigint NOT NULL REFERENCES usuario (id),
    texto text NOT NULL,
    criado_em timestamptz NOT NULL DEFAULT now(),
    situacao text NOT NULL DEFAULT 'ativo',
    removido_por bigint REFERENCES usuario (id),
    removido_em timestamptz,
    CONSTRAINT comentario_registro_valido CHECK (registro_tipo IN (
        'demanda', 'tarefa', 'projeto_lei', 'emenda', 'destinacao', 'despesa'
    )),
    CONSTRAINT comentario_texto_preenchido CHECK (length(btrim(texto)) > 0),
    CONSTRAINT comentario_situacao_valida CHECK (situacao IN ('ativo', 'removido')),
    CONSTRAINT comentario_remocao_coerente CHECK (
        (situacao = 'ativo' AND removido_por IS NULL AND removido_em IS NULL)
        OR (situacao = 'removido' AND removido_por IS NOT NULL AND removido_em IS NOT NULL)
    )
);

CREATE INDEX comentario_registro_idx ON comentario_interno (registro_tipo, registro_id, id);

CREATE FUNCTION comentario_so_remove() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.texto <> OLD.texto OR NEW.autor_id <> OLD.autor_id
       OR NEW.registro_tipo <> OLD.registro_tipo OR NEW.registro_id <> OLD.registro_id
       OR NEW.criado_em <> OLD.criado_em THEN
        RAISE EXCEPTION 'O comentário não se edita' USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    IF OLD.situacao = 'removido' THEN
        RAISE EXCEPTION 'O comentário removido não volta' USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER comentario_so_remove BEFORE UPDATE ON comentario_interno
    FOR EACH ROW EXECUTE FUNCTION comentario_so_remove();

-- Menções: guardadas para gerar os avisos quando a caixa de avisos existir (fase 4).
CREATE TABLE comentario_mencao (
    comentario_id bigint NOT NULL REFERENCES comentario_interno (id),
    usuario_id bigint NOT NULL REFERENCES usuario (id),
    PRIMARY KEY (comentario_id, usuario_id)
);

CREATE TRIGGER comentario_mencao_imutavel_linha BEFORE UPDATE OR DELETE ON comentario_mencao
    FOR EACH ROW EXECUTE FUNCTION tabela_somente_acrescimo();

-- ---------------------------------------------------------------------------
-- Documento: os bytes ficam no armazenamento privado; aqui só os metadados.
-- ---------------------------------------------------------------------------

CREATE TABLE documento (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    registro_tipo text NOT NULL,
    registro_id bigint NOT NULL,
    natureza text NOT NULL DEFAULT 'outro',
    nome text NOT NULL,
    tipo_real text NOT NULL,
    tamanho bigint NOT NULL,
    chave_armazenamento text NOT NULL UNIQUE,
    hash_sha256 text NOT NULL,
    varredura text NOT NULL,
    autor_envio bigint NOT NULL REFERENCES usuario (id),
    enviado_em timestamptz NOT NULL DEFAULT now(),
    situacao text NOT NULL DEFAULT 'ativo',
    removido_por bigint REFERENCES usuario (id),
    removido_em timestamptz,
    CONSTRAINT documento_registro_valido CHECK (registro_tipo IN (
        'demanda', 'tarefa', 'projeto_lei', 'emenda', 'destinacao', 'despesa'
    )),
    CONSTRAINT documento_nome_preenchido CHECK (length(btrim(nome)) > 0),
    CONSTRAINT documento_tipo_valido CHECK (tipo_real IN ('application/pdf', 'image/png', 'image/jpeg', 'application/zip')),
    CONSTRAINT documento_tamanho_valido CHECK (tamanho > 0 AND tamanho <= 26214400),
    CONSTRAINT documento_hash_formato CHECK (hash_sha256 ~ '^[0-9a-f]{64}$'),
    -- Um arquivo infectado nunca é guardado: só entra o que foi verificado ou o que não pôde ser (desenvolvimento).
    CONSTRAINT documento_varredura_valida CHECK (varredura IN ('limpo', 'nao_verificado')),
    CONSTRAINT documento_situacao_valida CHECK (situacao IN ('ativo', 'removido')),
    CONSTRAINT documento_remocao_coerente CHECK (
        (situacao = 'ativo' AND removido_por IS NULL AND removido_em IS NULL)
        OR (situacao = 'removido' AND removido_por IS NOT NULL AND removido_em IS NOT NULL)
    )
);

CREATE INDEX documento_registro_idx ON documento (registro_tipo, registro_id, id);

CREATE FUNCTION documento_so_remove() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.registro_tipo <> OLD.registro_tipo OR NEW.registro_id <> OLD.registro_id
       OR NEW.nome <> OLD.nome OR NEW.tipo_real <> OLD.tipo_real OR NEW.tamanho <> OLD.tamanho
       OR NEW.chave_armazenamento <> OLD.chave_armazenamento OR NEW.hash_sha256 <> OLD.hash_sha256
       OR NEW.autor_envio <> OLD.autor_envio OR NEW.enviado_em <> OLD.enviado_em THEN
        RAISE EXCEPTION 'O documento não se altera' USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    IF OLD.situacao = 'removido' THEN
        RAISE EXCEPTION 'O documento removido não volta' USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER documento_so_remove BEFORE UPDATE ON documento
    FOR EACH ROW EXECUTE FUNCTION documento_so_remove();

-- ---------------------------------------------------------------------------
-- Permissões: nunca DELETE.
-- ---------------------------------------------------------------------------

GRANT SELECT, INSERT, UPDATE ON pessoa TO app_api;
GRANT SELECT, INSERT ON protocolo_emitido TO app_api;
GRANT SELECT, INSERT, UPDATE ON demanda TO app_api;
GRANT SELECT, INSERT, UPDATE ON comentario_interno TO app_api;
GRANT SELECT, INSERT ON comentario_mencao TO app_api;
GRANT SELECT, INSERT, UPDATE ON documento TO app_api;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO app_api;
