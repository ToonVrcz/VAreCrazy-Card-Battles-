"""Generates 10 Evolution Cards + 10 Fusion Spells (DRAFT proposals) + placeholder art.
Run: python3 src/gen-support-cards.py  -> assets/cards/EVO-*.jpg, FUS-*.jpg, db/seed/support-cards.json
All numbers are proposals; owner edits in Admin."""
import json, math
from PIL import Image, ImageDraw, ImageFilter
W, H, S = 700, 770, 2
EVO = [  # id, name, element, color, effect text, stat, amount, flavor
 ('EVO-001','เปลวเพลิงแห่งการเติบโต','fire',(235,96,40),'ร่างที่วิวัฒนาการ ATK +10 จนจบเทิร์น','ATK +10','ATK',10,'ไฟที่เผาตัวเก่า เพื่อให้ตัวใหม่ลืมตา'),
 ('EVO-002','สายน้ำฟื้นฟู','water',(52,140,230),'ร่างที่วิวัฒนาการ ฟื้นฟู HP 20','HP +20','HP',20,'ทุกร่างเริ่มต้นจากหยดเดียว'),
 ('EVO-003','ฟ้าผ่าปลุกพลัง','lightning',(240,200,40),'ร่างที่วิวัฒนาการ ATK +15 จนจบเทิร์น','ATK +15','ATK',15,'ฟ้าผ่าครั้งเดียว ก็ไม่ใช่คนเดิมแล้ว'),
 ('EVO-004','หินผาแกร่ง','earth',(160,110,60),'ร่างที่วิวัฒนาการ DEF +10 จนจบเทิร์น','DEF +10','DEF',10,'ภูเขาไม่เคยรีบ แต่ไม่เคยล้ม'),
 ('EVO-005','รากไม้ตื่นรู้','nature',(70,170,80),'ร่างที่วิวัฒนาการ ฟื้นฟู HP 30','HP +30','HP',30,'รากที่หยั่งลึกที่สุด ชูยอดสูงที่สุด'),
 ('EVO-006','หยดพิษพลิกร่าง','poison',(130,70,190),'ร่างที่วิวัฒนาการ ATK +10 จนจบเทิร์น','ATK +10','ATK',10,'ยาที่ไม่ฆ่า ทำให้แกร่งขึ้น'),
 ('EVO-007','สูตรลับแปรธาตุ','alchemy',(220,130,190),'ร่างที่วิวัฒนาการ ฟื้นฟู HP 10 และ ATK +5 จนจบเทิร์น','HP +10 / ATK +5','HP',10,'สูตรที่ถูกต้องคือ ความกล้าลองผิด'),
 ('EVO-008','จันทร์เสี้ยวปลดผนึก','dark',(70,60,140),'ร่างที่วิวัฒนาการ ATK +20 จนจบเทิร์น','ATK +20','ATK',20,'ผนึกแตก เมื่อคืนที่มืดที่สุด'),
 ('EVO-009','แสงสว่างแห่งชัยชนะ','holy',(250,230,150),'ร่างที่วิวัฒนาการ ฟื้นฟู HP 10 และ DEF +10 จนจบเทิร์น','HP +10 / DEF +10','DEF',10,'แสงแรกของวันใหม่ เป็นของผู้ที่ยังยืนอยู่'),
 ('EVO-010','ลมพัดพาโชค','wind',(120,210,200),'ร่างที่วิวัฒนาการ ATK +5 และ DEF +5 จนจบเทิร์น','ATK +5 / DEF +5','ATK',5,'ลมไม่เลือกข้าง แต่เลือกคนที่พร้อมออกเดินทาง'),
]
FUS = [  # id, name, color, effect, flavor
 ('FUS-001','ผสานใจหลอมร่าง',(240,120,160),'การ์ดคู่ Fusion ที่ซ้อนกันแล้ว HP +20','ใจสองดวง ร่างเดียว'),
 ('FUS-002','พลังคู่ขนาน',(240,150,60),'การ์ดคู่ Fusion ที่ซ้อนกันแล้ว ATK +10','สองแรงที่ไม่เคยชนกัน'),
 ('FUS-003','เกราะร่วมสาบาน',(110,150,210),'การ์ดคู่ Fusion ที่ซ้อนกันแล้ว DEF +10','เกราะของข้า คือเกราะของเจ้า'),
 ('FUS-004','สายฟ้าพันธนาการ',(240,205,70),'การ์ดคู่ Fusion ที่ซ้อนกันแล้ว ATK +15','ฟ้าผ่าเดียว ผ่านสองหัวใจ'),
 ('FUS-005','น้ำนิ่งไหลลึก',(70,150,225),'การ์ดคู่ Fusion ที่ซ้อนกันแล้ว HP +30','ลึกพอจะรับได้ทั้งสองคน'),
 ('FUS-006','ไฟสองดวงหนึ่งเปลว',(235,90,50),'การ์ดคู่ Fusion ที่ซ้อนกันแล้ว ATK +10 และ HP +10','ไฟสองกอง รวมเป็นกองไฟใหญ่'),
 ('FUS-007','เงาซ้อนแสง',(120,100,190),'การ์ดคู่ Fusion ที่ซ้อนกันแล้ว ATK +5 และ DEF +5','มีเงา เพราะมีแสงอยู่ข้างหลัง'),
 ('FUS-008','พันธะนักผจญภัย',(90,180,110),'การ์ดคู่ Fusion ที่ซ้อนกันแล้ว HP +15 และ DEF +5','เพื่อนร่วมเกม คือเพื่อนร่วมทาง'),
 ('FUS-009','ปลดล็อกคู่หู',(250,225,140),'การ์ดคู่ Fusion ที่ซ้อนกันแล้ว ATK +20','ความเป็นคู่หู ไม่ต้องใช้คำอธิบาย'),
 ('FUS-010','สองร่างหนึ่งตำนาน',(200,110,220),'การ์ดคู่ Fusion ที่ซ้อนกันแล้ว HP +10 ATK +10 DEF +10','ตำนานเริ่มต้น เมื่อมีคนเคียงข้าง'),
]
def canvas(c):
    im = Image.new('RGB', (W*S, H*S)); px = im.load(); d = ImageDraw.Draw(im)
    for y in range(H*S):
        t = y/(H*S); k = 0.25+0.75*(1-t)
        d.line([(0,y),(W*S,y)], fill=tuple(int(v*k*0.55) for v in c))
    return im
