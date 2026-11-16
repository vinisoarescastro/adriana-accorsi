-- 0009: trabalho da equipe (fase 4): tarefas, avisos, agenda, eventos e presença.
-- A tarefa percorre etapas pelo mecanismo único de movimentação (fluxo "tarefa", fase 1).

-- ---------------------------------------------------------------------------
-- Tarefa. Não há coluna de status: o status deriva do papel da etapa.
-- ---------------------------------------------------------------------------

CREATE TABLE tarefa (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    criador_id bigint NOT NULL REFERENCES usuario (id),
    responsavel_id bigint NOT NULL REFERENCES usuario (id),
    titulo text NOT NULL,
    descricao text,
    prioridade text NOT NULL DEFAULT 'media',
    prazo date,
    etapa_atual_id bigint NOT NULL REFERENCES etapa (id),
    -- Vínculo com o registro de origem (a tarefa herda o alcance dele). Estende-se por migração.
    vinculo_tipo text,
    vinculo_id bigint,
    cancelada_em timestamptz,
    cancelada_por bigint REFERENCES usuario (id),
    justificativa_cancelamento text,
    criado_em timestamptz NOT NULL DEFAULT now(),
    atualizado_em timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT tarefa_titulo_preenchido CHECK (length(btrim(titulo)) > 0),
    CONSTRAINT tarefa_prioridade_valida CHECK (prioridade IN ('baixa', 'media', 'alta', 'urgente')),
    CONSTRAINT tarefa_vinculo_completo CHECK ((vinculo_tipo IS NULL) = (vinculo_id IS NULL)),
    CONSTRAINT tarefa_vinculo_valido CHECK (vinculo_tipo IS NULL OR vinculo_tipo IN (
        'demanda', 'pessoa', 'compromisso', 'evento'
    )),
    CONSTRAINT tarefa_cancelamento_coerente CHECK (
        (cancelada_em IS NULL) = (cancelada_por IS NULL)
        AND (cancelada_em IS NULL) = (justificativa_cancelamento IS NULL)
    ),
    CONSTRAINT tarefa_justificativa_minima CHECK (
        justificativa_cancelamento IS NULL OR length(btrim(justificativa_cancelamento)) >= 10
    )
);

CREATE INDEX tarefa_responsavel_idx ON tarefa (responsavel_id);
CREATE INDEX tarefa_etapa_idx ON tarefa (etapa_atual_id);
CREATE INDEX tarefa_prazo_idx ON tarefa (prazo) WHERE prazo IS NOT NULL;
CREATE INDEX tarefa_vinculo_idx ON tarefa (vinculo_tipo, vinculo_id) WHERE vinculo_tipo IS NOT NULL;
CREATE INDEX tarefa_criado_em_idx ON tarefa (criado_em DESC, id DESC);

CREATE TRIGGER tarefa_atualizado_em BEFORE UPDATE ON tarefa
    FOR EACH ROW EXECUTE FUNCTION definir_atualizado_em();

CREATE FUNCTION tarefa_protegida() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF OLD.cancelada_em IS NOT NULL THEN
        RAISE EXCEPTION 'Tarefa cancelada não se altera' USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    IF NEW.criador_id <> OLD.criador_id OR NEW.criado_em <> OLD.criado_em THEN
        RAISE EXCEPTION 'O criador e a data de criação da tarefa não mudam' USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER tarefa_protegida BEFORE UPDATE ON tarefa
    FOR EACH ROW EXECUTE FUNCTION tarefa_protegida();

-- ---------------------------------------------------------------------------
-- Aviso: a caixa pessoal (o sino). Sem texto, sem dado pessoal, sem valor.
-- Só o estado de leitura e a expiração mudam depois de criado.
-- ---------------------------------------------------------------------------

