-- O nome (e a natureza) de um documento podem ser corrigidos depois do envio; o arquivo em si
-- (tipo, tamanho, hash, chave, autor e data do envio) continua imutável. A correção vai para a trilha.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION documento_so_remove() RETURNS trigger
    LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.registro_tipo <> OLD.registro_tipo OR NEW.registro_id <> OLD.registro_id
       OR NEW.tipo_real <> OLD.tipo_real OR NEW.tamanho <> OLD.tamanho
       OR NEW.chave_armazenamento <> OLD.chave_armazenamento OR NEW.hash_sha256 <> OLD.hash_sha256
       OR NEW.autor_envio <> OLD.autor_envio OR NEW.enviado_em <> OLD.enviado_em THEN
        RAISE EXCEPTION 'O arquivo do documento não se altera' USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    IF OLD.situacao = 'removido' THEN
        RAISE EXCEPTION 'O documento removido não volta' USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    RETURN NEW;
END;
$$;
