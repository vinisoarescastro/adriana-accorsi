-- 0008: fase 3, o cidadão (área pública, política de publicação, andamentos, consentimento e e-mail).
-- Nada é público por padrão: o app público só lê as visões `vw_acompanhamento_*` e só escreve por
-- duas funções nominais (registrar o acesso e descadastrar).

-- ---------------------------------------------------------------------------
-- Política de publicação: versionada. Alterar fecha a versão vigente e abre a seguinte.
-- ---------------------------------------------------------------------------

CREATE TABLE politica_publicacao (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    exibir_titulo boolean NOT NULL DEFAULT false,
    exibicao_nome text NOT NULL DEFAULT 'primeiro_nome',
    exibicao_telefone text NOT NULL DEFAULT 'nao_exibir',
    -- Dias após o desfecho (conclusão, arquivamento ou cancelamento) em que o link deixa de valer.
    expiracao_dias integer NOT NULL DEFAULT 90,
    vigente_desde timestamptz NOT NULL DEFAULT now(),
    vigente_ate timestamptz,
    criado_por bigint REFERENCES usuario (id),
    CONSTRAINT politica_nome_valida CHECK (exibicao_nome IN ('completo', 'primeiro_nome', 'nao_exibir')),
    CONSTRAINT politica_telefone_valido CHECK (exibicao_telefone IN ('completo', 'mascarado', 'nao_exibir')),
    CONSTRAINT politica_expiracao_valida CHECK (expiracao_dias BETWEEN 7 AND 1825),
    CONSTRAINT politica_vigencia_coerente CHECK (vigente_ate IS NULL OR vigente_ate >= vigente_desde)
);

-- Exatamente uma versão vigente.
CREATE UNIQUE INDEX politica_publicacao_uma_vigente ON politica_publicacao ((true)) WHERE vigente_ate IS NULL;

-- A única alteração permitida é fechar a vigência; nada se apaga.
CREATE FUNCTION politica_publicacao_protegida() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'A política de publicação não se apaga' USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    IF OLD.vigente_ate IS NOT NULL
        OR (to_jsonb(NEW) - 'vigente_ate') <> (to_jsonb(OLD) - 'vigente_ate') THEN
        RAISE EXCEPTION 'Uma versão da política só pode ser encerrada, não alterada'
            USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER politica_publicacao_protegida BEFORE UPDATE OR DELETE ON politica_publicacao
    FOR EACH ROW EXECUTE FUNCTION politica_publicacao_protegida();
CREATE TRIGGER politica_publicacao_truncate BEFORE TRUNCATE ON politica_publicacao
    FOR EACH STATEMENT EXECUTE FUNCTION tabela_somente_acrescimo();

-- Versão inicial: o mais restritivo que ainda serve (título oculto, primeiro nome, sem telefone).
INSERT INTO politica_publicacao (exibir_titulo, exibicao_nome, exibicao_telefone, expiracao_dias)
VALUES (false, 'primeiro_nome', 'nao_exibir', 90);

-- ---------------------------------------------------------------------------
-- Andamento publicável: texto curto escrito para o cidadão. Entidade distinta do comentário interno.
-- ---------------------------------------------------------------------------

CREATE TABLE andamento_publicado (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    demanda_id bigint NOT NULL REFERENCES demanda (id),
    texto text NOT NULL,
    autor_id bigint NOT NULL REFERENCES usuario (id),
    publicado_em timestamptz NOT NULL DEFAULT now(),
    situacao text NOT NULL DEFAULT 'publicado',
    removido_por bigint REFERENCES usuario (id),
    removido_em timestamptz,
    CONSTRAINT andamento_texto_valido CHECK (length(btrim(texto)) BETWEEN 1 AND 600),
    CONSTRAINT andamento_situacao_valida CHECK (situacao IN ('publicado', 'removido')),
    CONSTRAINT andamento_remocao_coerente CHECK (
        (situacao = 'removido') = (removido_por IS NOT NULL AND removido_em IS NOT NULL)
    )
);

CREATE INDEX andamento_publicado_demanda_idx ON andamento_publicado (demanda_id, id);

