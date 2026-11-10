DELETE FROM affiliation_synergies WHERE affiliation_id IN (SELECT id FROM taxonomy_values WHERE taxonomy_key='affiliation' AND key IN ('among-us','goose-goose-duck','rov','warz','ragnarok','roblox','ghost-story','fivem','board-game'));
DELETE FROM card_affiliations WHERE value_id IN (SELECT id FROM taxonomy_values WHERE taxonomy_key='affiliation' AND key IN ('among-us','goose-goose-duck','rov','warz','ragnarok','roblox','ghost-story','fivem','board-game'));
DELETE FROM taxonomy_values WHERE taxonomy_key='affiliation' AND key IN ('among-us','goose-goose-duck','rov','warz','ragnarok','roblox','ghost-story','fivem','board-game');
DELETE FROM game_rules WHERE key IN ('fusion_stack_stats','story_defaults');
UPDATE game_rules SET value='null'::jsonb, status='proposed', note='อนาคต: ตัวละครเพศเดียวกันจับคู่กันได้พลังเพิ่ม (ยังไม่กำหนดค่า)' WHERE key='gender_pair_bonus';
UPDATE game_rules SET value='{"needs":"fusion_spell","both_cards_in_hand":true,"effect":"boost_power"}'::jsonb WHERE key='fusion_mode';
