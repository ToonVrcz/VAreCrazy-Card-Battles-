// Story runtime (owner-approved 2026-11-25): effects exist only while both chains are on the same side's field, recomputed from the field, never stacked, base stats never mutated.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { migrateUp } from '../db/migrate';
import { createGame, refreshAuras, act, type CardDef, type Game, type StoryLink } from '../src/engine/game';

const ch = (id: string, chain: string, o: Partial<CardDef> = {}): CardDef => ({ id, name: id, type: 'character', level: 15, chain, hp: 80, atk: 20, def: 2, element: 'neutral', ...o });
const filler = Array.from({ length: 30 }, (_, i) => ch('F' + i, 'f' + i));
function game(story: StoryLink[]) { return createGame([[ch('A', 'a'), ...filler], [...filler]], 1, 0, { storyLinks: story, interactive: true }); }
const put = (g: Game, side: 0 | 1, slot: number, c: CardDef) => { const u = { uid: ++g.uid, card: c, hp: c.hp!, maxHp: c.hp!, atk: c.atk!, def: c.def, bonusAtk: 0, bonusDef: 0, summonedTurn: 0, attacked: false, lockedUntil: 0, poison: 0 } as any; g.players[side].field[slot] = u; return u; };
const gone = (g: Game, side: 0 | 1, slot: number) => { g.players[side].field[slot] = null; };

describe('Story runtime', () => {
  it('applies only while both chains are on the field, and stops immediately when the partner leaves', () => {
    const g = game([{ a: 'a', b: 'b', mods: [{ stat: 'atk', amount: 5 }] }]);
    const ua = put(g, 0, 0, ch('A', 'a')); refreshAuras(g); expect(ua.auraAtk).toBe(0);
    put(g, 0, 1, ch('B', 'b')); refreshAuras(g); expect(ua.auraAtk).toBe(5);
    gone(g, 0, 1); refreshAuras(g); expect(ua.auraAtk).toBe(0);
  });
  it('is directional: only the row owner chain gets the modifier; the partner is untouched', () => {
    const g = game([{ a: 'a', b: 'b', mods: [{ stat: 'def', amount: -5 }] }]);
    const ua = put(g, 0, 0, ch('A', 'a')), ub = put(g, 0, 1, ch('B', 'b')); refreshAuras(g);
    expect([ua.auraDef, ub.auraDef]).toEqual([-5, 0]);
  });
  it('two directional rows on the same pair (BACKJI/NONG style) both apply, each to its own side', () => {
    const g = game([{ a: 'a', b: 'b', mods: [{ stat: 'def', amount: 5 }] }, { a: 'b', b: 'a', mods: [{ stat: 'atk', amount: 5 }] }]);
    const ua = put(g, 0, 0, ch('A', 'a')), ub = put(g, 0, 1, ch('B', 'b')); refreshAuras(g);
    expect([ua.auraDef, ua.auraAtk, ub.auraDef, ub.auraAtk]).toEqual([5, 0, 0, 5]);
  });
  it('does not stack per duplicate partner copy and repeated refreshes never accumulate', () => {
    const g = game([{ a: 'a', b: 'b', mods: [{ stat: 'atk', amount: 5 }] }]);
    const ua = put(g, 0, 0, ch('A', 'a')); put(g, 0, 1, ch('B', 'b')); put(g, 0, 2, ch('B2', 'b'));
    for (let i = 0; i < 5; i++) refreshAuras(g); expect(ua.auraAtk).toBe(5);
  });
  it('a partner on the OTHER side does not count', () => {
    const g = game([{ a: 'a', b: 'b', mods: [{ stat: 'atk', amount: 5 }] }]);
    const ua = put(g, 0, 0, ch('A', 'a')); put(g, 1, 0, ch('B', 'b')); refreshAuras(g); expect(ua.auraAtk).toBe(0);
  });
  it('Mixed Story applies every modifier at once and distinct Stories stack', () => {
    const g = game([{ a: 'a', b: 'b', mods: [{ stat: 'atk', amount: 10 }, { stat: 'def', amount: -5 }] }, { a: 'a', b: 'c', mods: [{ stat: 'atk', amount: 5 }] }]);
    const ua = put(g, 0, 0, ch('A', 'a')); put(g, 0, 1, ch('B', 'b')); put(g, 0, 2, ch('C', 'c')); refreshAuras(g);
    expect([ua.auraAtk, ua.auraDef]).toEqual([15, -5]); expect(ua.atk).toBe(20); expect(ua.def).toBe(2);      // base stats untouched
  });
  it('HP modifiers move max HP, restore on removal, and never kill the unit', () => {
    const g = game([{ a: 'a', b: 'b', mods: [{ stat: 'hp', amount: -5 }] }, { a: 'a', b: 'c', mods: [{ stat: 'hp', amount: 10 }] }]);
    const ua = put(g, 0, 0, ch('A', 'a', { hp: 80 })); put(g, 0, 1, ch('B', 'b')); put(g, 0, 2, ch('C', 'c')); refreshAuras(g);
    expect([ua.maxHp, ua.hp]).toEqual([85, 85]);
    gone(g, 0, 2); refreshAuras(g); expect([ua.maxHp, ua.hp]).toEqual([75, 75]);
    gone(g, 0, 1); refreshAuras(g); expect([ua.maxHp, ua.hp]).toEqual([80, 80]);
    ua.hp = 3; put(g, 0, 1, ch('B', 'b')); refreshAuras(g); expect(ua.hp).toBeGreaterThanOrEqual(1);
  });
  it('lasts through real actions (state is recomputed after every act)', () => {
    let g = game([{ a: 'a', b: 'b', mods: [{ stat: 'atk', amount: 5 }] }]);
    put(g, 0, 0, ch('A', 'a')); put(g, 0, 1, ch('B', 'b')); g.players[0].hand = [ch('Z', 'z')];
    g = act(g, { t: 'summon', hand: 0, slot: 2 }); expect(g.players[0].field[0]!.auraAtk).toBe(5);
  });
  it('a fused unit counts both of its cards as present', () => {
    const g = game([{ a: 'a', b: 'b', mods: [{ stat: 'atk', amount: 5 }] }]);
    const ua = put(g, 0, 0, ch('A', 'a')); ua.fused = [ch('A', 'a'), ch('B', 'b')]; refreshAuras(g); expect(ua.auraAtk).toBe(5);
  });
});

