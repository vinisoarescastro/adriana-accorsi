-- 0003: o sistema nunca fica sem um administrador ativo (RN, fase 1).
-- Gatilho adiado: é verificado no commit, então uma transação pode trocar de administrador.

CREATE FUNCTION exigir_administrador_ativo() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM usuario WHERE perfil = 'administrador' AND situacao = 'ativo'
    ) THEN
        RAISE EXCEPTION 'O sistema não pode ficar sem um administrador ativo'
            USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER usuario_administrador_obrigatorio
    AFTER INSERT OR UPDATE OR DELETE ON usuario
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION exigir_administrador_ativo();
