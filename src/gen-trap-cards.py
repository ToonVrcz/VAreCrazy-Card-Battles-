"""10 distinct Trap cards (DRAFT proposals) + placeholder art -> db/seed/trap-cards.json
Timing/chain rules are still pending from the owner; triggers use the closest existing ones."""
import json, math
from PIL import Image, ImageDraw, ImageFilter
W, H, S = 700, 770, 2
# id, name, trigger, color, effect, short, flavor
T = [
 ('TRP-001','หลุมพราง','on_attack',(150,110,70),'เมื่อคู่ต่อสู้โจมตี: ยกเลิกการโจมตีนั้น ผู้โจมตีไม่ทำดาเมจ','ยกเลิกการโจมตี','ทางที่ดูปลอดภัยที่สุด มักมีหลุมรออยู่'),
 ('TRP-002','กระจกสะท้อน','on_attack',(120,190,230),'เมื่อคู่ต่อสู้โจมตี: สะท้อนดาเมจครึ่งหนึ่งกลับไปที่ผู้โจมตี','สะท้อนดาเมจ 50%','สู้กับเงาตัวเอง ใครจะชนะ'),
 ('TRP-003','ประตูลับหลังบ้าน','on_attack',(90,90,130),'เมื่อคู่ต่อสู้โจมตี LP ผู้เล่นโดยตรง: ดาเมจที่ LP ลดลง 50%','ลดดาเมจต่อ LP 50%','ทางหนีที่มีแค่เจ้าของบ้านรู้'),
 ('TRP-004','โซ่พันธนาการ','on_summon',(140,140,150),'เมื่อคู่ต่อสู้อัญเชิญตัวละคร: ตัวนั้นโจมตีไม่ได้ 1 เทิร์น','ห้ามโจมตี 1 เทิร์น','มาถึงใหม่ ก็ติดกับทันที'),
 ('TRP-005','ขัดขวางการเติบโต','on_evolve',(190,70,110),'เมื่อคู่ต่อสู้วิวัฒนาการ: ยกเลิกการวิวัฒนาการ การ์ดอีโวที่ใช้ถูกทิ้ง','ยกเลิกการวิวัฒนาการ','จังหวะที่เปราะบางที่สุดคือจังหวะที่กำลังเปลี่ยน'),
 ('TRP-006','ระเบิดเวลา','turn_end',(235,110,40),'เมื่อจบเทิร์นคู่ต่อสู้: ตัวละครที่ ATK สูงสุดของคู่ต่อสู้ได้รับดาเมจ 15','ดาเมจ 15 ใส่ตัว ATK สูงสุด','ติ๊กต่อก ติ๊กต่อก'),
 ('TRP-007','ม่านหมอกพิษ','turn_start',(120,170,70),'เมื่อเริ่มเทิร์นคู่ต่อสู้: ตัวละครทุกตัวของคู่ต่อสู้ได้รับดาเมจ 5','ดาเมจ 5 ทุกตัว','หายใจเข้าไปทีเดียว ก็รู้สึก'),
 ('TRP-008','ปลุกผู้พิทักษ์','on_destroyed',(240,215,120),'เมื่อตัวละครฝ่ายเรากำลังจะถูกทำลาย: ตัวนั้นรอดไว้ด้วย HP 1','รอดด้วย HP 1','ยังไม่จบ ตราบใดที่ยังเหลือหนึ่งหัวใจ'),
 ('TRP-009','พัดกลับบ้าน','on_attack',(110,200,190),'เมื่อคู่ต่อสู้โจมตี: ส่งตัวละครที่โจมตีกลับขึ้นมือเจ้าของ','ส่งกลับขึ้นมือ','ลมแรงขนาดนี้ ใครจะยืนอยู่ได้'),
 ('TRP-010','เสียงเพรียกจากสุสาน','to_graveyard',(110,70,160),'เมื่อตัวละครฝ่ายเราลงสุสาน: จั่วการ์ด 1 ใบ','จั่วการ์ด 1 ใบ','ใครที่ล้ม ฝากอะไรไว้เสมอ'),
]
def canvas(c):
    im = Image.new('RGB', (W*S, H*S)); d = ImageDraw.Draw(im)
    for y in range(H*S):
        k = 0.25+0.75*(1-y/(H*S)); d.line([(0,y),(W*S,y)], fill=tuple(int(v*k*0.55) for v in c))
    return im
def art(c, i, path):
    im = canvas(c); cx, cy = W*S//2, int(H*S*0.54)
    g = Image.new('RGB', im.size, (0,0,0)); ImageDraw.Draw(g).ellipse([cx-230*S,cy-230*S,cx+230*S,cy+230*S], fill=c)
    g = g.filter(ImageFilter.GaussianBlur(115*S)); im = Image.blend(im, Image.composite(g, im, g.convert('L')), 0.75)
    d = ImageDraw.Draw(im); r = 190*S
    d.polygon([(cx,cy-r),(cx+r*0.87,cy+r*0.5),(cx-r*0.87,cy+r*0.5)], outline=(255,255,255), width=24*S)  # warning triangle
    d.rectangle([cx-12*S,cy-70*S,cx+12*S,cy+30*S], fill=(255,255,255)); d.ellipse([cx-15*S,cy+50*S,cx+15*S,cy+80*S], fill=(255,255,255))
    for k in range(i+3):  # unique spark pattern per card
        a = k*2.399+i; rr = (230+k*14)*S
        x = cx+math.cos(a)*rr; y = cy+math.sin(a)*rr*0.7; d.ellipse([x-5*S,y-5*S,x+5*S,y+5*S], fill=(255,255,255))
    im.resize((W,H), Image.LANCZOS).save(path, quality=88)
out = []
for i,(cid,name,trg,c,txt,short,fl) in enumerate(T):
    art(c, i, f'assets/cards/{cid}.jpg')
    out.append(dict(character_id=cid,name=name,card_type='trap',image_path=f'assets/cards/{cid}.jpg',
      rules_text='วางหน้าคว่ำในช่องหลัง ทำงานเมื่อเงื่อนไขตรง ใช้ได้ครั้งเดียวแล้วลงสุสาน (จังหวะ/การตอบโต้ รอเจ้าของยืนยัน)',flavor_text=fl,
      effects=[dict(trigger=trg,description=txt,action_text=short,target_text=None,duration='instant',use_limit='once_per_game')]))
json.dump(out, open('db/seed/trap-cards.json','w'), ensure_ascii=False, indent=1); print(len(out))
