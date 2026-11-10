-- Per-card story partners and fusion partners (picked on the card itself); links are by evolution chain so every form shares them
CREATE TABLE card_story_links (
  card_id uuid REFERENCES cards(id) ON DELETE CASCADE,
  partner_chain_id uuid REFERENCES evolution_chains(id),
  name text NOT NULL,
  stat text CHECK (stat IN ('hp','atk','def')),
  amount int,
  description text,
  PRIMARY KEY (card_id, partner_chain_id)
);
CREATE TABLE card_fusion_partners (
  card_id uuid REFERENCES cards(id) ON DELETE CASCADE,
  partner_chain_id uuid REFERENCES evolution_chains(id),
  hp_bonus int NOT NULL DEFAULT 0, atk_bonus int NOT NULL DEFAULT 0, def_bonus int NOT NULL DEFAULT 0,
  note text,
  PRIMARY KEY (card_id, partner_chain_id)
);
INSERT INTO game_rules(key,label,value,status,note) VALUES
 ('gender_pair_bonus','โบนัสตัวละครเพศเดียวกันจับคู่กัน','null','proposed','อนาคต: ตัวละครเพศเดียวกันจับคู่กันได้พลังเพิ่ม (ยังไม่กำหนดค่า)')
ON CONFLICT DO NOTHING;
UPDATE game_rules SET value='{"needs":"fusion_spell","both_cards_in_hand":true,"effect":"boost_power"}'::jsonb, status='confirmed',
  note='ใช้เวท Fusion เมื่อมีการ์ดทั้งสองใบบนมือ และการ์ดอยู่ในรายชื่อที่ติ๊กไว้ที่การ์ด → เพิ่มพลัง (ยังไม่ชัดว่าผลลัพธ์รวมเป็นใบเดียวหรือไม่)'
 WHERE key='fusion_mode';
