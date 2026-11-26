// Audit B/C/D: archetype round-robin with the real engine + real Bot (read-only). Env: N (games per ordered pair), STORY=on|off, TIER=starter|adv, LP, CAP (none|number), TAG.
import { writeFileSync } from 'node:fs';
import { botPick } from '../../src/engine/bot.ts';
import { RULES } from '../../src/engine/game.ts';
import { createGame, BASE, SIG, CHARS, PAIRS, STORY, type Game, type CardDef } from './lib.ts';
import { VARIANTS, makeAct, type SynStats } from './synergy.ts';
const N = +(process.env.N ?? 40), STORYON = (process.env.STORY ?? 'on') === 'on', TIER = process.env.TIER ?? 'starter', FUSIONON = (process.env.FUSION ?? 'on') === 'on', SYNNAME = process.env.SYN ?? 'base', SYN = VARIANTS[SYNNAME] ?? null, TAG = process.env.TAG ?? `${TIER}-${STORYON ? 'story' : 'nostory'}-${SYNNAME}`;
RULES.lp = +(process.env.LP ?? 100); RULES.directCap = process.env.CAP === 'none' ? 1e9 : +(process.env.CAP ?? 60);
const all = new Map([...BASE, ...SIG].map(c => [c.id, c])); const L15 = (k: string) => CHARS.find(c => c.chain === k && c.level === 15)!;
const sp = (id: string) => all.get(id)!;
const R: Record<string, { chains: string[]; cards: [string, number][] }> = {
  Aggro: { chains: ['dnman', 'jaojay', 'mon', 'pikachu', 'cutie', 'melon', 'linlada'], cards: [['SPL-001', 3], ['SPL-004', 3], ['SPL-009', 2], ['SPL-007', 1], ['SPL-005', 3], ['TRP-006', 2], ['TRP-007', 2], ['TRP-003', 1], ['TRP-009', 2]] },
  Tank: { chains: ['thai32', 'skymoon', 'norman', 'oufilling', 'tee', 'lalaping', 'baby'], cards: [['SPL-003', 3], ['SPL-002', 3], ['SPL-005', 2], ['TRP-001', 3], ['TRP-008', 3], ['TRP-003', 2], ['TRP-002', 2], ['TRP-009', 1]] },
  Heal: { chains: ['satoshi', 'lalaping', 'smile', 'baby', 'zeesky', 'i-m-grape', 'thai32'], cards: [['SPL-002', 3], ['SPL-005', 3], ['SPL-006', 3], ['SPL-003', 2], ['TRP-008', 3], ['TRP-010', 2], ['TRP-001', 2], ['TRP-003', 1]] },
  Combo: { chains: ['badguy', 'backji', 'god-wa', 'nong-taengmo', 'jaojay', 'bammie', 'baby'], cards: [['FUS-001', 3], ['SPL-004', 3], ['SPL-005', 3], ['SPL-006', 2], ['SPL-001', 3], ['TRP-001', 2], ['TRP-009', 2], ['TRP-006', 1]] },
  Control: { chains: ['skymoon', 'zeesky', 'lucky', 'lordnam', 'chaem', 'pk', 'thomas'], cards: [['SPL-008', 3], ['SPL-009', 3], ['SPL-010', 2], ['SPL-007', 1], ['SPL-001', 2], ['TRP-001', 3], ['TRP-004', 3], ['TRP-005', 1], ['TRP-009', 2], ['TRP-007', 1]] },
};
const lcg = (s: number) => () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
function build(name: string): { main: CardDef[]; extra: CardDef[] } {
  const r = R[name], main: CardDef[] = [], n: Record<string, number> = {}, put = (c: CardDef | undefined, k = 1) => { for (let i = 0; i < k; i++) { if (!c || (n[c.id] ?? 0) >= 3 || main.length >= 40) return; n[c.id] = (n[c.id] ?? 0) + 1; main.push(c); } };
  for (const k of r.chains) put(L15(k), 3);
  if (TIER === 'adv') { for (const k of r.chains) for (const s of SIG.filter(c => c.type !== 'character' && (c as any).support?.link === k).slice(0, 2)) put(s, 2); }   // Signature support linked to the deck's chains (up to 2 cards x2 copies per chain), the Advanced collection
  for (const [id, k] of r.cards) { if (TIER === 'starter' && id === 'EVO-001') continue; put(sp(id), k); }
  if (TIER === 'adv') put(sp('EVO-001'), 3);
  for (let i = 0; main.length < 40 && i < 200; i++) put(L15(r.chains[i % r.chains.length]), 1);
  const extra = TIER === 'adv' ? CHARS.filter(c => c.level! > 15 && r.chains.includes(c.chain!)).sort((a, b) => a.level! - b.level!).slice(0, 15) : [];
  return { main: main.slice(0, 40), extra };
}
function randomDeck(seed: number): { main: CardDef[]; extra: CardDef[] } {
  const r = lcg(seed), chains = [...new Set(CHARS.map(c => c.chain!))].sort(() => r() - .5).slice(0, 7), main: CardDef[] = [], n: Record<string, number> = {};
  const put = (c: CardDef | undefined) => { if (!c || (n[c.id] ?? 0) >= 3 || main.length >= 40) return; n[c.id] = (n[c.id] ?? 0) + 1; main.push(c); };
  for (const k of chains) for (let i = 0; i < 3; i++) put(L15(k)); const sps = BASE.filter(c => c.type === 'spell'), trs = BASE.filter(c => c.type === 'trap');
  if (TIER === 'adv') for (let i = 0; i < 3; i++) put(sp('EVO-001'));
  for (let g = 0; main.length < 40 && g < 400; g++) put((g % 3 === 2 ? trs : sps)[Math.floor(r() * (g % 3 === 2 ? trs : sps).length)]);
  return { main, extra: TIER === 'adv' ? CHARS.filter(c => c.level! > 15 && chains.includes(c.chain!)).sort((a, b) => a.level! - b.level!).slice(0, 15) : [] };
}
const names = [...Object.keys(R), 'Random'];
const W: Record<string, Record<string, { w: number; l: number; t: number; turns: number; lpWin: number; dmg: number; lp: number; deaths: number; direct: number; boosted: number; unitAct: number }>> = {};
const dmgLog = { directHits: 0, directDmg: 0, maxDirect: 0, firstBlood: 0, lethalTurn: [] as number[] };
for (const a of names) { W[a] = {}; for (const b of names) W[a][b] = { w: 0, l: 0, t: 0, turns: 0, lpWin: 0, dmg: 0, lp: 0, deaths: 0, direct: 0, boosted: 0, unitAct: 0 }; }
for (const a of names) for (const b of names) {
  if (a === b) continue;
  for (let n = 1; n <= N; n++) {
    const da = a === 'Random' ? randomDeck(500 + n) : build(a), db = b === 'Random' ? randomDeck(900 + n) : build(b), first = (n % 2) as 0 | 1;
    let g: Game = createGame([da.main, db.main], 7000 + n, first, { storyLinks: STORYON ? STORY : [], fusionPairs: FUSIONON ? (PAIRS as any) : [], interactive: false, extras: [da.extra, db.extra] });
    const ss: SynStats = { unitActions: 0, boostedActions: 0, maxHpGranted: 0, defGranted: 0 }, act = makeAct(SYN, ss), rec = W[a][b]; let seen = 0;
    let st = 0; while (g.winner === null && st++ < 5000) {
      g = act(g, botPick(g));
      for (const e of g.events ?? []) if (e.id > seen) { if (e.t === 'dmg') rec.dmg += e.v ?? 0; else if (e.t === 'lp') { rec.lp += e.v ?? 0; rec.direct++; } else if (e.t === 'destroyed') rec.deaths++; }
      seen = g.evSeq ?? seen;
    }
    if (g.winner === 0) rec.w++; else if (g.winner === 1) rec.l++; else rec.t++; rec.turns += g.turn; rec.boosted += ss.boostedActions; rec.unitAct += ss.unitActions;
    if (g.winner !== null && g.players[1 - g.winner as 0 | 1].lp <= 0) rec.lpWin++;
  }
}
// aggregate: for ordered pair (a seat0, b seat1) the seats alternate first-player, so (a,b) and (b,a) both describe a-vs-b; combine
const M: any = {}; for (const a of names) { M[a] = {}; for (const b of names) if (a !== b) { const x = W[a][b], y = W[b][a]; const wins = x.w + y.l, games = x.w + x.l + x.t + y.w + y.l + y.t; M[a][b] = { winPct: +(100 * wins / Math.max(1, games)).toFixed(1), games, avgTurns: +((x.turns + y.turns) / Math.max(1, games)).toFixed(1), lpWinPct: +(100 * (x.lpWin + y.lpWin) / Math.max(1, games)).toFixed(0) }; } }
const overall: any = {}; for (const a of names) { let w = 0, gms = 0, tr = 0; for (const b of names) if (a !== b) { w += M[a][b].winPct * M[a][b].games / 100; gms += M[a][b].games; tr += M[a][b].avgTurns * M[a][b].games; } const rs = names.filter(b => b !== a).flatMap(b => [W[a][b], W[b][a]]), s = (k: 'turns' | 'dmg' | 'lp' | 'deaths' | 'direct' | 'lpWin' | 'boosted' | 'unitAct') => rs.reduce((q, r) => q + r[k], 0), gm = rs.reduce((q, r) => q + r.w + r.l + r.t, 0);
  overall[a] = { winPct: +(100 * w / gms).toFixed(1), games: gms, avgTurns: +(tr / gms).toFixed(1), dmgPerTurn: +((s('dmg') + s('lp')) / s('turns')).toFixed(2), unitDmgPerTurn: +(s('dmg') / s('turns')).toFixed(2), directPerGame: +(s('direct') / gm).toFixed(2), deathsPerGame: +(s('deaths') / gm).toFixed(2), lpWinPct: +(100 * s('lpWin') / gm).toFixed(0), synCoveragePct: +(100 * s('boosted') / Math.max(1, s('unitAct'))).toFixed(0) }; }
const out = { tag: TAG, syn: SYNNAME, fusion: FUSIONON, N, tier: TIER, story: STORYON, lp: RULES.lp, cap: RULES.directCap, decks: Object.fromEntries(names.filter(x => R[x]).map(x => [x, build(x).main.length + '+' + build(x).extra.length])), overall, M };
writeFileSync(new URL(`./out/${TAG}.json`, import.meta.url), JSON.stringify(out, null, 1)); console.log(TAG, JSON.stringify(overall));
