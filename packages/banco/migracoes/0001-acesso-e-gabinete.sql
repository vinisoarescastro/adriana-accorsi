-- 0001: acesso, equipe, identidade do gabinete e parâmetros (fase 1, bloco 1.B).
-- Migrações aplicadas não podem ser editadas: o runner confere o checksum.

CREATE FUNCTION definir_atualizado_em() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    NEW.atualizado_em = now();
    RETURN NEW;
END;
$$;

CREATE TABLE conta_acesso (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email text NOT NULL,
    verificador_senha text NOT NULL,
    tentativas_falhas integer NOT NULL DEFAULT 0,
    bloqueada_ate timestamptz,
    senha_troca_obrigatoria boolean NOT NULL DEFAULT true,
    criado_em timestamptz NOT NULL DEFAULT now(),
    atualizado_em timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT conta_acesso_email_unico UNIQUE (email),
    CONSTRAINT conta_acesso_email_minusculo CHECK (email = lower(email)),
    CONSTRAINT conta_acesso_email_formato CHECK (email ~ '^[^@[:space:]]+@[^@[:space:]]+$'),
    CONSTRAINT conta_acesso_tentativas_nao_negativas CHECK (tentativas_falhas >= 0)
);

CREATE TRIGGER conta_acesso_atualizado_em BEFORE UPDATE ON conta_acesso
    FOR EACH ROW EXECUTE FUNCTION definir_atualizado_em();

CREATE TABLE usuario (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    conta_id bigint NOT NULL UNIQUE REFERENCES conta_acesso (id),
    nome text NOT NULL,
    contato text,
    foto_chave text,
    perfil text NOT NULL,
    situacao text NOT NULL DEFAULT 'ativo',
    criado_em timestamptz NOT NULL DEFAULT now(),
    atualizado_em timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT usuario_nome_preenchido CHECK (length(btrim(nome)) > 0),
    CONSTRAINT usuario_perfil_valido CHECK (perfil IN (
        'parlamentar', 'administrador', 'chefe', 'supervisor', 'assessor_interno', 'assessor_externo'
    )),
    CONSTRAINT usuario_situacao_valida CHECK (situacao IN ('ativo', 'inativo'))
);

CREATE TRIGGER usuario_atualizado_em BEFORE UPDATE ON usuario
    FOR EACH ROW EXECUTE FUNCTION definir_atualizado_em();

-- No máximo um usuário ativo com o perfil Parlamentar (a Deputada).
CREATE UNIQUE INDEX usuario_um_parlamentar_ativo ON usuario ((true))
    WHERE perfil = 'parlamentar' AND situacao = 'ativo';

CREATE TABLE habilitacao (
    usuario_id bigint NOT NULL REFERENCES usuario (id),
    area text NOT NULL,
    concedida_por bigint REFERENCES usuario (id),
    concedida_em timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (usuario_id, area),
    CONSTRAINT habilitacao_area_valida CHECK (area IN ('AT', 'AG', 'LG', 'FI'))
);

-- Ticket de sessão: só o hash (SHA-256 em hexadecimal) é guardado. Vazar o banco não vaza sessões.
CREATE TABLE sessao (
    ticket_hash text PRIMARY KEY,
    usuario_id bigint NOT NULL REFERENCES usuario (id),
    perfil text NOT NULL,
    habilitacoes text[] NOT NULL DEFAULT '{}',
    criada_em timestamptz NOT NULL DEFAULT now(),
    ultimo_uso_em timestamptz NOT NULL DEFAULT now(),
    expira_em timestamptz NOT NULL,
    CONSTRAINT sessao_ticket_hash_formato CHECK (ticket_hash ~ '^[0-9a-f]{64}$')
);

CREATE INDEX sessao_usuario_idx ON sessao (usuario_id);

-- Senha inicial de uso único e com validade. O hash fica em conta_acesso.
CREATE TABLE senha_inicial (
    usuario_id bigint PRIMARY KEY REFERENCES usuario (id),
    expira_em timestamptz NOT NULL,
    usada_em timestamptz
);

-- Identidade da Parlamentar e do gabinete: uma única linha.
CREATE TABLE gabinete (
    id smallint PRIMARY KEY DEFAULT 1,
    nome text NOT NULL,
    parlamentar_nome text NOT NULL,
    cargo text NOT NULL,
    partido text,
    mandato text,
    contato_telefone text,
    contato_email text,
    contato_endereco text,
    foto_chave text,
    fuso text NOT NULL DEFAULT 'America/Sao_Paulo',
    atualizado_em timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT gabinete_linha_unica CHECK (id = 1)
);

CREATE TRIGGER gabinete_atualizado_em BEFORE UPDATE ON gabinete
    FOR EACH ROW EXECUTE FUNCTION definir_atualizado_em();

CREATE TABLE parametro (
    chave text PRIMARY KEY,
    valor jsonb NOT NULL,
    atualizado_em timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT parametro_chave_preenchida CHECK (length(btrim(chave)) > 0)
);

CREATE TRIGGER parametro_atualizado_em BEFORE UPDATE ON parametro
    FOR EACH ROW EXECUTE FUNCTION definir_atualizado_em();