CREATE TABLE aviso (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    destinatario_id bigint NOT NULL REFERENCES usuario (id),
    natureza text NOT NULL,
    registro_tipo text NOT NULL,
    registro_id bigint NOT NULL,
    gerado_em timestamptz NOT NULL DEFAULT now(),
    lido_em timestamptz,
    expira_em timestamptz NOT NULL,
    -- Dá a "uma vez por dia por prazo" ao worker: o mesmo aviso não se repete no mesmo dia.
    chave_unica text UNIQUE,
    CONSTRAINT aviso_natureza_valida CHECK (natureza IN (
        'tarefa_designada', 'tarefa_reatribuida',
        'compromisso_indicacao', 'compromisso_remarcado', 'compromisso_cancelado',
        'prazo_proximo', 'prazo_vencido',
        'despesa_aguardando_analise', 'saldo_abaixo_limite',
        'mencao'
    )),
    CONSTRAINT aviso_registro_valido CHECK (registro_tipo IN (
        'tarefa', 'demanda', 'compromisso', 'despesa', 'destinacao'
    )),
    CONSTRAINT aviso_chave_sem_dado_pessoal CHECK (chave_unica IS NULL OR chave_unica ~ '^[a-z_]+:[a-z_]+:[0-9]+:[0-9-]+$')
);

CREATE INDEX aviso_caixa_idx ON aviso (destinatario_id, lido_em, id DESC);
CREATE INDEX aviso_expira_idx ON aviso (expira_em);

CREATE FUNCTION aviso_so_muda_a_leitura() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.destinatario_id <> OLD.destinatario_id OR NEW.natureza <> OLD.natureza
       OR NEW.registro_tipo <> OLD.registro_tipo OR NEW.registro_id <> OLD.registro_id
       OR NEW.gerado_em <> OLD.gerado_em OR NEW.chave_unica IS DISTINCT FROM OLD.chave_unica THEN
        RAISE EXCEPTION 'Só a leitura e a expiração do aviso mudam' USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER aviso_so_muda_a_leitura BEFORE UPDATE ON aviso
    FOR EACH ROW EXECUTE FUNCTION aviso_so_muda_a_leitura();

-- ---------------------------------------------------------------------------
-- Agenda: compromissos, participantes e bloqueios de indisponibilidade.
-- ---------------------------------------------------------------------------

CREATE TABLE compromisso (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    criador_id bigint NOT NULL REFERENCES usuario (id),
    titulo text NOT NULL,
    local text,
    inicio timestamptz NOT NULL,
    fim timestamptz NOT NULL,
    dia_inteiro boolean NOT NULL DEFAULT false,
    visibilidade text NOT NULL DEFAULT 'participantes',
    -- A agenda do gabinete é a agenda da Parlamentar: a marca vem ligada (RN-AGE-08).
    envolve_parlamentar boolean NOT NULL DEFAULT true,
    cancelado_em timestamptz,
    cancelado_por bigint REFERENCES usuario (id),
    criado_em timestamptz NOT NULL DEFAULT now(),
    atualizado_em timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT compromisso_titulo_preenchido CHECK (length(btrim(titulo)) > 0),
    CONSTRAINT compromisso_visibilidade_valida CHECK (visibilidade IN ('aberto', 'participantes', 'restrito')),
    CONSTRAINT compromisso_periodo_valido CHECK (fim >= inicio),
    CONSTRAINT compromisso_cancelamento_coerente CHECK ((cancelado_em IS NULL) = (cancelado_por IS NULL))
);

CREATE INDEX compromisso_periodo_idx ON compromisso (inicio, fim);

CREATE TRIGGER compromisso_atualizado_em BEFORE UPDATE ON compromisso
    FOR EACH ROW EXECUTE FUNCTION definir_atualizado_em();

CREATE FUNCTION compromisso_protegido() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF OLD.cancelado_em IS NOT NULL THEN
        RAISE EXCEPTION 'Compromisso cancelado não se altera' USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    IF NEW.criador_id <> OLD.criador_id OR NEW.criado_em <> OLD.criado_em THEN
        RAISE EXCEPTION 'O criador e a data de criação do compromisso não mudam' USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER compromisso_protegido BEFORE UPDATE ON compromisso
    FOR EACH ROW EXECUTE FUNCTION compromisso_protegido();

CREATE TABLE participante_interno (
    compromisso_id bigint NOT NULL REFERENCES compromisso (id),
    usuario_id bigint NOT NULL REFERENCES usuario (id),
    -- A resposta é só informativa: não cancela o compromisso nem remove o participante (RN-AGE-04).
    resposta text NOT NULL DEFAULT 'sem_resposta',
    respondido_em timestamptz,
    PRIMARY KEY (compromisso_id, usuario_id),
    CONSTRAINT participante_resposta_valida CHECK (resposta IN ('sem_resposta', 'confirmado', 'recusado'))
);

