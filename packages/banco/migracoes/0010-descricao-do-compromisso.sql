-- Descrição do compromisso: o que será tratado, em texto livre (opcional).
-- ---------------------------------------------------------------------------

ALTER TABLE compromisso ADD COLUMN descricao text;

ALTER TABLE compromisso
    ADD CONSTRAINT compromisso_descricao_limitada CHECK (descricao IS NULL OR length(descricao) <= 2000);
