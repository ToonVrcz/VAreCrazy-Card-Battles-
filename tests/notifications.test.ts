import { describe, it, expect } from 'vitest';
import { createGame, act, type CardDef, type Game, type Action } from '../src/engine/game';
import { botPick } from '../src/engine/bot';
import { viewFor } from '../src/engine/deck-view';
import { viewEvents, formatEvent, createNotifier, squash, MAX_EVENTS, LEVEL, type GameEvent } from '../src/engine/events';
import { forfeit, newMeta } from '../src/engine/turn-timer';

const ch = (id: string, level: number, o: Partial<CardDef> = {}): CardDef => ({ id, name: `ตัว${id}`, type: 'character', level, chain: id.split('-')[0], hp: 50, atk: 30, def: 5, element: 'neutral', ...o });
const sp = (id: string): CardDef => ({ id, name: `เวท${id}`, type: 'spell', level: null, chain: null, hp: null, atk: null, def: 0, element: null });
const trap = (id: string): CardDef => ({ id, name: `กับดัก${id}`, type: 'trap', level: null, chain: null, hp: null, atk: null, def: 0, element: null });
const evoC = (): CardDef => ({ id: 'EVO-001', name: 'EVO-001', type: 'evolution', level: null, chain: null, hp: null, atk: null, def: 0, element: null });
const filler = () => Array.from({ length: 30 }, (_, i) => ch(`FILL${i}-15`, 15));
const run = (g: Game, ...as: Action[]) => as.reduce(act, g);
const start = (interactive = false) => createGame([filler(), filler()], 7, 0, { interactive });
const types = (g: Game) => (g.events ?? []).map(e => e.t);
const bannedWords = (t: string) => /ผู้เล่น \d|Player [12]|มอนสเตอร์/.test(t);

describe('engine records real events (values come from the engine)', () => {
  it('summon / set / cast / attack / damage / lp use the actual numbers', () => {
    const g0 = start(); g0.players[0].hand = [ch('A-15', 15), sp('SPL-004'), trap('TRP-001')]; g0.players[1].hand = [ch('B-15', 15, { hp: 40, def: 0 })];
    let g = run(g0, { t: 'summon', hand: 0, slot: 0 }, { t: 'cast', hand: 0, target: { slot: 0 } }, { t: 'set', hand: 0 });
    expect(types(g)).toEqual(['summon', 'cast', 'buff', 'set_trap']);
    expect(g.events![2]).toMatchObject({ p: 0, card: 'ตัวA-15', stat: 'atk', v: 15, src: 'เวทSPL-004' });
    g = run(g, { t: 'next' }, { t: 'next' }, { t: 'summon', hand: 0, slot: 0 }, { t: 'next' }, { t: 'next' });  // opp summons, then back to p0 turn 3
    g = run(g, { t: 'next' });
    g = act(g, { t: 'attack', from: 0, to: 0 });
    const ev = g.events!.slice(-6), atk = ev.find(e => e.t === 'attack')!, dmg = ev.find(e => e.t === 'dmg' && e.p === 1)!;
    expect(atk).toMatchObject({ p: 0, card: 'ตัวA-15', to: 'ตัวB-15' });
    expect(dmg.v).toBe(40 - (g.players[1].field[0]?.hp ?? 0));   // HP the engine really removed (a destroyed unit counts as 0 left)
    expect(types(g)).toContain('turn_start');
  });
  it('lp loss reports the real amount and game_over carries the winner', () => {
    let g = start(); g.players[0].hand = [ch('A-15', 15, { atk: 150 })];
    g = run(g, { t: 'summon', hand: 0, slot: 0 }, { t: 'next' }, { t: 'next' }, { t: 'next' }, { t: 'next' }, { t: 'next' });
    g = act(g, { t: 'attack', from: 0, to: 'player' });
    const lp = g.events!.find(e => e.t === 'lp')!, over = g.events!.find(e => e.t === 'game_over')!;
    expect(lp).toMatchObject({ p: 1, v: 100 }); expect(over).toMatchObject({ p: 0, why: 'lp' }); expect(g.winner).toBe(0);
  });
  it('no event for actions that fail', () => {
    const g = start(); const before = g.evSeq ?? 0;
    expect(() => act(g, { t: 'attack', from: 0, to: 'player' })).toThrow();
    expect(g.evSeq ?? 0).toBe(before);
  });
  it('forfeit adds a game_over with the reason', () => {
    const g = start(); const m = newMeta(0); forfeit(g, 1, 'left', m);
    expect(g.events!.at(-1)).toMatchObject({ t: 'game_over', p: 0, why: 'left' });
  });
});

