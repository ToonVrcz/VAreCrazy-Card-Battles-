// Pure helpers shared by the online rooms and the Universe module adapter (no node/db imports).
import type { CardDef, Game, FusionPair } from './game.ts';

/** Same recipe as the play screen: 7 random chains (fusion-pair chains first), EVO x3, spells x4, traps x3, FUS x2 if pairs exist. */
export function buildDeck(pool: CardDef[], pairs: FusionPair[], r: () => number = Math.random): CardDef[] {
  const pick = <T>(a: T[]) => a[Math.floor(r() * a.length)];
  const chars = pool.filter(c => c.type === 'character'), all = [...new Set(chars.map(c => c.chain!).filter(Boolean))];
  const pc = new Set(pairs.flatMap(p => [p.a, p.b]));
  const chains = all.sort(() => r() - 0.5).sort((x, y) => (pc.has(y) ? 1 : 0) - (pc.has(x) ? 1 : 0)).slice(0, 7), d: CardDef[] = [];
  for (const k of chains) { const f = (lv: number) => chars.find(x => x.chain === k && x.level === lv); const a = f(15); if (a) d.push(a, a); for (const lv of [40, 70]) { const x = f(lv); if (x) d.push(x); } }
  const add = (t: string, n: number) => { const p = pool.filter(c => c.type === t); if (p.length) for (let i = 0; i < n; i++) d.push(pick(p)); };
  const evo = pool.filter(c => c.id === 'EVO-001'); if (evo.length) for (let i = 0; i < 3; i++) d.push(evo[0]);
  add('spell', 4); add('trap', 3);
  const fus = pool.filter(c => c.id === 'FUS-001'); if (pairs.length && fus.length) d.push(fus[0], fus[0]);
  const l15 = chars.filter(c => c.level === 15); while (d.length < 40 && l15.length) d.push(pick(l15));
  return d.slice(0, 40).map(c => ({ ...c }));
}

/** Seat-relative, redacted copy of the game: players[0] is always the viewer. */
export function viewFor(g: Game, seat: 0 | 1) {
  const v = structuredClone({ ...g, pending: undefined }) as any, flip = seat === 1;
  if (flip) { v.players.reverse(); v.active = 1 - g.active; v.winner = g.winner === null ? null : 1 - g.winner; }
  const hide = { id: '?', name: '?', type: 'hidden' };
  const opp = v.players[1]; opp.hand = opp.hand.map(() => hide); opp.deck = opp.deck.map(() => hide);
  opp.back = opp.back.map((b: any) => (b ? { card: hide, setTurn: b.setTurn } : null));
  v.players[0].deck = v.players[0].deck.map(() => hide);          // you do not see your own deck order either
  v.seed = 0; delete v.fusion.pairs;
  const p = g.pending;
  if (p) { const mine = p.responder === seat; v.pending = { responder: flip ? 1 - p.responder : p.responder, event: p.event, options: mine ? p.options : [], action: p.action.t === 'attack' ? p.action : { t: p.action.t } }; }
  v.fusion = { pairs: g.fusion.pairs, topPct: g.fusion.topPct, bottomPct: g.fusion.bottomPct };
  v.log = g.log.slice(-30);
  return v;
}
