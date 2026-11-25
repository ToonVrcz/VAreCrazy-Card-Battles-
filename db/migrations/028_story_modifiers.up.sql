-- Story links: allow several modifiers per Story (Positive / Negative / Mixed). ADDITIVE ONLY:
-- existing rows keep stat/amount exactly as they are (modifiers stays NULL); the engine reads `modifiers` when present, otherwise stat/amount.
-- NOT APPLIED to production (owner "Deploy" required).
ALTER TABLE card_story_links ADD COLUMN IF NOT EXISTS modifiers jsonb;
ALTER TABLE card_story_links ADD COLUMN IF NOT EXISTS story_type text;
ALTER TABLE card_story_links ADD CONSTRAINT card_story_links_type_chk CHECK (story_type IS NULL OR story_type IN ('positive','negative','mixed'));
ALTER TABLE card_story_links ADD CONSTRAINT card_story_links_modifiers_chk CHECK (modifiers IS NULL OR jsonb_typeof(modifiers)='array');