CREATE INDEX participante_interno_usuario_idx ON participante_interno (usuario_id);

-- Participante externo: pessoa já cadastrada (o beneficiário entra na fase 5). Sem acesso, aviso nem presença.
CREATE TABLE participante_externo (
    compromisso_id bigint NOT NULL REFERENCES compromisso (id),
    pessoa_id bigint NOT NULL REFERENCES pessoa (id),
    PRIMARY KEY (compromisso_id, pessoa_id)
);

-- Bloqueio de indisponibilidade: entra na agenda e no conflito, sem descrever o motivo (RN-AGE-06).
CREATE TABLE bloqueio_indisponibilidade (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    criador_id bigint NOT NULL REFERENCES usuario (id),
    inicio timestamptz NOT NULL,
    fim timestamptz NOT NULL,
    cancelado_em timestamptz,
    cancelado_por bigint REFERENCES usuario (id),
    criado_em timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT bloqueio_periodo_valido CHECK (fim > inicio),
    CONSTRAINT bloqueio_cancelamento_coerente CHECK ((cancelado_em IS NULL) = (cancelado_por IS NULL))
);

CREATE INDEX bloqueio_periodo_idx ON bloqueio_indisponibilidade (inicio, fim);

CREATE FUNCTION bloqueio_so_cancela() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF OLD.cancelado_em IS NOT NULL THEN
        RAISE EXCEPTION 'Bloqueio cancelado não se altera' USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    IF NEW.criador_id <> OLD.criador_id OR NEW.inicio <> OLD.inicio OR NEW.fim <> OLD.fim
       OR NEW.criado_em <> OLD.criado_em THEN
        RAISE EXCEPTION 'O bloqueio só se cancela, não se altera' USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER bloqueio_so_cancela BEFORE UPDATE ON bloqueio_indisponibilidade
    FOR EACH ROW EXECUTE FUNCTION bloqueio_so_cancela();

-- ---------------------------------------------------------------------------
-- Eventos e presença.
-- ---------------------------------------------------------------------------

CREATE TABLE evento (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    criador_id bigint NOT NULL REFERENCES usuario (id),
    nome text NOT NULL,
    inicio timestamptz NOT NULL,
    local text,
    -- Encerrar é decisão de alguém: nunca se deriva da data (RN-EVE-01).
    situacao text NOT NULL DEFAULT 'aberto',
    encerrado_em timestamptz,
    encerrado_por bigint REFERENCES usuario (id),
    criado_em timestamptz NOT NULL DEFAULT now(),
    atualizado_em timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT evento_nome_preenchido CHECK (length(btrim(nome)) > 0),
    CONSTRAINT evento_situacao_valida CHECK (situacao IN ('aberto', 'encerrado')),
    CONSTRAINT evento_encerramento_coerente CHECK (
        (situacao = 'aberto' AND encerrado_em IS NULL AND encerrado_por IS NULL)
        OR (situacao = 'encerrado' AND encerrado_em IS NOT NULL AND encerrado_por IS NOT NULL)
    )
);

CREATE INDEX evento_inicio_idx ON evento (inicio DESC, id DESC);

CREATE TRIGGER evento_atualizado_em BEFORE UPDATE ON evento
    FOR EACH ROW EXECUTE FUNCTION definir_atualizado_em();

CREATE FUNCTION evento_encerrado_e_definitivo() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF OLD.situacao = 'encerrado' THEN
        RAISE EXCEPTION 'Evento encerrado não se altera' USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER evento_encerrado_definitivo BEFORE UPDATE ON evento
    FOR EACH ROW EXECUTE FUNCTION evento_encerrado_e_definitivo();

CREATE TABLE participacao_evento (
    evento_id bigint NOT NULL REFERENCES evento (id),
    pessoa_id bigint NOT NULL REFERENCES pessoa (id),
    registrado_por bigint NOT NULL REFERENCES usuario (id),
    registrado_em timestamptz NOT NULL DEFAULT now(),
    observacao text,
    PRIMARY KEY (evento_id, pessoa_id)
);

