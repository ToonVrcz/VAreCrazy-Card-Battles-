-- CMS Effect Editor (Phase C): structured effect config next to the legacy text columns.
-- config = { schema:1, system:{...Registry keys...}, content:{ effect_name, special_condition_text }, ack:[{code,by,at}] }
-- Additive and nullable: the engine keeps reading the legacy columns; old rows stay valid (config NULL).
ALTER TABLE card_effects ADD COLUMN config jsonb;