-- Não se edita nem se apaga: remover só marca (o texto fica, para a prestação de contas).
CREATE FUNCTION andamento_so_remove() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'O andamento não se apaga' USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    IF OLD.situacao = 'removido'
        OR NEW.situacao <> 'removido'
        OR (to_jsonb(NEW) - 'situacao' - 'removido_por' - 'removido_em')
           <> (to_jsonb(OLD) - 'situacao' - 'removido_por' - 'removido_em') THEN
        RAISE EXCEPTION 'O andamento só pode ser marcado como removido' USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER andamento_so_remove BEFORE UPDATE OR DELETE ON andamento_publicado
    FOR EACH ROW EXECUTE FUNCTION andamento_so_remove();
CREATE TRIGGER andamento_so_remove_truncate BEFORE TRUNCATE ON andamento_publicado
    FOR EACH STATEMENT EXECUTE FUNCTION tabela_somente_acrescimo();

-- ---------------------------------------------------------------------------
-- Consentimento de notificação: histórico que só acrescenta. O vigente é o mais recente.
-- ---------------------------------------------------------------------------

CREATE TABLE consentimento_notificacao (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    pessoa_id bigint NOT NULL REFERENCES pessoa (id),
    consentido boolean NOT NULL,
    registrado_por bigint REFERENCES usuario (id),
    registrado_em timestamptz NOT NULL DEFAULT now(),
    origem text NOT NULL,
    versao_texto integer,
    CONSTRAINT consentimento_origem_valida CHECK (origem IN (
        'atendimento_telefonico', 'atendimento_presencial', 'pedido_ao_gabinete',
        'descadastro_cidadao', 'dados_eliminados'
    )),
    -- Dar o consentimento exige saber qual texto foi aceito e quem o registrou.
    CONSTRAINT consentimento_sim_completo CHECK (
        NOT consentido OR (versao_texto IS NOT NULL AND registrado_por IS NOT NULL)
    )
);

CREATE INDEX consentimento_pessoa_idx ON consentimento_notificacao (pessoa_id, id DESC);

CREATE TRIGGER consentimento_imutavel_linha BEFORE UPDATE OR DELETE ON consentimento_notificacao
    FOR EACH ROW EXECUTE FUNCTION tabela_somente_acrescimo();
CREATE TRIGGER consentimento_imutavel_truncate BEFORE TRUNCATE ON consentimento_notificacao
    FOR EACH STATEMENT EXECUTE FUNCTION tabela_somente_acrescimo();

-- E-mail que o provedor recusou em definitivo: não se tenta de novo até a equipe trocá-lo.
ALTER TABLE pessoa ADD COLUMN email_invalido boolean NOT NULL DEFAULT false;

-- ---------------------------------------------------------------------------
-- Outbox de notificações. O ato grava a linha na mesma transação; o worker envia depois.
-- ---------------------------------------------------------------------------

CREATE TABLE envio_notificacao (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    pessoa_id bigint NOT NULL REFERENCES pessoa (id),
    demanda_id bigint NOT NULL REFERENCES demanda (id),
    evento text NOT NULL,
    canal text NOT NULL DEFAULT 'email',
    payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    -- Link de descadastro único por mensagem: o banco guarda só o hash.
    descadastro_hash text NOT NULL UNIQUE,
    estado text NOT NULL DEFAULT 'pendente',
    tentativas integer NOT NULL DEFAULT 0,
    proxima_tentativa_em timestamptz NOT NULL DEFAULT now(),
    provedor_id_mensagem text,
    erro text,
    criado_em timestamptz NOT NULL DEFAULT now(),
    enviado_em timestamptz,
    CONSTRAINT envio_evento_valido CHECK (evento IN (
        'andamento_publicado', 'etapa_visivel', 'conclusao', 'cancelamento'
    )),
    CONSTRAINT envio_canal_valido CHECK (canal IN ('email')),
    CONSTRAINT envio_estado_valido CHECK (estado IN ('pendente', 'enviando', 'enviado', 'falhou', 'cancelado')),
    CONSTRAINT envio_enviado_coerente CHECK ((estado = 'enviado') = (enviado_em IS NOT NULL))
);