-- Não se registra presença em evento encerrado (RN-EVE-01), nem se remove ou corrige depois.
CREATE FUNCTION participacao_exige_evento_aberto() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    v_evento bigint;
    v_situacao text;
BEGIN
    v_evento := CASE WHEN TG_OP = 'DELETE' THEN OLD.evento_id ELSE NEW.evento_id END;
    SELECT situacao INTO v_situacao FROM evento WHERE id = v_evento;
    IF v_situacao = 'encerrado' THEN
        RAISE EXCEPTION 'A presença não se altera em evento encerrado' USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE TRIGGER participacao_exige_evento_aberto BEFORE INSERT OR UPDATE OR DELETE ON participacao_evento
    FOR EACH ROW EXECUTE FUNCTION participacao_exige_evento_aberto();

-- ---------------------------------------------------------------------------
-- Funções do worker de prazos: a antecedência configurável e o expurgo de avisos.
-- ---------------------------------------------------------------------------

-- Antecedência do aviso de prazo, em dias corridos (padrão 3, de 1 a 30).
CREATE FUNCTION antecedencia_do_aviso_de_prazo() RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
    SELECT coalesce((
        SELECT CASE WHEN jsonb_typeof(valor) = 'number' AND (valor)::text ~ '^[0-9]+$'
                         AND (valor)::text::integer BETWEEN 1 AND 30
                    THEN (valor)::text::integer END
        FROM parametro WHERE chave = 'antecedencia_aviso_prazo'
    ), 3);
$$;

-- Expurgo: avisos expirados saem da caixa. Não altera registro algum (RN-AVI-06).
CREATE FUNCTION expurgar_avisos(p_agora timestamptz) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
    v_apagados integer;
BEGIN
    DELETE FROM aviso WHERE expira_em <= p_agora;
    GET DIAGNOSTICS v_apagados = ROW_COUNT;
    RETURN v_apagados;
END;
$$;

REVOKE ALL ON FUNCTION antecedencia_do_aviso_de_prazo() FROM PUBLIC;
REVOKE ALL ON FUNCTION expurgar_avisos(timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION antecedencia_do_aviso_de_prazo() TO app_worker, app_api;
GRANT EXECUTE ON FUNCTION expurgar_avisos(timestamptz) TO app_worker;

-- O que o worker enxerga dos prazos: só o necessário para gerar o aviso, sem título nem dado pessoal.
-- Item aberto = não cancelado e fora das etapas de conclusão e arquivamento.
CREATE VIEW vw_prazo_aberto AS
SELECT 'tarefa'::text AS registro_tipo, t.id AS registro_id, t.responsavel_id, t.prazo
FROM tarefa t
JOIN etapa e ON e.id = t.etapa_atual_id
JOIN usuario u ON u.id = t.responsavel_id AND u.situacao = 'ativo'
WHERE t.prazo IS NOT NULL AND t.cancelada_em IS NULL AND e.papel IN ('entrada', 'intermediaria')
UNION ALL
SELECT 'demanda'::text, d.id, d.responsavel_id, d.prazo
FROM demanda d
JOIN etapa e ON e.id = d.etapa_atual_id
JOIN usuario u ON u.id = d.responsavel_id AND u.situacao = 'ativo'
WHERE d.prazo IS NOT NULL AND d.cancelada_em IS NULL AND e.papel IN ('entrada', 'intermediaria');

-- ---------------------------------------------------------------------------
-- Concessões. O worker só INSERE em aviso (e lê a visão de prazos): nada mais.
-- ---------------------------------------------------------------------------

GRANT SELECT, INSERT, UPDATE ON tarefa TO app_api;
GRANT SELECT, INSERT, UPDATE ON aviso TO app_api;
GRANT SELECT, INSERT, UPDATE ON compromisso TO app_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON participante_interno TO app_api;
GRANT SELECT, INSERT, DELETE ON participante_externo TO app_api;
GRANT SELECT, INSERT, UPDATE ON bloqueio_indisponibilidade TO app_api;
GRANT SELECT, INSERT, UPDATE ON evento TO app_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON participacao_evento TO app_api;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO app_api;

GRANT SELECT ON vw_prazo_aberto TO app_worker;
GRANT INSERT ON aviso TO app_worker;
GRANT USAGE ON SEQUENCE aviso_id_seq TO app_worker;
