-- Balance round 1 (approved D-2..D-8): DEF values and effect numbers. HP and ATK are NOT touched.
-- Every statement is guarded by the OLD value, so anything edited in Admin since the seed is never overwritten.
-- NOT APPLIED to production (owner approval + deploy order required).
UPDATE cards SET def=3 WHERE character_id='1GOKU-015' AND def=0;
UPDATE cards SET def=3 WHERE character_id='1GOKU-040' AND def=0;
UPDATE card_effects SET description='เมื่อถูกทำลาย ลด HP ตัวละครฝ่ายตรงข้าม 1 ใบ 10',action_text='HP −10',cost_text=NULL,target_text='ตัวละครฝ่ายตรงข้าม 1 ใบ',condition_text=NULL,duration='instant',use_limit='none' WHERE card_id=(SELECT id FROM cards WHERE character_id='1GOKU-040') AND trigger='on_destroyed' AND description='เมื่อถูกทำลาย ลด HP ตัวละครฝ่ายตรงข้าม 1 ใบ 20';
UPDATE cards SET def=5 WHERE character_id='BABY-015' AND def=0;
UPDATE card_effects SET description='เมื่อถูกเรียก ฟื้น HP 30 ให้ตัวละครฝ่ายเรา 1 ใบ',action_text='ฟื้น HP 30',cost_text=NULL,target_text='ตัวละครฝ่ายเรา 1 ใบ',condition_text=NULL,duration='instant',use_limit='once_per_game' WHERE card_id=(SELECT id FROM cards WHERE character_id='BABY-015') AND trigger='on_summon' AND description='เมื่อถูกเรียก ฟื้น HP 20 ให้ตัวละครฝ่ายเรา 1 ใบ';
UPDATE cards SET def=3 WHERE character_id='BACKJI-015' AND def=0;
UPDATE cards SET def=1 WHERE character_id='BADGUY-015' AND def=0;
UPDATE cards SET def=1 WHERE character_id='BADGUY-040' AND def=0;
UPDATE card_effects SET description='เมื่อโจมตีเป้าหมายที่ HP น้อยกว่าตัวเอง ATK +20 จนจบเทิร์น (1 ครั้ง/เทิร์น)',action_text='ATK +20',cost_text=NULL,target_text='ตัวเอง',condition_text='HP ของเป้าหมายน้อยกว่าตัวเอง',duration='until_end_of_turn',use_limit='once_per_turn' WHERE card_id=(SELECT id FROM cards WHERE character_id='BADGUY-040') AND trigger='on_attack' AND description='เมื่อโจมตีเป้าหมายที่ HP น้อยกว่าตัวเอง ATK +25 จนจบเทิร์น (1 ครั้ง/เทิร์น)';
UPDATE card_effects SET description='เมื่อถูกทำลาย ลด HP ตัวละครฝ่ายตรงข้าม 1 ใบ 15',action_text='HP −15',cost_text=NULL,target_text='ตัวละครฝ่ายตรงข้าม 1 ใบ',condition_text=NULL,duration='instant',use_limit='none' WHERE card_id=(SELECT id FROM cards WHERE character_id='BADGUY-040') AND trigger='on_destroyed' AND description='เมื่อถูกทำลาย ลด HP ตัวละครฝ่ายตรงข้าม 1 ใบ 20';
UPDATE card_effects SET description='เมื่อถูกเรียก ลด HP ตัวละครฝ่ายตรงข้าม 1 ใบ 5',action_text='HP −5',cost_text=NULL,target_text='ตัวละครฝ่ายตรงข้าม 1 ใบ',condition_text=NULL,duration='instant',use_limit='once_per_game' WHERE card_id=(SELECT id FROM cards WHERE character_id='CUTIE-015') AND trigger='on_summon' AND description='เมื่อถูกเรียก ลด HP ตัวละครฝ่ายตรงข้าม 1 ใบ 10';
UPDATE card_effects SET description='เมื่อโจมตี ATK +5 จนจบเทิร์น (1 ครั้ง/เทิร์น)',action_text='ATK +5',cost_text=NULL,target_text='ตัวเอง',condition_text=NULL,duration='until_end_of_turn',use_limit='once_per_turn' WHERE card_id=(SELECT id FROM cards WHERE character_id='DNMAN-015') AND trigger='on_attack' AND description='เมื่อโจมตี ATK +10 จนจบเทิร์น (1 ครั้ง/เทิร์น)';
UPDATE cards SET def=2 WHERE character_id='FOLLOW-YOU-015' AND def=0;
UPDATE cards SET def=2 WHERE character_id='FOLLOW-YOU-040' AND def=0;
UPDATE cards SET has_combo=false WHERE character_id='FOLLOW-YOU-040';
UPDATE card_effects SET description='เมื่อโจมตี ATK +20 จนจบเทิร์น (1 ครั้ง/เทิร์น)',action_text='ATK +20',cost_text=NULL,target_text='ตัวเอง',condition_text=NULL,duration='until_end_of_turn',use_limit='once_per_turn' WHERE card_id=(SELECT id FROM cards WHERE character_id='FOLLOW-YOU-040') AND trigger='on_attack' AND description='เมื่อโจมตี ATK +10 จนจบเทิร์น (1 ครั้ง/เทิร์น)';
DELETE FROM card_effects WHERE card_id=(SELECT id FROM cards WHERE character_id='FOLLOW-YOU-040') AND trigger='combo' AND description='พลังแฝง: เมื่อใช้ร่วมกับการ์ดที่มี Combo ใบอื่น ATK +10 จนจบเทิร์น (1 ครั้ง/เทิร์น)';
UPDATE cards SET def=2 WHERE character_id='FOLLOW-YOU-070' AND def=0;
UPDATE cards SET def=4 WHERE character_id='LALAPING-015' AND def=0;
UPDATE cards SET def=6 WHERE character_id='LALAPING-040' AND def=0;
UPDATE cards SET def=6 WHERE character_id='LALAPING-070' AND def=0;
UPDATE cards SET def=3 WHERE character_id='LEON-S-KENNEDY-015' AND def=0;
UPDATE card_effects SET description='เมื่อโจมตี ATK +5 จนจบเทิร์น (1 ครั้ง/เทิร์น)',action_text='ATK +5',cost_text=NULL,target_text='ตัวเอง',condition_text=NULL,duration='until_end_of_turn',use_limit='once_per_turn' WHERE card_id=(SELECT id FROM cards WHERE character_id='LINLADA-015') AND trigger='on_attack' AND description='เมื่อโจมตี ATK +10 จนจบเทิร์น (1 ครั้ง/เทิร์น)';
UPDATE cards SET def=2 WHERE character_id='LORDNAM-015' AND def=0;
UPDATE cards SET def=4 WHERE character_id='LUCKY-015' AND def=0;
UPDATE card_effects SET description='เมื่อโจมตี ATK +5 จนจบเทิร์น (1 ครั้ง/เทิร์น)',action_text='ATK +5',cost_text=NULL,target_text='ตัวเอง',condition_text=NULL,duration='until_end_of_turn',use_limit='once_per_turn' WHERE card_id=(SELECT id FROM cards WHERE character_id='MELON-015') AND trigger='on_attack' AND description='เมื่อโจมตี ATK +10 จนจบเทิร์น (1 ครั้ง/เทิร์น)';
UPDATE card_effects SET description='เมื่อถูกเรียก ทิ้งการ์ดจากมือ 1 ใบ เพื่อจั่วการ์ด 1 ใบ',action_text='จั่ว 1 ใบ',cost_text='ทิ้งการ์ดจากมือ 1 ใบ',target_text='ตัวเอง',condition_text=NULL,duration='instant',use_limit='once_per_game' WHERE card_id=(SELECT id FROM cards WHERE character_id='MON-015') AND trigger='on_summon' AND description='เมื่อถูกเรียก จั่วการ์ด 1 ใบ';
UPDATE cards SET def=3 WHERE character_id='NORMAN-015' AND def=0;
UPDATE cards SET def=3 WHERE character_id='NORMAN-040' AND def=0;
UPDATE cards SET def=4 WHERE character_id='OUFILLING-015' AND def=0;
UPDATE card_effects SET description='เมื่อถูกเรียก ลด HP ตัวละครฝ่ายตรงข้าม 1 ใบ 5',action_text='HP −5',cost_text=NULL,target_text='ตัวละครฝ่ายตรงข้าม 1 ใบ',condition_text=NULL,duration='instant',use_limit='once_per_game' WHERE card_id=(SELECT id FROM cards WHERE character_id='PIKACHU-015') AND trigger='on_summon' AND description='เมื่อถูกเรียก ลด HP ตัวละครฝ่ายตรงข้าม 1 ใบ 10';
UPDATE cards SET def=5 WHERE character_id='SATOSHI-015' AND def=0;
UPDATE card_effects SET description='จบเทิร์น ฟื้น HP 15 ให้ตัวละครฝ่ายเรา 1 ใบ (1 ครั้ง/เทิร์น)',action_text='ฟื้น HP 15',cost_text=NULL,target_text='ตัวละครฝ่ายเรา 1 ใบ',condition_text=NULL,duration='instant',use_limit='once_per_turn' WHERE card_id=(SELECT id FROM cards WHERE character_id='SATOSHI-015') AND trigger='turn_end' AND description='จบเทิร์น ฟื้น HP 10 ให้ตัวละครฝ่ายเรา 1 ใบ (1 ครั้ง/เทิร์น)';
UPDATE cards SET def=5 WHERE character_id='SATOSHI-040' AND def=0;
UPDATE card_effects SET description='จบเทิร์น ฟื้น HP 15 ให้ตัวละครฝ่ายเรา 1 ใบ (1 ครั้ง/เทิร์น)',action_text='ฟื้น HP 15',cost_text=NULL,target_text='ตัวละครฝ่ายเรา 1 ใบ',condition_text=NULL,duration='instant',use_limit='once_per_turn' WHERE card_id=(SELECT id FROM cards WHERE character_id='SATOSHI-040') AND trigger='turn_end' AND description='จบเทิร์น ฟื้น HP 20 ให้ตัวละครฝ่ายเรา 1 ใบ (1 ครั้ง/เทิร์น)';
UPDATE card_effects SET description='เมื่อถูกทำลาย ฟื้น HP 20 ให้ตัวละครฝ่ายเรา 1 ใบ',action_text='ฟื้น HP 20',cost_text=NULL,target_text='ตัวละครฝ่ายเรา 1 ใบ',condition_text=NULL,duration='instant',use_limit='none' WHERE card_id=(SELECT id FROM cards WHERE character_id='SATOSHI-040') AND trigger='on_destroyed' AND description='เมื่อถูกทำลาย ฟื้น HP 30 ให้ตัวละครฝ่ายเรา 1 ใบ';
UPDATE card_effects SET description='จบเทิร์น ฟื้น HP 5 ให้ตัวละครฝ่ายเรา 1 ใบ (1 ครั้ง/เทิร์น)',action_text='ฟื้น HP 5',cost_text=NULL,target_text='ตัวละครฝ่ายเรา 1 ใบ',condition_text=NULL,duration='instant',use_limit='once_per_turn' WHERE card_id=(SELECT id FROM cards WHERE character_id='SMILE-015') AND trigger='turn_end' AND description='จบเทิร์น ฟื้น HP 10 ให้ตัวละครฝ่ายเรา 1 ใบ (1 ครั้ง/เทิร์น)';
UPDATE cards SET def=3 WHERE character_id='TAN-015' AND def=0;
UPDATE cards SET def=4 WHERE character_id='TEE-015' AND def=0;
UPDATE card_effects SET description='เมื่อถูกเรียก ATK +15 จนจบเทิร์น ให้ตัวละครฝ่ายเรา 1 ใบ',action_text='ATK +15',cost_text=NULL,target_text='ตัวละครฝ่ายเรา 1 ใบ',condition_text=NULL,duration='until_end_of_turn',use_limit='once_per_game' WHERE card_id=(SELECT id FROM cards WHERE character_id='TEE-015') AND trigger='on_summon' AND description='เมื่อถูกเรียก ATK +10 จนจบเทิร์น ให้ตัวละครฝ่ายเรา 1 ใบ';
UPDATE cards SET def=6 WHERE character_id='TEE-040' AND def=0;
UPDATE cards SET def=3 WHERE character_id='THAI32-015' AND def=0;
UPDATE cards SET def=5 WHERE character_id='WENDYWENDIE-015' AND def=0;
UPDATE card_effects SET description='เมื่อโจมตี ทิ้งการ์ดจากมือ 1 ใบ เพื่อจั่วการ์ด 1 ใบ (1 ครั้ง/เทิร์น)',action_text='จั่ว 1 ใบ',cost_text='ทิ้งการ์ดจากมือ 1 ใบ',target_text='ตัวเอง',condition_text=NULL,duration='instant',use_limit='once_per_turn' WHERE card_id=(SELECT id FROM cards WHERE character_id='WENDYWENDIE-015') AND trigger='on_attack' AND description='เมื่อโจมตีและทำให้เป้าหมายถูกทำลาย จั่วการ์ด 1 ใบ (1 ครั้ง/เทิร์น)';
UPDATE cards SET def=3 WHERE character_id='ZEESKY-015' AND def=0;
UPDATE cards SET rules_text='ใช้ในเฟสหลัก
เลือกตัวละครของคุณ 1 ตัว: DEF +15 จนจบเทิร์น (ใช้ได้ 1 ครั้งต่อตัวต่อเทิร์น)' WHERE character_id='SPL-003' AND rules_text='ใช้ในเฟสหลัก
เลือกตัวละครของคุณ 1 ตัว: DEF +15 อยู่จนกว่าตัวนั้นจะออกจากสนาม';
UPDATE cards SET rules_text='ใช้ในเฟสหลัก
เลือกตัวละครของคุณ 1 ตัว: ATK +15 จนจบเทิร์น (ใช้ได้ 1 ครั้งต่อตัวต่อเทิร์น)' WHERE character_id='SPL-004' AND rules_text='ใช้ในเฟสหลัก
เลือกตัวละครของคุณ 1 ตัว: ATK +15 อยู่จนกว่าตัวนั้นจะออกจากสนาม';