def glow(im, c, cx, cy, r):
    g = Image.new('RGB', im.size, (0,0,0)); gd = ImageDraw.Draw(g)
    gd.ellipse([cx-r,cy-r,cx+r,cy+r], fill=c); g = g.filter(ImageFilter.GaussianBlur(r/2))
    return Image.blend(im, Image.composite(g, im, g.convert('L')), 0.75)
def evo(c, path):
    im = canvas(c); cx, cy = W*S//2, int(H*S*0.55); im = glow(im, c, cx, cy, 230*S); d = ImageDraw.Draw(im)
    for i in range(3):  # ascending chevrons = evolution steps
        y = cy+170*S-i*150*S; w = (260-i*40)*S
        d.line([(cx-w,y),(cx,y-95*S),(cx+w,y)], fill=(255,255,255), width=26*S, joint='curve')
    for i in range(18):  # sparks
        a = i*2.399; r = (60+i*13)*S; x = cx+math.cos(a)*r; y = cy-70*S+math.sin(a)*r*0.8
        d.ellipse([x-5*S,y-5*S,x+5*S,y+5*S], fill=(255,255,255))
    im.resize((W,H), Image.LANCZOS).save(path, quality=88)
def fus(c, path):
    im = canvas(c); cx, cy = W*S//2, int(H*S*0.52); im = glow(im, c, cx, cy, 250*S); d = ImageDraw.Draw(im)
    r = 150*S; o = 105*S
    for dx in (-o, o): d.ellipse([cx+dx-r,cy-r,cx+dx+r,cy+r], outline=(255,255,255), width=24*S)
    d.ellipse([cx-45*S,cy-45*S,cx+45*S,cy+45*S], fill=(255,255,255))  # merged core
    for i in range(14):
        a = i*2.399; rr = (200+i*10)*S; x = cx+math.cos(a)*rr; y = cy+math.sin(a)*rr*0.75
        d.ellipse([x-4*S,y-4*S,x+4*S,y+4*S], fill=(255,255,255))
    im.resize((W,H), Image.LANCZOS).save(path, quality=88)
cards = []
for cid,name,el,c,txt,short,st,amt,fl in EVO:
    evo(c, f'assets/cards/{cid}.jpg')
    cards.append(dict(character_id=cid,name=name,card_type='evolution',element=el,image_path=f'assets/cards/{cid}.jpg',
      rules_text='ใช้ตอนวิวัฒนาการ: ทิ้งการ์ดนี้จากมือ 1 ใบต่อ 1 ขั้น (ใช้ได้ทุกขั้น Lv.15→40→70→99)',flavor_text=fl,
      effects=[dict(trigger='on_evolve',description=txt,action_text=short,target_text='ร่างที่วิวัฒนาการ',duration='until_end_of_turn' if ('จนจบเทิร์น' in txt) else 'instant',use_limit='none')]))
for cid,name,c,txt,fl in FUS:
    fus(c, f'assets/cards/{cid}.jpg')
    cards.append(dict(character_id=cid,name=name,card_type='fusion',image_path=f'assets/cards/{cid}.jpg',
      rules_text='ใช้ Fusion Spell + การ์ดตัวละคร 2 ใบที่ติ๊กเป็นคู่กันและอยู่บนมือ แล้ววางซ้อนกันในช่องเดียว',flavor_text=fl,
      effects=[dict(trigger='passive',description=txt,action_text=txt.split('แล้ว')[-1].strip(),target_text='การ์ดคู่ Fusion',duration='permanent',use_limit='none')]))
json.dump(cards, open('db/seed/support-cards.json','w'), ensure_ascii=False, indent=1)
print(len(cards))
