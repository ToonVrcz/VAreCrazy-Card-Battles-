import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const cards = JSON.parse(readFileSync('db/seed/toon-cards.json', 'utf8'));
const out = cards.map(c => {
  const f = c.image_path;
  const buf = execFileSync('python3', ['-c', `
import sys,io
from PIL import Image
im=Image.open(sys.argv[1]).convert('RGB');im.thumbnail((320,320));b=io.BytesIO();im.save(b,'JPEG',quality=76);sys.stdout.buffer.write(b.getvalue())`, f], { maxBuffer: 1e7 });
  return { ...c, b64: buf.toString('base64') };
});
const html = readFileSync('src/board-demo.template.html', 'utf8')
  .replace('/*__RENDERER__*/', () => readFileSync('src/card-renderer.js', 'utf8'))
  .replace('__FRAME__', () => JSON.stringify('data:image/webp;base64,' + readFileSync('assets/frame/frame.webp').toString('base64')))
  .replace('__ELEMENTS__', () => JSON.stringify(JSON.parse(readFileSync('db/seed/elements.json','utf8'))))
  .replace('__CARDS__', () => JSON.stringify(out));
writeFileSync('dist-board-demo.html', html);
console.log((html.length / 1024).toFixed(0) + ' KB');
