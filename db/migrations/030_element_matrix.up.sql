-- Element advantage matrix as editable data (Admin > rules). Snapshot is read when a game is created; running games are unaffected.
-- Attacker element -> elements it is strong against (same content as db/seed/elements.json at deploy time). NOT APPLIED to production (owner "Deploy" required).
INSERT INTO game_rules(key,label,value,status,note) VALUES
 ('element_matrix','ตารางธาตุ (ธาตุผู้โจมตี → ธาตุที่ชนะ)','{"fire": ["nature", "poison", "alchemy"], "water": ["fire"], "lightning": ["water"], "earth": ["lightning"], "nature": ["water", "earth"], "poison": ["lightning", "nature"], "alchemy": ["poison"], "dark": ["holy"], "holy": ["dark"], "physical": [], "neutral": [], "wind": ["poison"]}'::jsonb,'confirmed','Toon สั่งใช้ตารางที่ครอบคลุมทุกการ์ด 2026-11-25; แก้แล้วมีผลเฉพาะเกมใหม่')
ON CONFLICT (key) DO NOTHING;
