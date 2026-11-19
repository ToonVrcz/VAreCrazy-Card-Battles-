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
