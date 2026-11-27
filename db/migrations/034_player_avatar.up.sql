-- Player avatars: a gallery the player picks from (Lv.15 character art + images the admin uploads). Additive only:
-- no change to authentication, wallet, cards or any existing column.
CREATE TABLE avatars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  media_id uuid REFERENCES media_assets(id),        -- an uploaded image, or ...
  card_id text,                                      -- ... a character card whose art is reused (cards.character_id)
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((media_id IS NOT NULL) <> (card_id IS NOT NULL))
);
CREATE UNIQUE INDEX avatars_card_uq ON avatars(card_id) WHERE card_id IS NOT NULL;
ALTER TABLE players ADD COLUMN avatar_id uuid REFERENCES avatars(id) ON DELETE SET NULL;   -- NULL = default avatar

-- First set: every published Lv.15 character.
INSERT INTO avatars(label, card_id, sort_order)
SELECT name, character_id, (row_number() OVER (ORDER BY character_id))::int
FROM cards WHERE card_type='character' AND level=15 AND status='published' AND media_id IS NOT NULL;
