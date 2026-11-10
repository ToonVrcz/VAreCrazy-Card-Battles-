-- Game systems from GDD v0.3: gender, Game Affiliation, Story, Team Synergy, Fusion, game rules
ALTER TABLE cards DROP CONSTRAINT cards_card_type_check;
ALTER TABLE cards ADD CONSTRAINT cards_card_type_check
  CHECK (card_type IN ('character','evolution','spell','trap','item','fusion'));

INSERT INTO taxonomies(key,name) VALUES
 ('affiliation','Game Affiliation (สังกัดเกม)'),('gender','เพศ'),('story_tag','Story Tag')
ON CONFLICT DO NOTHING;
INSERT INTO taxonomy_values(taxonomy_key,key,name) VALUES
 ('gender','male','ชาย'),('gender','female','หญิง'),('gender','other','อื่น ๆ / ไม่ระบุ')
ON CONFLICT DO NOTHING;

ALTER TABLE cards ADD COLUMN gender_id uuid REFERENCES taxonomy_values(id);

-- a character may belong to several affiliations (membership = who is eligible)
CREATE TABLE card_affiliations (
  card_id uuid REFERENCES cards(id) ON DELETE CASCADE,
  value_id uuid REFERENCES taxonomy_values(id),
  reason text,                         -- why eligible (e.g. played the game together)
  PRIMARY KEY (card_id, value_id)
);
-- team synergy: bonus depends on member COUNT, with a stack cap (no endless stacking)
CREATE TABLE affiliation_synergies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliation_id uuid NOT NULL REFERENCES taxonomy_values(id),
  min_members int NOT NULL DEFAULT 2 CHECK (min_members >= 2),
  stat text NOT NULL CHECK (stat IN ('hp','atk','def')),
  amount int NOT NULL,
  max_stacks int NOT NULL DEFAULT 1 CHECK (max_stacks >= 1),
  description text,
  UNIQUE (affiliation_id, min_members, stat)
);

CREATE TABLE stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('positive','negative','conditional')),
  stat text CHECK (stat IN ('hp','atk','def')),
  amount int,
  condition_text text,                 -- for conditional stories
  target_text text DEFAULT 'ทุกตัวละครในเรื่องนี้',
  max_stacks int NOT NULL DEFAULT 1 CHECK (max_stacks >= 1),  -- same story never stacks beyond this
  description text
);
CREATE TABLE story_members (            -- by evolution chain: all forms share the story
  story_id uuid REFERENCES stories(id) ON DELETE CASCADE,
  chain_id uuid REFERENCES evolution_chains(id),
  PRIMARY KEY (story_id, chain_id)
);

CREATE TABLE fusion_recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  result_card_id uuid REFERENCES cards(id),            -- a card_type='fusion' (or character) card
  min_materials int NOT NULL DEFAULT 2 CHECK (min_materials >= 2),
  must_match text[] NOT NULL DEFAULT '{}',             -- subset of class, affiliation, element, story
  required_chain_keys text[] NOT NULL DEFAULT '{}',    -- specific characters if the recipe is fixed
  description text,
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE game_rules (
  key text PRIMARY KEY,
  label text NOT NULL,
  value jsonb NOT NULL,
  status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('confirmed','proposed')),
  note text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO game_rules(key,label,value,status,note) VALUES
 ('battlefield_slots','ช่องตัวละครบนสนาม','7','confirmed',NULL),
 ('back_slots','ช่องแถวหลัง','5','confirmed',NULL),
 ('hand_max','จำนวนการ์ดบนมือสูงสุด','5','confirmed',NULL),
 ('summon_quota','โควตาเรียกตัวละคร/เทิร์น','1','confirmed','Lv.15 เรียกฟรี'),
 ('evolution_quota','โควตาวิวัฒนาการ/เทิร์น','1','confirmed','แยกจากโควตาเรียก'),
 ('evolution_sacrifice','จำนวนสังเวยต่อขั้นวิวัฒนาการ','{"15":1,"40":2,"70":3}','confirmed','ระบุตามเลเวลต้นทาง; ตัวละครหงายหน้า'),
 ('evolution_cards_per_step','การ์ด Evolution ต่อขั้น (ใบ)','1','confirmed','จากมือ ไม่ใช้แต้ม/Vrcoin'),
 ('evolution_in_main_deck','การ์ด Evolution อยู่ในเด็คหลัก','true','confirmed',NULL),
 ('evolution_hp_mode','HP หลังวิวัฒนาการ','"keep_damage"','proposed','ร่างใหม่ใช้ HP สูงสุดใหม่ แต่คงความเสียหายที่ได้รับแล้ว (HP ใหม่ = HP สูงสุดใหม่ − ความเสียหายสะสม, อย่างน้อย 1) กันใช้วิวัฒนาการเป็นการฟื้นฟู'),
 ('evolution_keep_status','สถานะผิดปกติคงอยู่หลังวิวัฒนาการ','true','proposed','พิษ/สตัน/คำสาปติดตามไป; บัฟชั่วคราวจนจบเทิร์นหายไป'),
 ('sacrifice_restriction','ข้อจำกัดการสังเวย','{"face_up_only":true,"cannot_sacrifice_evolution_source":true,"cannot_sacrifice_self":true}','proposed','กันสังเวยตัวที่กำลังวิวัฒนาการเอง'),
 ('starting_lp','Life Point เริ่มต้น','8000','proposed','ค่าทดสอบจาก GDD v0.3; รอผู้ใช้ยืนยัน'),
 ('deck_size','จำนวนการ์ดในเด็คหลัก','40','proposed','จาก GDD v0.3'),
 ('max_copies','จำนวนการ์ดชื่อเดียวกันสูงสุดในเด็ค','3','proposed','ตัวละครใน chain เดียวกันนับรวมกัน'),
 ('element_multiplier','ตัวคูณธาตุ (ได้เปรียบ/เสียเปรียบ)','{"strong":1.5,"weak":0.75}','proposed','ดู db/seed/elements.json'),
 ('fusion_mode','รูปแบบ Fusion','null','proposed','รอผู้ใช้เลือก: สร้างตัวใหม่ / รวมร่างชั่วคราว / ผสานถาวร'),
 ('player_damage_rule','ความเสียหายต่อผู้เล่น (LP)','null','proposed','รอกติกา: โจมตีผู้เล่นตรง ๆ และผลต่อ LP')
;
