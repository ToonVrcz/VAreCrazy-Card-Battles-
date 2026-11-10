-- Games the characters have played together (Game Affiliation) + proposed default numbers
INSERT INTO taxonomy_values(taxonomy_key,key,name) VALUES
 ('affiliation','among-us','Among Us'),('affiliation','goose-goose-duck','Goose Goose Duck'),('affiliation','rov','R.O.V'),
 ('affiliation','warz','WarZ'),('affiliation','ragnarok','Ragnarok'),('affiliation','roblox','Roblox'),
 ('affiliation','ghost-story','เล่าเรื่องผี'),('affiliation','fivem','FiveM'),('affiliation','board-game','บอร์ดเกม')
ON CONFLICT DO NOTHING;
-- Team synergy (proposed): 2 players of the same game on the field ATK+5, 3 ATK+10, 4+ ATK+15; highest tier only, no stacking
INSERT INTO affiliation_synergies(affiliation_id,min_members,stat,amount,max_stacks,description)
SELECT v.id, t.m, 'atk', t.a, 1, 'ตัวละครที่เคยเล่นเกมนี้ด้วยกัน อยู่บนสนามพร้อมกัน ATK +'||t.a||' (ข้อเสนอ)'
FROM taxonomy_values v, (VALUES (2,5),(3,10),(4,15)) AS t(m,a)
WHERE v.taxonomy_key='affiliation'
ON CONFLICT DO NOTHING;
UPDATE game_rules SET value='{"stat":"atk","amount":5,"max_stacks":1}'::jsonb,
  note='ข้อเสนอ: ตัวละครเพศเดียวกันอยู่บนสนามพร้อมกัน ≥2 ตัว → ATK +5 ให้ตัวเหล่านั้น (ครั้งเดียวต่อใบ ไม่ซ้อน) เทียบ ATK Lv.15 ราว 10–24 จึงราว +20–50% ซึ่งแรงพอควร อาจลดเป็น +3 ถ้าสนามเต็ม 7 ใบ'
 WHERE key='gender_pair_bonus';
UPDATE game_rules SET value='{"needs":"fusion_spell","both_cards_in_hand":true,"layout":"stack_in_one_slot"}'::jsonb, status='confirmed',
  note='ใช้เวท Fusion เมื่อมีการ์ดทั้งสองใบบนมือ และติ๊กเป็นคู่กันที่การ์ด → วางซ้อนกันเป็นหนึ่งหน่วยในช่องเดียว'
 WHERE key='fusion_mode';
INSERT INTO game_rules(key,label,value,status,note) VALUES
 ('fusion_stack_stats','สเตตัสหน่วยที่ฟิวชั่นแล้ว','{"top_card_percent":100,"bottom_card_percent":50,"default_pair_bonus":{"hp":20,"atk":10,"def":0}}','proposed',
  'ข้อเสนอ: การ์ดบนนับเต็ม + การ์ดล่าง 50% + โบนัสคู่ที่ติ๊กไว้ (ค่าเริ่มต้น HP+20 ATK+10) กินช่องสนามเพียง 1 ช่อง แต่ต้องใช้เวท 1 ใบกับการ์ด 2 ใบ จึงไม่แรงกว่าวางแยกสองช่องมากนัก'),
 ('story_defaults','ค่าเริ่มต้น Story','{"positive":{"stat":"atk","amount":5},"negative":{"stat":"hp","amount":-10},"conditional":{"stat":"atk","amount":10}}','proposed',
  'ข้อเสนอ: Story ที่ไม่ซ้อน; บวก ATK+5, ลบ HP−10, เงื่อนไขพิเศษ ATK+10 (เมื่อเงื่อนไขครบ)')
ON CONFLICT DO NOTHING;