CREATE INDEX envio_fila_idx ON envio_notificacao (proxima_tentativa_em, id) WHERE estado = 'pendente';
CREATE INDEX envio_pessoa_idx ON envio_notificacao (pessoa_id, id DESC);
CREATE INDEX envio_criado_idx ON envio_notificacao (criado_em DESC, id DESC);

-- ---------------------------------------------------------------------------
-- A demanda cancelada é só de leitura, EXCETO a gestão do link (revogar é segurança, e precisa
-- valer também depois do cancelamento).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION demanda_protegida() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    so_link constant text[] := ARRAY['publicacao_link', 'segredo_link_hash', 'segredo_link_cifrado', 'atualizado_em'];
BEGIN
    IF NEW.protocolo <> OLD.protocolo THEN
        RAISE EXCEPTION 'O protocolo é imutável' USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    IF OLD.cancelada_em IS NOT NULL AND (to_jsonb(NEW) - so_link) <> (to_jsonb(OLD) - so_link) THEN
        RAISE EXCEPTION 'Demanda cancelada não se altera' USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Visões públicas. As visões pertencem ao dono do esquema e valem com os direitos dele: o papel
-- app_publico só precisa de SELECT nelas, e NENHUM direito nas tabelas internas.
-- Só entram demandas com link ativo ou revogado (a consulta por protocolo segue de pé) e não
-- expiradas; suspensa fecha as duas vias.
-- ---------------------------------------------------------------------------

CREATE VIEW vw_acompanhamento_publico AS
WITH politica AS (
    SELECT * FROM politica_publicacao WHERE vigente_ate IS NULL
),
base AS (
    SELECT
        d.id,
        d.protocolo,
        d.segredo_link_hash,
        d.publicacao_link,
        d.titulo,
        d.criado_em,
        d.atualizado_em,
        d.cancelada_em,
        e.papel,
        e.ordem,
        p.nome_completo,
        p.telefone_normalizado,
        CASE
            WHEN d.cancelada_em IS NOT NULL THEN d.cancelada_em
            WHEN e.papel IN ('conclusao', 'arquivamento') THEN (
                SELECT max(m.criada_em) FROM movimentacao m
                WHERE m.registro_tipo = 'demanda' AND m.registro_id = d.id AND m.etapa_destino_id = d.etapa_atual_id
            )
        END AS desfecho_em
    FROM demanda d
    JOIN etapa e ON e.id = d.etapa_atual_id
    JOIN pessoa p ON p.id = d.solicitante_id
    WHERE d.publicacao_link IN ('ativa', 'revogada')
)
SELECT
    b.protocolo,
    CASE WHEN b.publicacao_link = 'ativa' THEN b.segredo_link_hash END AS segredo_link_hash,
    (b.publicacao_link = 'ativa') AS link_ativo,
    b.criado_em,
    greatest(
        b.atualizado_em,
        (SELECT max(m.criada_em) FROM movimentacao m WHERE m.registro_tipo = 'demanda' AND m.registro_id = b.id),
        (SELECT max(a.publicado_em) FROM andamento_publicado a WHERE a.demanda_id = b.id AND a.situacao = 'publicado')
    ) AS atualizado_em,
    CASE
        WHEN b.cancelada_em IS NOT NULL THEN 'cancelada'
        WHEN b.papel = 'conclusao' THEN 'concluida'
        WHEN b.papel = 'arquivamento' THEN 'arquivada'
        ELSE 'em_andamento'
    END AS situacao,
    CASE WHEN po.exibir_titulo THEN b.titulo END AS titulo_publico,
    CASE po.exibicao_nome
        WHEN 'completo' THEN b.nome_completo
        WHEN 'primeiro_nome' THEN split_part(btrim(b.nome_completo), ' ', 1)
    END AS nome_publico,
    CASE po.exibicao_telefone
        WHEN 'completo' THEN b.telefone_normalizado
        WHEN 'mascarado' THEN
            CASE WHEN b.telefone_normalizado IS NOT NULL
                THEN substr(b.telefone_normalizado, 1, 2) || '*****' || right(b.telefone_normalizado, 2) END
    END AS telefone_publico,
    g.nome AS gabinete_nome,
    g.parlamentar_nome,
    g.contato_telefone AS gabinete_telefone,
    g.contato_email AS gabinete_email
