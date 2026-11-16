-- Quem gerou o aviso (por exemplo, quem mencionou). O aviso continua sem texto: só diz quem e onde.
-- ---------------------------------------------------------------------------

ALTER TABLE aviso ADD COLUMN origem_id bigint REFERENCES usuario (id);
