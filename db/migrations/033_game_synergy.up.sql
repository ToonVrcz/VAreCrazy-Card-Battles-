-- Game Synergy goes live (variant B7): units of one side sharing a game group get max HP / DEF while >= 2 DISTINCT units of that group are on the field.
-- No ATK bonus, HP raises the MAX only (no instant heal), per-unit cap in game_rules.synergy_cap. Values per group: see the table below (Among Us is on ~80% of Lv.15 chains, so its DEF is the lowest (+1): sim 2026-11-27 N=40 shows DEF 2->1 moves Tank 41->53 and Control 48->39.5, HP 3 vs 2 makes no difference).
-- 1) replace the unedited "proposal" ATK rows (+5/+10/+15) with HP/DEF rows; groups an admin already edited (no proposal ATK rows left) are not touched
DELETE FROM affiliation_synergies s USING taxonomy_values v
 WHERE v.id=s.affiliation_id AND v.taxonomy_key='affiliation' AND s.stat='atk' AND s.description LIKE '%(ข้อเสนอ)';
INSERT INTO affiliation_synergies(affiliation_id,min_members,stat,amount,max_stacks,description)
SELECT v.id, 2, t.stat, t.amount, 1, 'ตัวละครกลุ่มนี้ ≥2 ตัวอยู่บนสนามพร้อมกัน '||CASE t.stat WHEN 'hp' THEN 'Max HP +' ELSE 'DEF +' END||t.amount||' (เพดานต่อใบ ดู synergy_cap)'
FROM taxonomy_values v JOIN (VALUES
  ('among-us','hp',3),('among-us','def',1),
  ('goose-goose-duck','hp',3),('goose-goose-duck','def',2),
  ('rov','hp',3),('rov','def',2),('warz','hp',3),('warz','def',2),('ghost-story','hp',3),('ghost-story','def',2),
  ('fivem','hp',3),('fivem','def',1),('ragnarok','hp',3),('ragnarok','def',1),('roblox','hp',3),('roblox','def',1),('board-game','hp',3),('board-game','def',1)
) AS t(aff,stat,amount) ON t.aff=v.key
WHERE v.taxonomy_key='affiliation'
  AND NOT EXISTS (SELECT 1 FROM affiliation_synergies x WHERE x.affiliation_id=v.id)      -- only groups with no rows left (i.e. the proposal rows were just removed or never existed)
ON CONFLICT DO NOTHING;
-- 2) per-unit ceiling
INSERT INTO game_rules(key,label,value,status,note) VALUES
 ('synergy_cap','เพดาน Game Synergy ต่อใบ (HP / DEF)','{"hp":10,"def":4}','proposed','เพดานรวมจากทุกกลุ่มต่อหน่วย 1 ใบ: Max HP สูงสุด +10, DEF สูงสุด +4 (ใช้กับเกมใหม่เท่านั้น)')
ON CONFLICT (key) DO NOTHING;
-- 3) Lv.40/70/99 inherit the groups of their chain's Lv.15 card (only cards that have no group rows of their own)
INSERT INTO card_affiliations(card_id,value_id,reason)
SELECT c.id, ca.value_id, 'สืบทอดจาก Lv.15 ของสายเดียวกัน'
FROM cards c JOIN cards b ON b.chain_id=c.chain_id AND b.level=15 AND b.card_type='character'
  JOIN card_affiliations ca ON ca.card_id=b.id
WHERE c.card_type='character' AND c.level>15 AND NOT EXISTS (SELECT 1 FROM card_affiliations x WHERE x.card_id=c.id)
ON CONFLICT DO NOTHING;
