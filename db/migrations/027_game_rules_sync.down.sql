DELETE FROM game_rules WHERE key='evolution_sacrifice_same_level';
UPDATE game_rules SET value='true'::jsonb WHERE key='evolution_in_main_deck' AND value='false'::jsonb;
UPDATE game_rules SET value='8000'::jsonb WHERE key='starting_lp' AND value='100'::jsonb;
UPDATE game_rules SET value='{"15":1,"40":2,"70":3}'::jsonb WHERE key='evolution_sacrifice' AND value='{"40":1,"70":2,"99":3}'::jsonb;
