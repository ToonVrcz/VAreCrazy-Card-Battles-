import json
P='db/seed/toon-cards.json'; cards=json.load(open(P))
FL={
'OUFILLING-015':'ผีน้อยรอบกายไม่เคยทำให้เขาสะดุ้ง มีแต่เขาที่ทำให้พวกมันขำ',
'FOLLOW-YOU-015':'เขาไม่ได้เรียกปีศาจ... ปีศาจต่างหากที่ตามเขามา','FOLLOW-YOU-040':'เปลวไฟสีม่วงตอบรับเสียงเรียกของเขา','FOLLOW-YOU-070':'สายฟ้าแดงฉานกลายเป็นคำสั่งของเขา',
'BAMMIE-015':'คลื่นน้ำหลีกทางให้ดาบของเธอ','SOMYES-015':'ลูกธนูสายฟ้าไม่เคยพลาดเป้า','THOMAS-015':'ในกองเพลิง เงามืดคือที่ซ่อนที่ดีที่สุด',
'PIKACHU-015':'เด็กหนุ่มผมทองผู้เรียกสายฟ้าได้ดั่งใจ','CUTIE-015':'เถาวัลย์เขียวเลื้อยตามทุกจังหวะของเวทมนตร์','SMILE-015':'รอยยิ้มของเธอทำให้ฟองน้ำกลายเป็นเกราะ',
'JAOJAY-015':'มีดคู่และสายน้ำ จบงานก่อนใครทันตั้งตัว','BABY-015':'ลิงน้อยบนแขนช่วยให้ทุกคนใจเย็นลง','SATOSHI-015':'คัมภีร์เล่มเล็กที่ให้แสงอุ่น ๆ แก่ทุกคน',
'LINLADA-015':'หอกเพลิงที่ลุกโชนตามก้าวเดินของเธอ','BADGUY-015':'ใต้ผ้าคลุมมีแต่ความเงียบกับเปลวพิษสีเขียว','BADGUY-040':'สูตรยาพิษของเขากลายเป็นศิลปะ',
'NORMAN-015':'หมีที่รบด้วยเกียรติ ไม่ใช่ด้วยความหิว','NORMAN-040':'เกราะทองและดาบเพลิงแห่งป่าลึก','NONG-TAENGMO-015':'มีดคู่ใบไม้ กับหมวกหูแมวที่ฟังเสียงป่าทุกใบ',
'BOBO-015':'ตัวเล็กแต่ใจใหญ่ ยืนหน้าสุดเสมอ','LALAPING-015':'ผลึกชมพูในไม้เท้าส่องแสงทุกครั้งที่เธอยิ้ม','LALAPING-040':'หมวกบิชอปคือคำสัญญาว่าจะไม่มีใครถูกทิ้งไว้ข้างหลัง','LALAPING-070':'แสงบริสุทธิ์ที่แม้ความมืดยังต้องหยุดฟัง',
'WENDYWENDIE-015':'แว่นสีแดงกับรอยยิ้มที่ไม่ควรไว้ใจ','MON-015':'ชาร้อนหนึ่งถ้วยแลกข่าวสารได้หนึ่งเรื่อง','TEE-015':'สูตรลับในขวดเขียว ลองแล้วอย่าถามว่ามีอะไรผสม','TEE-040':'เสียงหัวเราะดังกว่าระเบิดยาเสียอีก',
'1GOKU-015':'กล้ามที่ฝึกมาทุกเช้า ไม่มีใครเรียกว่าโชคดี','1GOKU-040':'เกราะเพลิงสีแดง ยิ่งโมโหยิ่งร้อน','GOD-WA-015':'ผ้าคลุมดำ ขวดเขียว และมีดเล็ก ๆ ที่พร้อมเสมอ','DNMAN-015':'โล่กลมกับหมัดที่ตรงไปตรงมา',
'BAM-015':'ชุดเกราะดำและดาบเพลิง เดินผ่านไฟโดยไม่หันกลับ','MELON-015':'ขวานหนักกับเกราะทองจากเหมืองลึก','TAN-015':'แมวไซเบอร์ที่ซ่อนอยู่ในวงจร รอคำสั่งเรียก','THAI26-015':'ในลิฟต์ที่แคบที่สุด เขาก็ยังสู้ได้เต็มกำลัง',
'CHAEM-015':'ป้าย "Good Deals" ไม่เคยโกหก ถ้าเธอพยักหน้า','PKXCY-015':'แครอทยักษ์ในอ้อมแขน คือกำลังใจที่ดีที่สุด','ZEESKY-015':'บล็อกสายฟ้าต่อเป็นเวทมนตร์ได้ในพริบตา','I-M-GRAPE-015':'เปลวไฟและตำราธรรมชาติในมือเดียว',
'SKYMOON-015':'ทุกค้อนที่ตีลงทั่ง คือคำสาบานของช่างตีเหล็ก','THAI32-015':'พาลาดินที่เชื่อว่าพลังมาจากมื้ออร่อยและอารมณ์ดี','PK-015':'แมวพ่อค้าหน้าตึง ถุงทองหนักกว่าที่เห็น','MIKI-015':'ยิ้มกว้างในเกราะแดง สู้ไปหัวเราะไป',
'LEON-S-KENNEDY-015':'ไม้เท้ากะโหลกเรียกซอมบี้ได้ แต่เขาเลือกที่จะนำทางพวกมัน','LORDNAM-015':'เงาควันและแมวตาแดงเป็นองครักษ์ส่วนตัว','LUCKY-015':'หมวกดอกไม้ ดาบสั้น และสายน้ำที่พุ่งตามเธอ','BACKJI-015':'ประกายม่วงที่ฝ่ามือคือสิ่งสุดท้ายที่ศัตรูเห็น'}
def E(trigger,desc,action=None,target=None,cond=None,cost=None,dur='instant',turns=None,limit='none'):
    return dict(trigger=trigger,description=desc,action_text=action,target_text=target,condition_text=cond,cost_text=cost,duration=dur,duration_turns=turns,use_limit=limit)
