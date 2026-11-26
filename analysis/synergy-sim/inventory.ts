// Read-only inventory for the report: draw-effect cards in the free pool + Control Lv15 stats before/after (sim-only in-memory values).
import { CHARS, BASE } from './lib.ts';
const draws = CHARS.filter(c => c.level === 15 && (c.effects ?? []).some((e: any) => e.kind === 'draw'));
console.log('Lv15 characters with a Draw effect (' + draws.length + '/' + CHARS.filter(c => c.level === 15).length + '):');
for (const c of draws) console.log(' ', c.id, c.chain, JSON.stringify((c.effects as any[]).filter(e => e.kind === 'draw').map(e => ({ trigger: e.trigger, amount: e.amount, limit: e.limit, cost: e.cost }))));
console.log('Spells/traps in the basic pool that draw:'); for (const c of BASE.filter(x => x.type !== 'character')) if (c.id === 'SPL-005' || JSON.stringify(c).includes('draw')) console.log(' ', c.id, c.name);
const CT = ['skymoon', 'zeesky', 'lucky', 'lordnam', 'chaem', 'pk', 'thomas'];
const cfgs: [string, number, number][] = [['D', 0, 0], ['A+3', 3, 0], ['A+6', 6, 0], ['B+5', 0, 5], ['B+10', 0, 10], ['C+3/+5', 3, 5], ['C+6/+10', 6, 10]];
console.log('Control Lv15 (raw seed ATK/DEF; DEF12/10 tier bonus: ATK<=20 +12, 21-30 +10):');
for (const k of CT) { const c = CHARS.find(x => x.chain === k && x.level === 15)!; const b = (c.atk ?? 0) <= 20 ? 12 : (c.atk ?? 0) <= 30 ? 10 : 0; console.log(' ', c.id, 'HP', c.hp, 'ATK', c.atk, 'DEF', c.def, '| with tier DEF:', (c.def ?? 0) + b, '| ' + cfgs.map(([n, d, a]) => `${n}: ${(c.atk ?? 0) + a}/${(c.def ?? 0) + b + d}`).join('  ')); }
