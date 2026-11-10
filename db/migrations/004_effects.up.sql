-- Structured effects per card (declarative Rule Builder fields; no arbitrary code)
CREATE TABLE card_effects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  sort_order int NOT NULL DEFAULT 0,
  trigger text NOT NULL CHECK (trigger IN
    ('on_summon','on_evolve','on_attack','on_destroyed','turn_start','turn_end','to_graveyard','passive','combo')),
  condition_text text,
  cost_text text,
  target_text text,
  action_text text,
  duration text NOT NULL DEFAULT 'instant'
    CHECK (duration IN ('instant','until_end_of_turn','n_turns','permanent')),
  duration_turns int CHECK (duration_turns IS NULL OR duration_turns > 0),
  use_limit text NOT NULL DEFAULT 'none' CHECK (use_limit IN ('none','once_per_turn','once_per_game')),
  description text NOT NULL CHECK (length(description) BETWEEN 1 AND 500)  -- shown to players
);
CREATE INDEX card_effects_card_idx ON card_effects(card_id, sort_order);

-- published snapshot now includes effects
CREATE OR REPLACE FUNCTION snapshot_published() RETURNS trigger AS $$
BEGIN
  IF NEW.status='published' AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM 'published') THEN
    INSERT INTO card_versions(card_id,version_no,snapshot)
    VALUES (NEW.id, NEW.version_no, to_jsonb(NEW) || jsonb_build_object('effects',
      COALESCE((SELECT jsonb_agg(to_jsonb(e) - 'card_id' ORDER BY e.sort_order) FROM card_effects e WHERE e.card_id=NEW.id), '[]'::jsonb)));
  END IF;
  RETURN NULL;
END $$ LANGUAGE plpgsql;
