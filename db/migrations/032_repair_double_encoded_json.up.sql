-- The edge DB driver stored jsonb written by the CMS as a JSON string (double-encoded). Fixed in code (src/edge/index.ts, 2026-11-27); this repairs rows already written.
-- card_effects.config: 4 rows were saved through the Admin effect editor. Only values whose text parses as a JSON object are converted.
UPDATE card_effects SET config = (config #>> '{}')::jsonb WHERE jsonb_typeof(config) = 'string' AND left(config #>> '{}', 1) = '{';
-- Online rooms are short-lived; any room created with the broken encoding is unusable, so remove them (players just create a new room).
DELETE FROM play_rooms WHERE jsonb_typeof(tokens) = 'string';
