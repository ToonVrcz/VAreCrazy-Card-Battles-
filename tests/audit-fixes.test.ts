import { describe, it, expect } from 'vitest';
import { createGame, act, type CardDef } from '../src/engine/game';

const ch = (id: string, level: number, chain = 'x'): CardDef => ({ id, name: id, type: 'character', level, chain, hp: 50, atk: 10, def: 0, element: 'neutral' });
const evo: CardDef = { id: 'EVO-001', name: 'EVO', type: 'evolution', level: null, chain: null, hp: null, atk: null, def: 0, element: null };
const sp = (id: string): CardDef => ({ id, name: id, type: 'spell', level: null, chain: null, hp: null, atk: null, def: 0, element: null });
const filler = Array.from({ length: 30 }, (_, i) => ch('F' + i, 15, 'f' + i));

function evoGame() {
  let g = createGame([[ch('A15', 15), ch('B15', 15, 'y'), evo, ...filler], [...filler]], 1, 0, { extras: [[ch('A40', 40)], []] });
  g.players[0].hand = [ch('A15', 15), ch('B15', 15, 'y'), evo]; g.players[0].field = Array(7).fill(null);
  g = act(g, { t: 'summon', hand: 0, slot: 0 });
  return g;
}
const evolve = (g: any, sacrifice: any) => act(structuredClone(g), { t: 'evolve', slot: 0, evo: 1, form: 0, sacrifice } as any);

describe('F-02 evolution sacrifice cannot be bypassed', () => {
  it.each([[[]], [['toString']], [['length']], [['constructor']], [['__proto__']], [[1.5]], [[-1]], [[7]], [[0]], [['1']], ['abc'], [null], [[1, 1]]])('rejects sacrifice %j', (sac) => {
    const g = evoGame();
    expect(() => evolve(g, sac)).toThrow();
  });
  it('rejected attempts leave the stored state untouched', () => {
    const g = evoGame(), before = JSON.stringify(g);
    try { evolve(g, ['toString']); } catch { /* expected */ }
    expect(JSON.stringify(g)).toBe(before);
  });
  it('a real sacrifice (a unit on another slot) still works', () => {
    let g = evoGame();
    g.players[0].field[3] = structuredClone(g.players[0].field[0]!);
    const out = evolve(g, [3]);
    expect(out.players[0].field[0]!.card.id).toBe('A40');
    expect(out.players[0].field[3]).toBeNull();
    expect(out.players[0].grave.every(c => c && typeof c.id === 'string')).toBe(true);
  });
});

describe('F-07 malformed action payloads never reach Array.prototype', () => {
  const mk = () => { const g = createGame([[...filler], [...filler]], 1, 0); g.players[0].hand = [sp('SPL-004'), sp('SPL-006'), ch('A15', 15)]; return g; };
  const bad: any[] = ['__proto__', 'length', 'constructor', '-1', 1.5, -1, null, {}, [], NaN, Infinity, 99999];
  it.each(bad.map(v => [v]))('cast target slot %j is rejected', (v) => {
    expect(() => act(mk(), { t: 'cast', hand: 0, target: { slot: v } } as any)).toThrow();
    expect(() => act(mk(), { t: 'cast', hand: 0, target: { grave: v } } as any)).toThrow();
  });
  it.each(bad.map(v => [v]))('summon/attack/fuse/set indexes %j are rejected', (v) => {
    expect(() => act(mk(), { t: 'summon', hand: v, slot: 0 } as any)).toThrow();
    expect(() => act(mk(), { t: 'summon', hand: 2, slot: v } as any)).toThrow();
    expect(() => act(mk(), { t: 'attack', from: v, to: 'player' } as any)).toThrow();
    expect(() => act(mk(), { t: 'attack', from: 0, to: v } as any)).toThrow();
    expect(() => act(mk(), { t: 'set', hand: v } as any)).toThrow();
    expect(() => act(mk(), { t: 'fuse', fusion: v, top: 0, bottom: 1, slot: 0 } as any)).toThrow();
  });
  it('unknown action types and non-objects are rejected', () => {
    expect(() => act(mk(), { t: 'hack' } as any)).toThrow();
    expect(() => act(mk(), null as any)).toThrow();
  });
  it('Array.prototype stays clean after hostile input', () => {
    for (const v of ['__proto__', 'constructor', 'length']) { try { act(mk(), { t: 'cast', hand: 0, target: { slot: v } } as any); } catch { /* expected */ } }
    expect(([] as any).bonusAtk).toBeUndefined();
    expect(Object.keys(Array.prototype)).toEqual([]);
    const k: string[] = []; for (const x in [1, 2]) k.push(x); expect(k).toEqual(['0', '1']);
  });
  it('valid cast with a real slot still works', () => {
    const g = createGame([[...filler], [...filler]], 1, 0); g.players[0].hand = [sp('SPL-005')];
    expect(() => act(g, { t: 'cast', hand: 0 })).not.toThrow();
  });
});