describe('perspective', () => {
  const g = (() => { let x = start(); x.players[0].hand = [ch('A-15', 15), trap('TRP-001'), sp('SPL-005')]; return run(x, { t: 'summon', hand: 0, slot: 0 }, { t: 'set', hand: 0 }, { t: 'cast', hand: 0 }); })();
  it('same event reads differently for each player, never "ผู้เล่น 1/2"', () => {
    const a = viewEvents(g.events, 0).map(e => formatEvent(e).text), b = viewEvents(g.events, 1).map(e => formatEvent(e).text);
    expect(a[0]).toBe('คุณเรียกตัวละคร ตัวA-15'); expect(b[0]).toBe('ฝ่ายตรงข้ามเรียกตัวละคร ตัวA-15');
    for (const t of [...a, ...b]) expect(bannedWords(t)).toBe(false);
  });
  it('viewFor flips seats in events like it flips players', () => {
    const v0 = viewFor(g, 0).events as GameEvent[], v1 = viewFor(g, 1).events as GameEvent[];
    expect(v0.every((e, i) => e.p === g.events![i].p)).toBe(true); expect(v1.every((e, i) => e.p === 1 - g.events![i].p)).toBe(true);
  });
  it('opponent never sees a face-down trap name (viewFor, both seats, whole payload)', () => {
    expect(JSON.stringify(viewFor(g, 1))).not.toContain('กับดักTRP-001');
    expect(JSON.stringify(viewFor(g, 1).events)).not.toContain('TRP-001');
    expect(JSON.stringify(viewFor(g, 0).events)).toContain('กับดักTRP-001');     // the owner does
    const opp = viewEvents(g.events, 1).find(e => e.t === 'set_trap')!; expect(opp.card).toBeUndefined();
    expect(formatEvent(opp).text).toBe('ฝ่ายตรงข้ามวางกับดักคว่ำ 1 ใบ');
    const own = viewEvents(g.events, 0).find(e => e.t === 'set_trap')!; expect(formatEvent(own).text).toBe('คุณวางกับดัก กับดักTRP-001 ลงคว่ำ');
  });
  it('cards found in a hidden deck are not named to the opponent', () => {
    const e: GameEvent = { id: 1, turn: 1, t: 'search_evo', p: 0, card: 'X', to: 'SECRET' };
    expect(JSON.stringify(viewEvents([e], 1))).not.toContain('SECRET'); expect(JSON.stringify(viewEvents([e], 0))).toContain('SECRET');
  });
  it('every event type has a level and the Special ones are win/lose, evolution, fusion', () => {
    expect(Object.entries(LEVEL).filter(([, l]) => l === 'special').map(([t]) => t).sort()).toEqual(['evolve', 'fuse', 'game_over']);
    expect(LEVEL.trap_fired).toBe('important');
  });
});

describe('ids, chain window and the 60 cap', () => {
  it('ids are unique and contiguous; a chain-window replay adds nothing twice', () => {
    const g0 = start(true); g0.players[0].hand = [ch('A-15', 15), ch('C-15', 15)]; g0.players[1].hand = [ch('B-15', 15)];
    let g = run(g0, { t: 'summon', hand: 0, slot: 0 }, { t: 'next' }, { t: 'next' }, { t: 'summon', hand: 0, slot: 0 });
    g.players[1].back[0] = { card: trap('TRP-001'), setTurn: 1 };
    g = run(g, { t: 'next' }, { t: 'next' }, { t: 'next' }); g = act(g, { t: 'attack', from: 0, to: 0 });
    expect(g.pending).toBeTruthy(); const n = g.evSeq!;
    const ids = g.events!.map(e => e.id); expect(new Set(ids).size).toBe(ids.length);
    const r = act(g, { t: 'respond', back: 0 }); expect(r.evSeq).toBeGreaterThan(n);
    const ids2 = r.events!.map(e => e.id); expect(ids2.every((x, i) => i === 0 || x === ids2[i - 1] + 1)).toBe(true);
    expect(types(r).filter(t => t === 'trap_fired')).toHaveLength(1); expect(types(r).filter(t => t === 'attack')).toHaveLength(1);
  });
  it('keeps only the latest 60 while evSeq keeps counting', () => {
    let g = start(); for (let i = 0; i < 160 && g.winner === null; i++) g = act(g, { t: 'next' });
    expect(g.events!.length).toBeLessThanOrEqual(MAX_EVENTS); expect(g.evSeq!).toBeGreaterThan(MAX_EVENTS);
    expect(g.events!.at(-1)!.id).toBe(g.evSeq);
  });
});

