-- Game rules table aligned with the real engine / owner decisions (2026-11-25). Every UPDATE is guarded by the OLD value.
-- NOT APPLIED to production (owner "Deploy" required). The engine itself never reads these rows (RULES in src/engine/game.ts).
UPDATE game_rules SET value='{"40":1,"70":2,"99":3}'::jsonb, status='confirmed', updated_at=now() WHERE key='evolution_sacrifice' AND value='{"15":1,"40":2,"70":3}'::jsonb;
UPDATE game_rules SET value='100'::jsonb, updated_at=now() WHERE key='starting_lp' AND value='8000'::jsonb;
UPDATE game_rules SET value='false'::jsonb, updated_at=now() WHERE key='evolution_in_main_deck' AND value='true'::jsonb;
INSERT INTO game_rules(key,label,value,status,note) VALUES
 ('evolution_sacrifice_same_level','สังเวยต้องเป็นการ์ดเลเวลเดียวกับตัวที่วิวัฒนาการ','true'::jsonb,'confirmed','Lv40: 1 ใบเลเวล15 · Lv70: 2 ใบเลเวล40 · Lv99: 3 ใบเลเวล70 (Toon 2026-11-25)')
ON CONFLICT (key) DO NOTHING;
