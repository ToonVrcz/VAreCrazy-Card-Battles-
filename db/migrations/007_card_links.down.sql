DROP TABLE IF EXISTS card_fusion_partners, card_story_links;
DELETE FROM game_rules WHERE key='gender_pair_bonus';
UPDATE game_rules SET value='null'::jsonb, status='proposed', note='รอผู้ใช้เลือก: สร้างตัวใหม่ / รวมร่างชั่วคราว / ผสานถาวร' WHERE key='fusion_mode';