describe('Story data', () => {
  it('keeps all 8 original live rows unchanged and adds exactly 21 proposed rows', () => {
    const s = JSON.parse(readFileSync('db/seed/story-links.json', 'utf8'));
    const toon = JSON.parse(readFileSync('db/seed/toon-cards.json', 'utf8'));
    const byId = new Map(toon.map((c: any) => [c.character_id, c.chain_key]));
    const baseline = [
      ['1goku', 'dnman', 'โดนกล่าวหา ว่าโกง ตอนเล่นเกม', 'hp', -5],
      ['baby', 'bam', 'เพื่อนรัก', 'atk', 5],
      ['backji', 'nong-taengmo', 'รันแกงซ์ FiveM', 'def', 5],
      ['badguy', 'smile', 'ความขัดแย้งในตลาด', 'atk', -5],
      ['bam', 'satoshi', 'เจอหน้ากันไม่ได้', 'def', -5],
      ['bammie', 'jaojay', 'คู่รัก', 'hp', 10],
      ['chaem', 'tee', 'แอบรักข้างเดียว', 'def', -5],
      ['nong-taengmo', 'backji', 'รันแกงซ์ FiveM', 'atk', 5]
    ];
    expect(s).toHaveLength(29);
    for (const [a, b, name, stat, amount] of baseline) {
      expect(s).toContainEqual({ a, b, name, mods: [{ stat, amount }] });
    }
    const added = s.slice(8);
    expect(added).toHaveLength(21);
    const expected = [
      ['baby', 'bammie', 'เพื่อนเก่าที่กลับมา', [{ stat: 'atk', amount: 5 }]],
      ['lalaping', 'thomas', 'ผู้ช่วยชีวิต', [{ stat: 'hp', amount: 10 }]],
      ['lordnam', 'lucky', 'สัญญาแห่งโชคชะตา', [{ stat: 'def', amount: 5 }]],
      ['bobo', 'linlada', 'คู่หูนักสู้', [{ stat: 'atk', amount: 5 }]],
      ['chaem', 'pk', 'นักวางแผน', [{ stat: 'hp', amount: 5 }]],
      ['god-wa', 'jaojay', 'คู่หูนักอัญเชิญ', [{ stat: 'atk', amount: 5 }]],
      ['leon-s-kennedy', 'oufilling', 'คู่หูผู้พิทักษ์', [{ stat: 'def', amount: 5 }]],
      ['melon', 'thai32', 'สหายร่วมสนาม', [{ stat: 'hp', amount: 5 }]],
      ['cutie', 'pikachu', 'ศึกจอมเวท', [{ stat: 'atk', amount: -5 }]],
      ['norman', 'thai26', 'ศึกนักรบต่างขั้ว', [{ stat: 'def', amount: -5 }]],
      ['wendywendie', 'nong-taengmo', 'โจรแย่งผลงาน', [{ stat: 'atk', amount: -5 }]],
      ['pkxcy', 'miki', 'ศักดิ์ศรีนักสู้', [{ stat: 'def', amount: -5 }]],
      ['follow-you', 'god-wa', 'นักอัญเชิญกับหัวขโมย', [{ stat: 'atk', amount: -5 }]],
      ['tan', 'mon', 'ธุรกิจที่ไม่ลงตัว', [{ stat: 'hp', amount: -5 }]],
      ['zeesky', 'skymoon', 'พายุเหนือโรงตีเหล็ก', [{ stat: 'def', amount: -5 }]],
      ['bobo', 'bam', 'ศึกชิงความเป็นหนึ่ง', [{ stat: 'atk', amount: -5 }]],
      ['badguy', 'norman', 'คู่หูสายบุก', [{ stat: 'atk', amount: 10 }, { stat: 'def', amount: -5 }]],
      ['cutie', 'somyes', 'เวทมนตร์และธนู', [{ stat: 'atk', amount: 5 }, { stat: 'hp', amount: -5 }]],
      ['lalaping', 'satoshi', 'ผู้รักษาสองขั้ว', [{ stat: 'hp', amount: 10 }, { stat: 'atk', amount: -5 }]],
      ['backji', 'god-wa', 'คู่หูนักลอบโจมตี', [{ stat: 'atk', amount: 10 }, { stat: 'def', amount: -5 }]],
      ['thai26', 'bammie', 'นักดาบประสานพลัง', [{ stat: 'atk', amount: 5 }, { stat: 'hp', amount: -5 }]]
    ];
    expect(added).toEqual(expected.map(([a, b, name, mods]: any) => ({ a, b, name, mods })));
    for (const row of added) {
      expect(byId.has([...byId.entries()].find(([, chain]) => chain === row.a)?.[0])).toBe(true);
      expect(byId.has([...byId.entries()].find(([, chain]) => chain === row.b)?.[0])).toBe(true);
    }
    const pairKeys = s.map((x: any) => x.a + '|' + x.b);
    expect(new Set(pairKeys).size).toBe(pairKeys.length);
  });
  it('migration 028 is additive: legacy rows keep stat/amount and modifiers stays NULL', async () => {
    const db = new PGlite(); await migrateUp(db);
    const up = readFileSync('db/migrations/028_story_modifiers.up.sql', 'utf8'), down = readFileSync('db/migrations/028_story_modifiers.down.sql', 'utf8');
    await db.exec(down);                                                  // pretend 028 was never applied (the test db migrates everything)
    await db.query(`INSERT INTO evolution_chains(key,name) VALUES('a','A'),('b','B')`);
    await db.query(`INSERT INTO cards(character_id,name,card_type,level,chain_id,hp,atk) SELECT 'A-015','A','character',15,id,50,10 FROM evolution_chains WHERE key='a'`);
    await db.query(`INSERT INTO card_story_links(card_id,partner_chain_id,name,stat,amount,description) SELECT c.id,b.id,'old','def',5,'x' FROM cards c, evolution_chains b WHERE c.character_id='A-015' AND b.key='b'`);
    await db.exec(up);
    const r = (await db.query<any>(`SELECT stat,amount,description,modifiers,story_type FROM card_story_links`)).rows[0];
    expect(r).toMatchObject({ stat: 'def', amount: 5, description: 'x', modifiers: null, story_type: null });
    await expect(db.query(`UPDATE card_story_links SET story_type='weird'`)).rejects.toThrow();
  }, 60000);
});
