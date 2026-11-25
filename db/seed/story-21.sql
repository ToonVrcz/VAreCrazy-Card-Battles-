-- 21 new Story links (8 positive / 8 negative / 5 mixed), owner-designed; the 8 existing rows are never touched.
-- Requires migration 028 (modifiers, story_type). Idempotent. NOT APPLIED to production (owner "Deploy" required).
-- Directional like the engine: chain `a` gets the modifiers while chain `b` is on its field. Rows attach to the Lv.15 card of chain `a`.
INSERT INTO card_story_links(card_id, partner_chain_id, name, stat, amount, modifiers, story_type)
SELECT c.id, pb.id, v.name, v.stat, v.amount, v.mods, v.stype
FROM (VALUES
 ('baby','bammie','เพื่อนเก่าที่กลับมา','atk',5,'[{"stat": "atk", "amount": 5}]'::jsonb,'positive'),
 ('lalaping','thomas','ผู้ช่วยชีวิต','hp',10,'[{"stat": "hp", "amount": 10}]'::jsonb,'positive'),
 ('lordnam','lucky','สัญญาแห่งโชคชะตา','def',5,'[{"stat": "def", "amount": 5}]'::jsonb,'positive'),
 ('bobo','linlada','คู่หูนักสู้','atk',5,'[{"stat": "atk", "amount": 5}]'::jsonb,'positive'),
 ('chaem','pk','นักวางแผน','hp',5,'[{"stat": "hp", "amount": 5}]'::jsonb,'positive'),
 ('god-wa','jaojay','คู่หูนักอัญเชิญ','atk',5,'[{"stat": "atk", "amount": 5}]'::jsonb,'positive'),
 ('leon-s-kennedy','oufilling','คู่หูผู้พิทักษ์','def',5,'[{"stat": "def", "amount": 5}]'::jsonb,'positive'),
 ('melon','thai32','สหายร่วมสนาม','hp',5,'[{"stat": "hp", "amount": 5}]'::jsonb,'positive'),
 ('cutie','pikachu','ศึกจอมเวท','atk',-5,'[{"stat": "atk", "amount": -5}]'::jsonb,'negative'),
 ('norman','thai26','ศึกนักรบต่างขั้ว','def',-5,'[{"stat": "def", "amount": -5}]'::jsonb,'negative'),
 ('wendywendie','nong-taengmo','โจรแย่งผลงาน','atk',-5,'[{"stat": "atk", "amount": -5}]'::jsonb,'negative'),
 ('pkxcy','miki','ศักดิ์ศรีนักสู้','def',-5,'[{"stat": "def", "amount": -5}]'::jsonb,'negative'),
 ('follow-you','god-wa','นักอัญเชิญกับหัวขโมย','atk',-5,'[{"stat": "atk", "amount": -5}]'::jsonb,'negative'),
 ('tan','mon','ธุรกิจที่ไม่ลงตัว','hp',-5,'[{"stat": "hp", "amount": -5}]'::jsonb,'negative'),
 ('zeesky','skymoon','พายุเหนือโรงตีเหล็ก','def',-5,'[{"stat": "def", "amount": -5}]'::jsonb,'negative'),
 ('bobo','bam','ศึกชิงความเป็นหนึ่ง','atk',-5,'[{"stat": "atk", "amount": -5}]'::jsonb,'negative'),
 ('badguy','norman','คู่หูสายบุก','atk',10,'[{"stat": "atk", "amount": 10}, {"stat": "def", "amount": -5}]'::jsonb,'mixed'),
 ('cutie','somyes','เวทมนตร์และธนู','atk',5,'[{"stat": "atk", "amount": 5}, {"stat": "hp", "amount": -5}]'::jsonb,'mixed'),
 ('lalaping','satoshi','ผู้รักษาสองขั้ว','hp',10,'[{"stat": "hp", "amount": 10}, {"stat": "atk", "amount": -5}]'::jsonb,'mixed'),
 ('backji','god-wa','คู่หูนักลอบโจมตี','atk',10,'[{"stat": "atk", "amount": 10}, {"stat": "def", "amount": -5}]'::jsonb,'mixed'),
 ('thai26','bammie','นักดาบประสานพลัง','atk',5,'[{"stat": "atk", "amount": 5}, {"stat": "hp", "amount": -5}]'::jsonb,'mixed')
) AS v(a, b, name, stat, amount, mods, stype)
JOIN evolution_chains pa ON pa.key = v.a JOIN evolution_chains pb ON pb.key = v.b
JOIN cards c ON c.chain_id = pa.id AND c.level = 15
ON CONFLICT (card_id, partner_chain_id) DO NOTHING;
