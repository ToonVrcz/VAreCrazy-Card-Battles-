-- Remove inherited group rows and the cap; restore the original proposal ATK rows (+5/+10/+15) for groups that now hold the migration's HP/DEF rows.
DELETE FROM card_affiliations WHERE reason='สืบทอดจาก Lv.15 ของสายเดียวกัน';
DELETE FROM game_rules WHERE key='synergy_cap';
DELETE FROM affiliation_synergies s USING taxonomy_values v WHERE v.id=s.affiliation_id AND v.taxonomy_key='affiliation' AND s.stat IN ('hp','def') AND s.min_members=2 AND s.description LIKE '%ดู synergy_cap%';
INSERT INTO affiliation_synergies(affiliation_id,min_members,stat,amount,max_stacks,description)
SELECT v.id, t.m, 'atk', t.a, 1, 'ตัวละครที่เคยเล่นเกมนี้ด้วยกัน อยู่บนสนามพร้อมกัน ATK +'||t.a||' (ข้อเสนอ)'
FROM taxonomy_values v, (VALUES (2,5),(3,10),(4,15)) AS t(m,a)
WHERE v.taxonomy_key='affiliation' AND NOT EXISTS (SELECT 1 FROM affiliation_synergies x WHERE x.affiliation_id=v.id)
ON CONFLICT DO NOTHING;