EOT='until_end_of_turn'
melee=lambda:[E('on_attack','เมื่อโจมตี ATK +10 จนจบเทิร์น (1 ครั้ง/เทิร์น)','ATK +10','ตัวเอง',dur=EOT,limit='once_per_turn')]
archer=lambda:[E('on_summon','เมื่อถูกเรียก เลือกตัวละครฝ่ายตรงข้าม 1 ใบ ATK −10 จนจบเทิร์น','ATK −10','ตัวละครฝ่ายตรงข้าม 1 ใบ',dur=EOT,limit='once_per_game')]
rogue=lambda:[E('on_summon','เมื่อถูกเรียก ทิ้งการ์ดจากมือ 1 ใบ เพื่อจั่วการ์ด 1 ใบ','จั่ว 1 ใบ','ตัวเอง',cost='ทิ้งการ์ดจากมือ 1 ใบ',limit='once_per_game')]
thief=lambda:[E('on_attack','เมื่อโจมตีและทำให้เป้าหมายถูกทำลาย จั่วการ์ด 1 ใบ (1 ครั้ง/เทิร์น)','จั่ว 1 ใบ','ตัวเอง',cond='เป้าหมายถูกทำลายจากการโจมตี',limit='once_per_turn')]
assassin=lambda:[E('on_attack','เมื่อโจมตีเป้าหมายที่ HP น้อยกว่าตัวเอง ATK +15 จนจบเทิร์น (1 ครั้ง/เทิร์น)','ATK +15','ตัวเอง',cond='HP ของเป้าหมายน้อยกว่าตัวเอง',dur=EOT,limit='once_per_turn')]
ninja=lambda:[E('on_summon','ในเทิร์นที่ถูกเรียก จะไม่ถูกเลือกเป็นเป้าหมายของเอฟเฟกต์ฝ่ายตรงข้าม','ป้องกันการเลือกเป็นเป้าหมาย','ตัวเอง',dur=EOT)]
mage=lambda:[E('on_summon','เมื่อถูกเรียก ลด HP ตัวละครฝ่ายตรงข้าม 1 ใบ 10','HP −10','ตัวละครฝ่ายตรงข้าม 1 ใบ',limit='once_per_game')]
druid=lambda:[E('turn_start','เริ่มเทิร์น ATK +5 ถาวร (สูงสุด +15)','ATK +5 ถาวร (สูงสุด +15)','ตัวเอง',dur='permanent')]
healer=lambda:[E('turn_end','จบเทิร์น ฟื้น HP 10 ให้ตัวละครฝ่ายเรา 1 ใบ (1 ครั้ง/เทิร์น)','ฟื้น HP 10','ตัวละครฝ่ายเรา 1 ใบ',limit='once_per_turn')]
acolyte=lambda:[E('on_summon','เมื่อถูกเรียก ฟื้น HP 20 ให้ตัวละครฝ่ายเรา 1 ใบ','ฟื้น HP 20','ตัวละครฝ่ายเรา 1 ใบ',limit='once_per_game')]
merchant=lambda:[E('on_summon','เมื่อถูกเรียก จั่วการ์ด 1 ใบ','จั่ว 1 ใบ','ตัวเอง',limit='once_per_game')]
paladin=lambda:[E('on_destroyed','เมื่อถูกทำลาย ฟื้น HP 20 ให้ตัวละครฝ่ายเรา 1 ใบ','ฟื้น HP 20','ตัวละครฝ่ายเรา 1 ใบ')]
smith=lambda:[E('on_summon','เมื่อถูกเรียก ATK +10 ถาวร ให้ตัวละครฝ่ายเรา 1 ใบ','ATK +10 ถาวร','ตัวละครฝ่ายเรา 1 ใบ',dur='permanent',limit='once_per_game')]
necro=lambda:[E('to_graveyard','เมื่อตัวละครฝ่ายเราลงสุสาน ATK +5 จนจบเทิร์น (1 ครั้ง/เทิร์น)','ATK +5','ตัวเอง',dur=EOT,limit='once_per_turn')]
dev=lambda:[E('on_summon','เมื่อถูกเรียก ค้นการ์ด Evolution 1 ใบจาก Main Deck ขึ้นมือ','ค้นการ์ด Evolution ขึ้นมือ','Main Deck',limit='once_per_game')]
CLS={'Necromancer':necro,'Swordswoman':melee,'Swordsman':melee,'Warrior':melee,'Fighter':melee,'Bear Warrior':melee,'Crusader':melee,'Spearwoman':melee,
'Archer':archer,'Rogue':rogue,'Thief':thief,'Assassin':assassin,'Ninja':ninja,'Mage':mage,'Storm Priest':mage,'Druid':druid,'Cleric':healer,'Priest':healer,'Healer':healer,
'Acolyte':acolyte,'Merchant':merchant,'Paladin':paladin,'Blacksmith':smith,'Dev Sumoner':dev}
CUSTOM={
'FOLLOW-YOU-015':[E('on_summon','เมื่อถูกเรียก จั่วการ์ด 1 ใบ','จั่ว 1 ใบ','ตัวเอง',limit='once_per_game')],
'FOLLOW-YOU-040':[E('on_attack','เมื่อโจมตี ATK +10 จนจบเทิร์น (1 ครั้ง/เทิร์น)','ATK +10','ตัวเอง',dur=EOT,limit='once_per_turn'),E('combo','พลังแฝง: เมื่อใช้ร่วมกับการ์ดที่มี Combo ใบอื่น ATK +10 จนจบเทิร์น (1 ครั้ง/เทิร์น)','ATK +10','ตัวเอง',cond='มีการ์ด Combo ใบอื่นบนสนาม',dur=EOT,limit='once_per_turn')],
'FOLLOW-YOU-070':[E('on_evolve','เมื่อวิวัฒนาการเป็นร่างนี้ ลด HP ตัวละครฝ่ายตรงข้าม 1 ใบ 30','HP −30','ตัวละครฝ่ายตรงข้าม 1 ใบ'),E('passive','ต่อเนื่อง: ตัวละครฝ่ายเราทุกใบ ATK +5','ATK +5','ตัวละครฝ่ายเราทุกใบ',dur='permanent')],
'TEE-015':[E('on_summon','เมื่อถูกเรียก ATK +10 จนจบเทิร์น ให้ตัวละครฝ่ายเรา 1 ใบ','ATK +10','ตัวละครฝ่ายเรา 1 ใบ',dur=EOT,limit='once_per_game')],
'TEE-040':[E('on_evolve','เมื่อวิวัฒนาการเป็นร่างนี้ ATK +20 จนจบเทิร์น ให้ตัวละครฝ่ายเรา 1 ใบ','ATK +20','ตัวละครฝ่ายเรา 1 ใบ',dur=EOT),E('turn_end','จบเทิร์น ฟื้น HP 10 ให้ตัวเอง','ฟื้น HP 10','ตัวเอง')],
'LALAPING-040':[E('turn_end','จบเทิร์น ฟื้น HP 10 ให้ตัวละครฝ่ายเราทุกใบ','ฟื้น HP 10','ตัวละครฝ่ายเราทุกใบ')],
'LALAPING-070':[E('on_evolve','เมื่อวิวัฒนาการเป็นร่างนี้ ฟื้น HP เต็มให้ตัวละครฝ่ายเรา 1 ใบ','ฟื้น HP เต็ม','ตัวละครฝ่ายเรา 1 ใบ'),E('passive','ต่อเนื่อง: ตัวละครฝ่ายเราทุกใบ HP +10','HP +10','ตัวละครฝ่ายเราทุกใบ',dur='permanent')],
'BADGUY-040':[E('on_attack','เมื่อโจมตีเป้าหมายที่ HP น้อยกว่าตัวเอง ATK +25 จนจบเทิร์น (1 ครั้ง/เทิร์น)','ATK +25','ตัวเอง',cond='HP ของเป้าหมายน้อยกว่าตัวเอง',dur=EOT,limit='once_per_turn'),E('on_destroyed','เมื่อถูกทำลาย ลด HP ตัวละครฝ่ายตรงข้าม 1 ใบ 20','HP −20','ตัวละครฝ่ายตรงข้าม 1 ใบ')],
'NORMAN-040':[E('on_attack','เมื่อโจมตี ATK +20 จนจบเทิร์น (1 ครั้ง/เทิร์น)','ATK +20','ตัวเอง',dur=EOT,limit='once_per_turn'),E('turn_start','เริ่มเทิร์น ฟื้น HP 10 ให้ตัวเอง','ฟื้น HP 10','ตัวเอง')],
'SATOSHI-040':[E('turn_end','จบเทิร์น ฟื้น HP 20 ให้ตัวละครฝ่ายเรา 1 ใบ (1 ครั้ง/เทิร์น)','ฟื้น HP 20','ตัวละครฝ่ายเรา 1 ใบ',limit='once_per_turn'),E('on_destroyed','เมื่อถูกทำลาย ฟื้น HP 30 ให้ตัวละครฝ่ายเรา 1 ใบ','ฟื้น HP 30','ตัวละครฝ่ายเรา 1 ใบ')],
'1GOKU-040':[E('on_attack','เมื่อโจมตี ATK +20 จนจบเทิร์น (1 ครั้ง/เทิร์น)','ATK +20','ตัวเอง',dur=EOT,limit='once_per_turn'),E('on_destroyed','เมื่อถูกทำลาย ลด HP ตัวละครฝ่ายตรงข้าม 1 ใบ 20','HP −20','ตัวละครฝ่ายตรงข้าม 1 ใบ')],
}
ELEM={'fire':'fire','fire_mp':'fire','water':'water','lightning':'lightning','leaf':'nature','mp_green':'nature','mp_blue':'water','moon':'dark','purple_flame':'dark','skull':'dark','smoke':'dark','demon':'dark','sun':'holy','cross':'holy','halo':'holy','drop_green':'poison','potion_purple':'poison','potion_mortar':'alchemy','swords':'physical','coin':'neutral','rock_mp':'earth'}
FL.update({'SATOSHI-040':'แสงในคัมภีร์สว่างพอจะฟื้นแม้ผู้ที่ล้มลงแล้ว'})
for c in cards:
    k=c['character_id']
    c['effects']=CUSTOM.get(k) or CLS[c['name']]()
    c['flavor_text']=FL[k]; c['class']=c['name']; c['element']=ELEM[c['atk_icon']]
    for _k,_v in {'LALAPING':'holy','THAI32-015':'holy','1GOKU':'fire','TEE':'poison'}.items():  # owner overrides
        if c['character_id'].startswith(_k): c['element']=_v
    c['has_combo']=k in ('FOLLOW-YOU-040','FOLLOW-YOU-070')
json.dump(cards,open(P,'w'),ensure_ascii=False,indent=1)
print(len(cards),sum(len(c['effects']) for c in cards))
missing=[c['character_id'] for c in cards if c['name'] not in CLS and c['character_id'] not in CUSTOM]; print('missing',missing)