FROM base b
CROSS JOIN politica po
LEFT JOIN gabinete g ON g.id = 1
WHERE b.desfecho_em IS NULL
   OR b.desfecho_em + make_interval(days => po.expiracao_dias) > now();

-- Etapas que o cidadão enxerga: só as de rótulo público, sem lacunas, sem o nome interno.
-- Concluídas e a atual levam a data; as previstas não (previsão não é compromisso).
CREATE VIEW vw_acompanhamento_etapas AS
WITH alvo AS (
    SELECT d.id, d.protocolo, d.etapa_atual_id, e.ordem AS ordem_atual, v.situacao
    FROM demanda d
    JOIN etapa e ON e.id = d.etapa_atual_id
    JOIN vw_acompanhamento_publico v ON v.protocolo = d.protocolo
),
visiveis AS (
    SELECT
        a.protocolo,
        a.situacao,
        et.id AS etapa_id,
        et.ordem,
        et.rotulo_publico AS rotulo,
        (SELECT max(m.criada_em) FROM movimentacao m
          WHERE m.registro_tipo = 'demanda' AND m.registro_id = a.id AND m.etapa_destino_id = et.id) AS data_em,
        a.ordem_atual
    FROM alvo a
    JOIN tipo_processo tp ON tp.tipo = 'demanda'
    JOIN etapa et ON et.tipo_processo_id = tp.id
    WHERE et.visivel_publico AND et.situacao = 'ativa'
      AND et.rotulo_publico IS NOT NULL AND length(btrim(et.rotulo_publico)) > 0
),
ultima_visivel AS (
    -- A etapa mostrada como "atual" é a última visível já alcançada (a atual pode estar oculta).
    SELECT DISTINCT ON (protocolo) protocolo, etapa_id
    FROM visiveis
    WHERE data_em IS NOT NULL
    ORDER BY protocolo, data_em DESC, ordem DESC
)
SELECT
    v.protocolo,
    v.ordem,
    v.rotulo,
    CASE
        WHEN u.etapa_id = v.etapa_id THEN 'atual'
        WHEN v.data_em IS NOT NULL THEN 'concluida'
        ELSE 'prevista'
    END AS estado,
    CASE WHEN v.data_em IS NOT NULL THEN v.data_em END AS data_em
FROM visiveis v
LEFT JOIN ultima_visivel u ON u.protocolo = v.protocolo
-- Previstas só enquanto a demanda anda: concluída, arquivada ou cancelada não "prevê" mais nada.
WHERE v.data_em IS NOT NULL OR v.situacao = 'em_andamento';

CREATE VIEW vw_acompanhamento_andamentos AS
SELECT d.protocolo, a.texto, a.publicado_em
FROM andamento_publicado a
JOIN demanda d ON d.id = a.demanda_id
JOIN vw_acompanhamento_publico v ON v.protocolo = d.protocolo
WHERE a.situacao = 'publicado';

-- Para o worker: tudo o que um envio precisa, sem abrir as tabelas internas.
CREATE VIEW vw_envio_para_enviar AS
SELECT
    en.id,
    en.evento,
    en.payload,
    en.descadastro_hash,
    en.estado,
    en.tentativas,
    en.proxima_tentativa_em,
    pe.id AS pessoa_id,
    pe.email,
    pe.email_invalido,
    pe.situacao AS pessoa_situacao,
    split_part(btrim(coalesce(pe.nome_completo, '')), ' ', 1) AS primeiro_nome,
    coalesce((
        SELECT c.consentido FROM consentimento_notificacao c
        WHERE c.pessoa_id = pe.id ORDER BY c.id DESC LIMIT 1
    ), false) AS consentimento_vigente,
    d.protocolo,
    d.publicacao_link,
    d.segredo_link_cifrado,
    g.nome AS gabinete_nome,
    g.contato_telefone AS gabinete_telefone,
    g.contato_email AS gabinete_email
FROM envio_notificacao en
JOIN pessoa pe ON pe.id = en.pessoa_id
JOIN demanda d ON d.id = en.demanda_id
LEFT JOIN gabinete g ON g.id = 1;

-- ---------------------------------------------------------------------------
-- Funções nominais do app público e do worker (as únicas escritas além da leitura).
-- ---------------------------------------------------------------------------

