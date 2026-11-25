#!/usr/bin/env python3
"""Placeholder art (700x770) for the 39 Signature cards. Replace any of them in the Admin CMS (card editor -> upload image)."""
import json, textwrap
from PIL import Image, ImageDraw, ImageFont
F = '/usr/share/fonts/opentype/tlwg/Loma-Bold.otf'; FR = '/usr/share/fonts/opentype/tlwg/Loma.otf'
cards = json.load(open('db/seed/signature-cards.json', encoding='utf8'))
W, H = 700, 770
for c in cards:
    spell = c['card_type'] == 'spell'
    top, bot, acc = ((38, 70, 160), (120, 60, 190), (140, 200, 255)) if spell else ((120, 25, 45), (45, 15, 30), (255, 170, 130))
    im = Image.new('RGB', (W, H)); d = ImageDraw.Draw(im)
    for y in range(H):
        t = y / H; d.line([(0, y), (W, y)], fill=tuple(int(top[i] * (1 - t) + bot[i] * t) for i in range(3)))
    cx, cy = W // 2, 300
    if spell:   # star burst
        import math
        pts = [(cx + (150 if i % 2 == 0 else 65) * math.cos(math.pi * i / 6 - math.pi / 2), cy + (150 if i % 2 == 0 else 65) * math.sin(math.pi * i / 6 - math.pi / 2)) for i in range(12)]
        d.polygon(pts, outline=acc, fill=None, width=8)
    else:       # shield
        d.polygon([(cx - 110, cy - 130), (cx + 110, cy - 130), (cx + 110, cy + 30), (cx, cy + 150), (cx - 110, cy + 30)], outline=acc, width=8)
    d.ellipse([cx - 14, cy - 14, cx + 14, cy + 14], fill=acc)
    d.rounded_rectangle([30, 30, W - 30, H - 30], 28, outline=acc, width=4)
    big = ImageFont.truetype(F, 54); mid = ImageFont.truetype(F, 34); sm = ImageFont.truetype(FR, 26)
    d.text((W // 2, 520), c['name'], font=big, fill='white', anchor='mm')
    d.text((W // 2, 600), c['linked_character'].replace('-015', '') + '  Lv.15', font=mid, fill=acc, anchor='mm')
    d.text((W // 2, 665), 'เวทมนตร์' if spell else 'กับดัก', font=mid, fill='white', anchor='mm')
    d.text((W // 2, 725), 'ภาพชั่วคราว · เปลี่ยนได้ใน CMS', font=sm, fill=(220, 220, 230), anchor='mm')
    im.save(f"assets/cards/{c['character_id']}.jpg", quality=88)
print(len(cards), 'images')