describe('notifier: no duplicates, order, reconnect', () => {
  const mk = (n: number, from = 1): GameEvent[] => Array.from({ length: n }, (_, i) => ({ id: from + i, turn: 1, t: 'draw', p: 0, v: 1 }) as GameEvent);
  it('shows each event exactly once, in id order, across repeated polls', () => {
    const N = createNotifier(0), seen: number[] = [];
    const evs = mk(3); for (let i = 0; i < 4; i++) N.ingest(evs, 3).forEach(() => seen.push(1));
    expect(seen).toHaveLength(3);
    const more = mk(2, 4); expect(N.ingest([...evs, ...more], 5)).toHaveLength(2); expect(N.ingest([...evs, ...more], 5)).toHaveLength(0);
  });
  it('a screen with no memory (refresh) records a baseline and does not replay history', () => {
    const N = createNotifier(null); expect(N.ingest(mk(10), 10)).toEqual([]); expect(N.last).toBe(10); expect(N.history(3)).toHaveLength(3);
    expect(N.ingest(mk(11), 11)).toHaveLength(1);
  });
  it('after missing more than 60 events: one summary with the true count + latest 3, nothing replayed', () => {
    const N = createNotifier(5), held = mk(60, 91);          // latest = 150, the screen last saw 5 => 145 missed, 60 still held
    const out = N.ingest(held, 150); expect(out).toHaveLength(4);
    expect(out[0].text).toContain('145'); expect(out[0].level).toBe('important'); expect(N.ingest(held, 150)).toHaveLength(0);
  });
  it('small gaps with all events held show every event, not a summary', () => {
    const N = createNotifier(2); const out = N.ingest(mk(4, 1), 4); expect(out).toHaveLength(2); expect(out[0].text).not.toContain('ไม่อยู่');
  });
  it('queue squash merges only small notices when long and keeps order', () => {
    const q = [...Array.from({ length: 6 }, () => ({ text: 'a', level: 'normal', icon: 'x' }) as any), { text: 'big', level: 'important', icon: 'y' }, { text: 'n', level: 'normal', icon: 'x' }] as any;
    const o = squash(q); expect(o.map(x => x.text)).toEqual(['+6 เหตุการณ์', 'big', 'n']); expect(squash(q.slice(0, 3))).toHaveLength(3);
  });
});

describe('whole games: events agree with the engine', () => {
  it('bot vs bot: damage events add up to HP/LP the engine actually removed, texts are clean', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      let g = createGame([filler(), filler()], seed, 0, { interactive: true }); let lpLost: [number, number] = [0, 0];
      const all: GameEvent[] = [];
      for (let i = 0; i < 400 && g.winner === null; i++) { try { g = act(g, botPick(g)); } catch { g = act(g, { t: g.pending ? 'pass' : 'next' }); } for (const e of g.events ?? []) if (!all.some(x => x.id === e.id)) all.push(e); }
      for (const e of all) { if (e.t === 'lp') lpLost[e.p] += e.v!; const t = formatEvent(e).text; expect(t.length).toBeGreaterThan(0); expect(bannedWords(t)).toBe(false); expect(t).not.toContain('undefined'); expect(t).not.toContain('NaN'); }
      expect([100 - g.players[0].lp, 100 - g.players[1].lp]).toEqual(lpLost);
      if (g.winner !== null) expect(all.filter(e => e.t === 'game_over')).toHaveLength(1);
      const ids = all.map(e => e.id); expect(ids).toEqual([...ids].sort((a, b) => a - b));
    }
  });
});
