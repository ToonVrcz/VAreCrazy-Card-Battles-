DROP TABLE IF EXISTS game_rules, fusion_recipes, story_members, stories, affiliation_synergies, card_affiliations;
ALTER TABLE cards DROP COLUMN IF EXISTS gender_id;
DELETE FROM taxonomy_values WHERE taxonomy_key IN ('affiliation','gender','story_tag');
DELETE FROM taxonomies WHERE key IN ('affiliation','gender','story_tag');
ALTER TABLE cards DROP CONSTRAINT cards_card_type_check;
ALTER TABLE cards ADD CONSTRAINT cards_card_type_check CHECK (card_type IN ('character','evolution','spell','trap','item'));
