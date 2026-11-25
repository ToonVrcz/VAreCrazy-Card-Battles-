#!/usr/bin/env python3
"""Generates db/seed/signature-cards.json + db/seed/signature-cards.sql + migration 029 (schema only) (39 Lv.15 signature Spell/Trap cards, draft, 300 Point)."""
import json
def op(o, who=None, stat=None, amount=None, until=None):
    d = {'op': o}
    if who: d['who'] = who
    if stat: d['stat'] = stat
    if amount is not None: d['amount'] = amount
    if until: d['until'] = until
    return d
buff = lambda stat, n, until='turn', who='link': op('buff', who, stat, n, until)
heal = lambda n, who='link': op('heal', who, amount=n)
S, T = 'spell', 'trap'
# (character_id, chain key, name, type, trigger, ops, Thai rules text)
C = [
 ('1GOKU-015','1goku','หมัดทะลวงขีดจำกัด',S,None,[buff('atk',10)],'ต้องมี 1GOKU Lv.15 ในสนาม: ATK +10 จนจบเทิร์นนี้'),
 ('BABY-015','baby','พลังผู้พิทักษ์ตัวน้อย',S,None,[heal(15,'ally')],'ต้องมี BABY Lv.15 ในสนาม: เลือกตัวละครฝั่งเรา 1 ตัว (รวม BABY) ฟื้น HP 15'),
 ('BACKJI-015','backji','สวนกลับฉับพลัน',T,'self_attacked',[buff('atk',10,'battle','victim')],'เมื่อ BACKJI ถูกเลือกเป็นเป้าโจมตี: ATK +10 จนจบการต่อสู้นั้น'),
 ('BADGUY-015','badguy','กลยุทธ์ลวงศัตรู',T,'self_attacked',[buff('atk',-10,'battle','attacker')],'เมื่อ BADGUY ถูกโจมตี: ATK ผู้โจมตี -10 จนจบการต่อสู้นั้น'),
 ('BAM-015','bam','คมดาบเร่งพลัง',S,None,[buff('atk',10)],'ต้องมี BAM Lv.15 ในสนาม: ATK +10 จนจบเทิร์นนี้'),
 ('BAMMIE-015','bammie','ตั้งรับเคียงข้าง',T,'ally_battle_damage',[op('reduce_battle_damage',amount=10)],'เมื่อตัวละครฝั่งเราจะได้รับความเสียหายจากการต่อสู้: ลดลง 10 (ต้องมี BAMMIE ในสนาม)'),
 ('BOBO-015','bobo','ฟันเปิดทาง',S,None,[buff('atk',10,'next_attack')],'ต้องมี BOBO Lv.15 ในสนาม: ATK +10 สำหรับการโจมตีครั้งถัดไปของเทิร์นนี้'),
 ('CHAEM-015','chaem','แผนสำรองของแช่ม',S,None,[buff('def',5,'turn','ally')],'ต้องมี CHAEM Lv.15 ในสนาม: ตัวละครฝั่งเรา 1 ตัว DEF +5 จนจบเทิร์นนี้'),
 ('CUTIE-015','cutie','เวทมนตร์สะกดขวัญ',S,None,[buff('atk',-10,'turn','enemy')],'ต้องมี CUTIE Lv.15 ในสนาม: เลือกตัวละครศัตรู 1 ตัว ATK -10 จนจบเทิร์นนี้'),
 ('DNMAN-015','dnman','คำพิพากษาครูเสด',S,None,[buff('atk',10,'next_attack')],'ต้องมี DNMAN Lv.15 ในสนาม: ATK +10 สำหรับการโจมตีครั้งถัดไปของเทิร์นนี้'),
 ('FOLLOW-YOU-015','follow-you','ส่งกำลังใจ',S,None,[buff('atk',5,'turn','other_ally'),buff('def',5,'turn','other_ally')],'ต้องมี FOLLOW-YOU Lv.15 ในสนาม: ตัวละครฝั่งเราตัวอื่น 1 ตัว ATK +5 และ DEF +5 จนจบเทิร์นนี้'),
 ('GOD-WA-015','god-wa','พันธสัญญานักล่า',T,'kill_by_attack',[heal(10)],'เมื่อ GOD-WA ทำลายตัวละครศัตรูด้วยการโจมตี: GOD-WA ฟื้น HP 10'),
 ('I-M-GRAPE-015','i-m-grape','เถาวัลย์คุ้มกัน',S,None,[buff('def',5,'opp_turn')],'ต้องมี I-M-GRAPE Lv.15 ในสนาม: DEF +5 จนจบเทิร์นถัดไปของคู่ต่อสู้'),
 ('JAOJAY-015','jaojay','กับดักจู่โจมย้อนศร',T,'self_attacked',[buff('atk',-10,'battle','attacker')],'เมื่อ JAOJAY ถูกเลือกเป็นเป้าโจมตี: ATK ผู้โจมตี -10 จนจบการต่อสู้นั้น'),
 ('LALAPING-015','lalaping','พรแห่งการเยียวยา',S,None,[heal(20,'ally')],'ต้องมี LALAPING Lv.15 ในสนาม: ตัวละครฝั่งเรา 1 ตัวฟื้น HP 20'),
 ('LEON-S-KENNEDY-015','leon-s-kennedy','ยุทธวิธีเอาตัวรอด',T,'ally_grave',[buff('def',5)],'เมื่อตัวละครฝั่งเราตัวอื่นลงสุสาน: LEON DEF +5 จนจบเทิร์นนี้'),
 ('LINLADA-015','linlada','หอกพิชิตแนวหน้า',S,None,[buff('atk',10,'next_attack')],'ต้องมี LINLADA Lv.15 ในสนาม: ATK +10 สำหรับการโจมตีครั้งถัดไปของเทิร์นนี้'),
 ('LORDNAM-015','lordnam','เกราะคุ้มกันเจ้าน้ำ',T,'enemy_target',[op('negate_target')],'เมื่อเอฟเฟกต์ของศัตรูเลือก LORDNAM เป็นเป้าหมาย: ยกเลิกผลต่อ LORDNAM (ไม่ยกเลิกเอฟเฟกต์ที่ไม่เลือกเป้าหมายหรือการโจมตี)'),
 ('LUCKY-015','lucky','จังหวะโชคช่วย',T,'self_attacked',[op('redirect_attack')],'เมื่อ LUCKY ถูกเลือกเป็นเป้าโจมตี: ผู้โจมตีต้องเลือกเป้าหมายอื่นถ้ามี ถ้าไม่มีการโจมตีดำเนินต่อตามปกติ'),
 ('MELON-015','melon','พลังนักรบเมลอน',S,None,[buff('atk',10)],'ต้องมี MELON Lv.15 ในสนาม: ATK +10 จนจบเทิร์นนี้'),
 ('MIKI-015','miki','จังหวะเร่งฝีเท้า',S,None,[buff('atk',5),buff('def',5)],'ต้องมี MIKI Lv.15 ในสนาม: ATK +5 และ DEF +5 จนจบเทิร์นนี้'),
 ('MON-015','mon','อ่านเกมขาด',T,'enemy_target',[op('reduce_numeric',amount=5)],'เมื่อเวทมนตร์ของศัตรูเลือก MON เป็นเป้าหมาย: ลดตัวเลขความเสียหาย/การลดค่าสถานะต่อ MON ลง 5 (ถ้าไม่มีตัวเลข กับดักไม่มีผล)'),
 ('NONG-TAENGMO-015','nong-taengmo','แรงฮึดนักสู้',S,None,[buff('atk',10,'next_attack')],'ต้องมี NONG-TAENGMO Lv.15 ในสนาม: ATK +10 สำหรับการโจมตีครั้งถัดไปของเทิร์นนี้'),
 ('NORMAN-015','norman','พลังหมีคำราม',S,None,[buff('def',10)],'ต้องมี NORMAN Lv.15 ในสนาม: DEF +10 จนจบเทิร์นนี้'),
 ('OUFILLING-015','oufilling','สัญญาจากสุสาน',T,'ally_grave',[heal(10)],'เมื่อตัวละครฝั่งเราตัวอื่นลงสุสาน: OUFILLING ฟื้น HP 10'),
 ('PIKACHU-015','pikachu','สายฟ้าช็อตสนาม',S,None,[op('damage','enemy',amount=10)],'ต้องมี PIKACHU Lv.15 ในสนาม: ทำความเสียหาย 10 ใส่ตัวละครศัตรู 1 ตัว'),
 ('PK-015','pk','คำแนะนำจากพีเค',S,None,[buff('def',5,'opp_turn','ally')],'ต้องมี PK Lv.15 ในสนาม: ตัวละครฝั่งเรา 1 ตัว DEF +5 จนจบเทิร์นถัดไปของคู่ต่อสู้'),
 ('PKXCY-015','pkxcy','หมัดประสานพลัง',S,None,[buff('atk',10)],'ต้องมี PKXCY Lv.15 ในสนาม: ATK +10 จนจบเทิร์นนี้'),
 ('SATOSHI-015','satoshi','พรฟื้นฟูซาโตชิ',S,None,[heal(15,'ally')],'ต้องมี SATOSHI Lv.15 ในสนาม: ตัวละครฝั่งเรา 1 ตัวฟื้น HP 15'),
 ('SKYMOON-015','skymoon','โลหะจันทราคุ้มภัย',S,None,[buff('def',10,'turn','ally')],'ต้องมี SKYMOON Lv.15 ในสนาม: ตัวละครฝั่งเรา 1 ตัว DEF +10 จนจบเทิร์นนี้'),
 ('SMILE-015','smile','รอยยิ้มแห่งการปกป้อง',T,'effect_destroy',[op('survive_at_1')],'เมื่อตัวละครฝั่งเราจะถูกทำลายด้วยเอฟเฟกต์ของศัตรู: ป้องกันการทำลาย 1 ครั้ง เหลือ HP 1 (ไม่ป้องกันการทำลายจากการต่อสู้)'),
 ('SOMYES-015','somyes','ศรผนึกพลัง',T,'enemy_attack',[buff('atk',-5,'battle','attacker')],'เมื่อตัวละครศัตรูประกาศโจมตี: ATK ของมัน -5 จนจบการต่อสู้นั้น (ต้องมี SOMYES ในสนาม)'),
 ('TAN-015','tan','แผนค้นหาวิวัฒนาการ',S,None,[op('search_evo_top3')],'ต้องมี TAN Lv.15 ในสนาม: ดูการ์ด 3 ใบบนสุดของเด็ค เปิดการ์ดอีโวลูชั่นที่เจอ เลือก 1 ใบขึ้นมือ ที่เหลือวางใต้เด็คตามเดิม'),
 ('TEE-015','tee','เร่งเครื่องเต็มกำลัง',S,None,[buff('atk',15)],'ต้องมี TEE Lv.15 ในสนาม: ATK +15 จนจบเทิร์นนี้'),
 ('THAI26-015','thai26','คมดาบไทยยี่สิบหก',S,None,[buff('atk',10,'next_attack')],'ต้องมี THAI26 Lv.15 ในสนาม: ATK +10 สำหรับการโจมตีครั้งถัดไปของเทิร์นนี้'),
 ('THAI32-015','thai32','น้ำใจหลังการต่อสู้',T,'self_destroyed',[heal(10,'other_ally')],'เมื่อ THAI32 ถูกทำลายและลงสุสาน: ตัวละครฝั่งเราตัวอื่น 1 ตัวฟื้น HP 10'),
 ('THOMAS-015','thomas','คำสั่งการของโทมัส',S,None,[buff('atk',5,'turn','ally'),op('draw',amount=1)],'ต้องมี THOMAS Lv.15 ในสนาม: ตัวละครฝั่งเรา 1 ตัว ATK +5 จนจบเทิร์นนี้ แล้วจั่ว 1 ใบ (ไม่จั่วถ้ามือเต็ม)'),
 ('WENDYWENDIE-015','wendywendie','จังหวะโจมตีต่อเนื่อง',T,'own_attack',[buff('atk',5,'battle')],'เมื่อ WENDYWENDIE ประกาศโจมตี: ATK +5 สำหรับการโจมตีนั้น (ไม่จั่วการ์ด)'),
 ('ZEESKY-015','zeesky','คลื่นพลังสะท้านฟ้า',S,None,[op('damage','enemy',amount=10)],'ต้องมี ZEESKY Lv.15 ในสนาม: ทำความเสียหาย 10 ใส่ตัวละครศัตรู 1 ตัว'),
]
assert len(C) == 39 and len({c[0] for c in C}) == 39
cid_is_mon = lambda ch: ch == 'MON-015'
cards, sp, tr = [], 10, 10
for ch, key, name, typ, trig, ops, txt in C:
    if typ == S: sp += 1; cid = f'SPL-{sp:03d}'
    else: tr += 1; cid = f'TRP-{tr:03d}'
    sup = {'kind': typ, 'link': key, 'ops': ops}
    if trig: sup['trigger'] = trig
    if cid_is_mon(ch): sup['source'] = 'spell'
    cards.append({'character_id': cid, 'name': name, 'card_type': typ, 'linked_character': ch, 'rules_text': txt, 'shop_price_points': 300, 'status': 'draft', 'image_path': f'assets/cards/{cid}.jpg', 'support': sup})
