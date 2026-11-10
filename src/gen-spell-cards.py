"""10 distinct Spell cards (DRAFT proposals) + placeholder art -> db/seed/spell-cards.json"""
import json, math
from PIL import Image, ImageDraw, ImageFilter
W, H, S = 700, 770, 2
# id, name, color, effect, short, target, duration, turns, flavor
SP = [
 ('SPL-001','ลูกไฟเริ่มต้น',(235,100,40),'ดาเมจ 20 ใส่ตัวละครคู่ต่อสู้ 1 ตัว (คิดตัวคูณธาตุ)','ดาเมจ 20','ตัวละครคู่ต่อสู้ 1 ตัว','instant',None,'เล็กแต่ร้อน พอให้จำได้'),
 ('SPL-002','น้ำบำบัด',(60,150,230),'ฟื้นฟู HP 30 ให้ตัวละครฝ่ายเรา 1 ตัว','ฟื้น HP 30','ตัวละครฝ่ายเรา 1 ตัว','instant',None,'หยดเดียว ก็พอให้ลุกขึ้นได้'),
 ('SPL-003','โล่มนตร์',(120,170,230),'DEF +15 จนจบเทิร์น ให้ตัวละครฝ่ายเรา 1 ตัว','DEF +15','ตัวละครฝ่ายเรา 1 ตัว','until_end_of_turn',None,'บางเหมือนอากาศ แข็งเหมือนหิน'),
 ('SPL-004','พลังผนึก',(220,90,90),'ATK +15 จนจบเทิร์น ให้ตัวละครฝ่ายเรา 1 ตัว','ATK +15','ตัวละครฝ่ายเรา 1 ตัว','until_end_of_turn',None,'ปลดผนึกแค่ชั่วครู่ ก็เกินพอ'),
 ('SPL-005','จั่วปริศนา',(150,110,210),'จั่วการ์ด 2 ใบ','จั่ว 2 ใบ','ผู้ใช้','instant',None,'ไพ่ใบถัดไป อาจเป็นทุกอย่าง'),
 ('SPL-006','เรียกคืนจากสุสาน',(110,90,150),'นำตัวละคร Lv.15 จากสุสาน 1 ใบขึ้นมือ','ตัวละคร Lv.15 จากสุสานขึ้นมือ','สุสานฝ่ายเรา','instant',None,'ยังไม่จบ ถ้ายังมีคนจำได้'),
 ('SPL-007','ลมพัดสลับ',(110,205,190),'สลับตำแหน่งตัวละครฝ่ายเรา 2 ตัวในสนาม','สลับตำแหน่ง 2 ตัว','ตัวละครฝ่ายเรา 2 ตัว','instant',None,'ลมเปลี่ยนทิศ แนวรบก็เปลี่ยนตาม'),
 ('SPL-008','พายุหยุดนิ่ง',(150,160,190),'ตัวละครคู่ต่อสู้ 1 ตัวโจมตีไม่ได้ 1 เทิร์น','โจมตีไม่ได้ 1 เทิร์น','ตัวละครคู่ต่อสู้ 1 ตัว','n_turns',1,'ตาพายุเงียบที่สุด'),
 ('SPL-009','พิษร้ายค่อยๆกัด',(120,180,70),'ตัวละครคู่ต่อสู้ 1 ตัวโดนดาเมจ 5 ต่อเทิร์น นาน 3 เทิร์น','ดาเมจ 5 ต่อเทิร์น x3','ตัวละครคู่ต่อสู้ 1 ตัว','n_turns',3,'ไม่ต้องรีบ พิษมีเวลา'),
 ('SPL-010','ปัดป้องมนตร์',(240,215,120),'ทำลายกับดักหน้าคว่ำของคู่ต่อสู้ 1 ใบ','ทำลายกับดัก 1 ใบ','กับดักหน้าคว่ำของคู่ต่อสู้','instant',None,'รู้ทัน คือเวทที่ดีที่สุด'),
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
    d = ImageDraw.Draw(im); R = 175*S
    d.ellipse([cx-R,cy-R,cx+R,cy+R], outline=(255,255,255), width=18*S)  # magic circle
    for k in range(5):  # pentagram
        a1 = -math.pi/2+k*4*math.pi/5; a2 = -math.pi/2+(k+1)*4*math.pi/5
        d.line([(cx+math.cos(a1)*R*0.9,cy+math.sin(a1)*R*0.9),(cx+math.cos(a2)*R*0.9,cy+math.sin(a2)*R*0.9)], fill=(255,255,255), width=12*S)
    for k in range(i+4):
        a = k*2.399+i; rr = (215+k*13)*S; x = cx+math.cos(a)*rr; y = cy+math.sin(a)*rr*0.75
        d.ellipse([x-5*S,y-5*S,x+5*S,y+5*S], fill=(255,255,255))
    im.resize((W,H), Image.LANCZOS).save(path, quality=88)
out = []
for i,(cid,name,c,txt,short,tgt,dur,turns,fl) in enumerate(SP):
    art(c, i, f'assets/cards/{cid}.jpg')
    out.append(dict(character_id=cid,name=name,card_type='spell',image_path=f'assets/cards/{cid}.jpg',
      rules_text='ใช้จากมือ ผลทำงานทันทีแล้วการ์ดลงสุสาน (ช่วงที่ใช้ได้/การตอบโต้ รอเจ้าของยืนยัน)',flavor_text=fl,
      effects=[dict(trigger='on_cast',description=txt,action_text=short,target_text=tgt,duration=dur,duration_turns=turns,use_limit='none')]))
json.dump(out, open('db/seed/spell-cards.json','w'), ensure_ascii=False, indent=1); print(len(out))