-- A consulta por protocolo exige o telefone do atendimento. Nunca diz o que falhou.
CREATE FUNCTION consultar_protocolo(p_protocolo text, p_telefone text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
    SELECT EXISTS (
        SELECT 1
        FROM demanda d
        JOIN pessoa p ON p.id = d.solicitante_id
        JOIN vw_acompanhamento_publico v ON v.protocolo = d.protocolo
        WHERE d.protocolo = p_protocolo
          AND p.situacao = 'ativa'
          AND p.telefone_normalizado = p_telefone
    );
$$;

-- Cada acesso válido vira ocorrência na trilha, sem dado algum do visitante.
CREATE FUNCTION registrar_acesso_publico(p_protocolo text, p_via text) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
    INSERT INTO trilha (origem, operacao, entidade, registro_id, valor_novo)
    SELECT 'publico', 'publico.acompanhar', 'demanda', d.id::text, jsonb_build_object('via', p_via)
    FROM demanda d
    WHERE d.protocolo = p_protocolo AND p_via IN ('link', 'protocolo');
$$;

-- Descadastro: um clique, sem login. Vale na hora (os envios pendentes são cancelados).
CREATE FUNCTION descadastrar_por_token(p_hash text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
    v_pessoa bigint;
    v_vigente boolean;
BEGIN
    SELECT pessoa_id INTO v_pessoa FROM envio_notificacao WHERE descadastro_hash = p_hash;
    IF v_pessoa IS NULL THEN
        RETURN false;
    END IF;

    SELECT consentido INTO v_vigente FROM consentimento_notificacao
    WHERE pessoa_id = v_pessoa ORDER BY id DESC LIMIT 1;

    IF coalesce(v_vigente, false) THEN
        INSERT INTO consentimento_notificacao (pessoa_id, consentido, origem)
        VALUES (v_pessoa, false, 'descadastro_cidadao');
        INSERT INTO trilha (origem, operacao, entidade, registro_id, valor_novo)
        VALUES ('publico', 'consentimento.descadastrar', 'pessoa', v_pessoa::text,
                jsonb_build_object('consentido', false, 'origem', 'descadastro_cidadao'));
    END IF;

    UPDATE envio_notificacao SET estado = 'cancelado', erro = 'Descadastro do cidadão'
    WHERE pessoa_id = v_pessoa AND estado IN ('pendente', 'enviando');
    RETURN true;
END;
$$;

CREATE FUNCTION marcar_email_invalido(p_pessoa_id bigint) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
    UPDATE pessoa SET email_invalido = true
    WHERE id = p_pessoa_id AND situacao <> 'dados_eliminados';
$$;

REVOKE ALL ON FUNCTION consultar_protocolo(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION registrar_acesso_publico(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION descadastrar_por_token(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION marcar_email_invalido(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION consultar_protocolo(text, text) TO app_publico;
GRANT EXECUTE ON FUNCTION registrar_acesso_publico(text, text) TO app_publico;
GRANT EXECUTE ON FUNCTION descadastrar_por_token(text) TO app_publico;
GRANT EXECUTE ON FUNCTION marcar_email_invalido(bigint) TO app_worker;

-- ---------------------------------------------------------------------------
-- Concessões.
-- ---------------------------------------------------------------------------

GRANT SELECT, INSERT, UPDATE ON politica_publicacao TO app_api;
GRANT SELECT, INSERT, UPDATE ON andamento_publicado TO app_api;
GRANT SELECT, INSERT ON consentimento_notificacao TO app_api;
GRANT SELECT, INSERT, UPDATE ON envio_notificacao TO app_api;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO app_api;

GRANT SELECT ON vw_acompanhamento_publico, vw_acompanhamento_etapas, vw_acompanhamento_andamentos
    TO app_publico;

-- O worker lê os envios pela visão e atualiza só o estado do envio.
GRANT SELECT ON vw_envio_para_enviar TO app_worker;
GRANT SELECT, UPDATE ON envio_notificacao TO app_worker;

-- A previa da equipe le as MESMAS visoes do cidadao: mostra exatamente o que ele veria.
GRANT SELECT ON vw_acompanhamento_publico, vw_acompanhamento_etapas, vw_acompanhamento_andamentos
    TO app_api;