assert sp == 35 and tr == 24
json.dump(cards, open('db/seed/signature-cards.json', 'w'), ensure_ascii=False, indent=1)
q = lambda x: "'" + x.replace("'", "''") + "'"
hdr = "-- 39 Lv.15 Signature Spell/Trap cards (DRAFT, 300 Point). Run AFTER migration 029. Idempotent. NOT APPLIED to production (owner \"Deploy\" required); publish separately."
ins = [hdr]
for c in cards:
    ins.append(f"INSERT INTO media_assets(storage_path,mime) VALUES ({q(c['image_path'])},'image/jpeg') ON CONFLICT (storage_path) DO NOTHING;")
    ins.append(f"INSERT INTO cards(character_id,name,card_type,rules_text,shop_price_points,status,support,media_id) VALUES ({q(c['character_id'])},{q(c['name'])},{q(c['card_type'])},{q(c['rules_text'])},300,'draft',{q(json.dumps(c['support'], ensure_ascii=False))}::jsonb,(SELECT id FROM media_assets WHERE storage_path={q(c['image_path'])})) ON CONFLICT (character_id) DO NOTHING;")
open('db/seed/signature-cards.sql', 'w', encoding='utf8').write('\n'.join(ins) + '\n')
up = ["-- Signature Spell/Trap cards: `cards.support` holds the engine config (data-driven). Schema only, ADDITIVE. The 39 draft cards are loaded from db/seed/signature-cards.sql at deploy time.",
      "-- NOT APPLIED to production (owner \"Deploy\" required).",
      "ALTER TABLE cards ADD COLUMN IF NOT EXISTS support jsonb;",
      "ALTER TABLE cards ADD CONSTRAINT cards_support_chk CHECK (support IS NULL OR (jsonb_typeof(support)='object' AND card_type IN ('spell','trap')));"]
open('db/migrations/029_signature_cards.up.sql', 'w', encoding='utf8').write('\n'.join(up) + '\n')
open('db/migrations/029_signature_cards.down.sql', 'w').write("DELETE FROM cards WHERE support IS NOT NULL;\nALTER TABLE cards DROP CONSTRAINT IF EXISTS cards_support_chk;\nALTER TABLE cards DROP COLUMN IF EXISTS support;\n")
print(len(cards), 'cards')
