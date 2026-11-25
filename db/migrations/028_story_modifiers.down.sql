ALTER TABLE card_story_links DROP CONSTRAINT IF EXISTS card_story_links_modifiers_chk;
ALTER TABLE card_story_links DROP CONSTRAINT IF EXISTS card_story_links_type_chk;
ALTER TABLE card_story_links DROP COLUMN IF EXISTS story_type;
ALTER TABLE card_story_links DROP COLUMN IF EXISTS modifiers;
