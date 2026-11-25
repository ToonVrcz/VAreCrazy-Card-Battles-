-- Balance round 2 (owner-approved 2026-11-25, handoff balance/full-70-card-handoff): DEF + 5 effect values. HP and ATK are NOT touched.
-- Every statement is guarded by the OLD value, so anything edited in Admin since is never overwritten.
-- NOT APPLIED to production (owner "Deploy" required).
UPDATE cards SET def=2 WHERE character_id='BACKJI-015' AND def=3;
UPDATE cards SET def=2 WHERE character_id='BADGUY-015' AND def=1;
UPDATE cards SET def=1 WHERE character_id='BAM-015' AND def=0;
UPDATE cards SET def=1 WHERE character_id='BAMMIE-015' AND def=0;
UPDATE cards SET def=1 WHERE character_id='BOBO-015' AND def=0;
UPDATE cards SET def=2 WHERE character_id='CHAEM-015' AND def=0;
UPDATE cards SET def=1 WHERE character_id='DNMAN-015' AND def=0;
UPDATE cards SET def=1 WHERE character_id='GOD-WA-015' AND def=0;
UPDATE cards SET def=2 WHERE character_id='I-M-GRAPE-015' AND def=0;
UPDATE cards SET def=1 WHERE character_id='LINLADA-015' AND def=0;
UPDATE cards SET def=3 WHERE character_id='LUCKY-015' AND def=4;
UPDATE cards SET def=1 WHERE character_id='MELON-015' AND def=0;
UPDATE cards SET def=2 WHERE character_id='MIKI-015' AND def=0;
UPDATE cards SET def=1 WHERE character_id='NONG-TAENGMO-015' AND def=0;
UPDATE cards SET def=4 WHERE character_id='NORMAN-015' AND def=3;
UPDATE cards SET def=2 WHERE character_id='PK-015' AND def=0;
UPDATE cards SET def=2 WHERE character_id='PKXCY-015' AND def=0;
UPDATE cards SET def=3 WHERE character_id='SKYMOON-015' AND def=0;
UPDATE cards SET def=1 WHERE character_id='SMILE-015' AND def=0;
UPDATE cards SET def=2 WHERE character_id='SOMYES-015' AND def=0;
UPDATE cards SET def=2 WHERE character_id='THAI26-015' AND def=0;
UPDATE cards SET def=4 WHERE character_id='THAI32-015' AND def=3;
UPDATE cards SET def=2 WHERE character_id='THOMAS-015' AND def=0;
UPDATE cards SET def=4 WHERE character_id='WENDYWENDIE-015' AND def=5;
UPDATE cards SET def=4 WHERE character_id='1GOKU-040' AND def=3;
UPDATE cards SET def=2 WHERE character_id='BADGUY-040' AND def=1;
UPDATE cards SET def=3 WHERE character_id='FOLLOW-YOU-040' AND def=2;
UPDATE cards SET def=4 WHERE character_id='NORMAN-040' AND def=3;
UPDATE cards SET def=3 WHERE character_id='FOLLOW-YOU-070' AND def=2;
UPDATE card_effects SET action_text='ฟื้น HP 10',description='จบเทิร์น ฟื้น HP 10 ให้ตัวละครฝ่ายเรา 1 ใบ (1 ครั้ง/เทิร์น)' WHERE card_id=(SELECT id FROM cards WHERE character_id='SATOSHI-015') AND trigger='turn_end' AND action_text='ฟื้น HP 15' AND description='จบเทิร์น ฟื้น HP 15 ให้ตัวละครฝ่ายเรา 1 ใบ (1 ครั้ง/เทิร์น)';
UPDATE card_effects SET action_text='ฟื้น HP 10',description='จบเทิร์น ฟื้น HP 10 ให้ตัวละครฝ่ายเรา 1 ใบ (1 ครั้ง/เทิร์น)' WHERE card_id=(SELECT id FROM cards WHERE character_id='SATOSHI-040') AND trigger='turn_end' AND action_text='ฟื้น HP 15' AND description='จบเทิร์น ฟื้น HP 15 ให้ตัวละครฝ่ายเรา 1 ใบ (1 ครั้ง/เทิร์น)';
UPDATE card_effects SET action_text='ฟื้น HP 10',description='จบเทิร์น ฟื้น HP 10 ให้ตัวละครฝ่ายเรา 1 ใบ (1 ครั้ง/เทิร์น)' WHERE card_id=(SELECT id FROM cards WHERE character_id='SMILE-015') AND trigger='turn_end' AND action_text='ฟื้น HP 5' AND description='จบเทิร์น ฟื้น HP 5 ให้ตัวละครฝ่ายเรา 1 ใบ (1 ครั้ง/เทิร์น)';
UPDATE card_effects SET action_text='ฟื้น HP 5',description='จบเทิร์น ฟื้น HP 5 ให้ตัวละครฝ่ายเราทุกใบ' WHERE card_id=(SELECT id FROM cards WHERE character_id='LALAPING-040') AND trigger='turn_end' AND action_text='ฟื้น HP 10' AND description='จบเทิร์น ฟื้น HP 10 ให้ตัวละครฝ่ายเราทุกใบ';
UPDATE card_effects SET action_text='ฟื้น HP 50',description='เมื่อวิวัฒนาการเป็นร่างนี้ ฟื้น HP 50 ให้ตัวละครฝ่ายเรา 1 ใบ' WHERE card_id=(SELECT id FROM cards WHERE character_id='LALAPING-070') AND trigger='on_evolve' AND action_text='ฟื้น HP เต็ม' AND description='เมื่อวิวัฒนาการเป็นร่างนี้ ฟื้น HP เต็มให้ตัวละครฝ่ายเรา 1 ใบ';
