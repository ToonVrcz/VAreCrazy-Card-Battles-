// Pure helpers shared by the online rooms and the Universe module adapter (no node/db imports).
import type { CardDef, Game, FusionPair } from './game.ts';
import { viewEvents } from './events.ts';

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
  if (v.players[1].extra) v.players[1].extra = v.players[1].extra.map(() => hide);
  const opp = v.players[1]; opp.hand = opp.hand.map(() => hide); opp.deck = opp.deck.map(() => hide);
  opp.back = opp.back.map((b: any) => (b ? { card: hide, setTurn: b.setTurn } : null));
  v.players[0].deck = v.players[0].deck.map(() => hide);          // you do not see your own deck order either
  v.seed = 0; delete v.fusion.pairs;
  delete v.stats;                                                   // server-side action counters (anti-farming data) never reach a client
  const p = g.pending;
  if (p) { const mine = p.responder === seat; v.pending = { responder: flip ? 1 - p.responder : p.responder, event: p.event, options: mine ? p.options : [], info: mine ? p.info : undefined, action: p.action.t === 'attack' ? p.action : { t: p.action.t } }; }
  v.fusion = { pairs: g.fusion.pairs, topPct: g.fusion.topPct, bottomPct: g.fusion.bottomPct };
  v.log = g.log.slice(-30);
  v.events = viewEvents(g.events, seat);                           // viewer-relative (0 = you) and redacted; evSeq stays so a client knows how many it missed
  return v;
}

/** Custom deck rules (server is the authority; the play screen mirrors them for friendly messages). */
export const DECK_RULES = { size: 40, maxCopies: 3, minLv15: 3 } as const;
export function validateDeck(ids: unknown, byId: Map<string, CardDef>): string | null {
  if (!Array.isArray(ids) || ids.some(x => typeof x !== 'string')) return 'รูปแบบเด็คไม่ถูกต้อง';
  if (ids.length !== DECK_RULES.size) return `เด็คต้องมี ${DECK_RULES.size} ใบ (ตอนนี้ ${ids.length})`;
  const n = new Map<string, number>();
  for (const id of ids as string[]) {
    if (!byId.has(id)) return `ไม่พบการ์ด ${id} (อาจถูกถอดออกแล้ว)`;
    if (isForm(byId.get(id)!)) return `${byId.get(id)!.name} (Lv.${byId.get(id)!.level}) ต้องใส่ในเด็คอีโว ไม่ใช่เด็คหลัก`;
    const k = (n.get(id) ?? 0) + 1; n.set(id, k);
    if (k > DECK_RULES.maxCopies) return `${byId.get(id)!.name} ใส่ได้ไม่เกิน ${DECK_RULES.maxCopies} ใบ`;
  }
  const l15 = (ids as string[]).filter(id => { const c = byId.get(id)!; return c.type === 'character' && c.level === 15; }).length;
  if (l15 < DECK_RULES.minLv15) return `ต้องมีตัวละคร Lv.15 อย่างน้อย ${DECK_RULES.minLv15} ใบ (ตอนนี้ ${l15})`;
  return null;
}
export const deckFromIds = (ids: string[], byId: Map<string, CardDef>): CardDef[] => ids.map(id => ({ ...byId.get(id)! }));

/** Evolution deck (Lv40/70/99 forms, separate from the 40-card main deck). Copies are limited by what the player owns. */
export const EVO_RULES = { max: 15, maxCopies: 3 } as const;
export const isForm = (c: CardDef) => c.type === 'character' && (c.level ?? 0) > 15;
export function validateEvoDeck(ids: unknown, byId: Map<string, CardDef>, owned: Map<string, number>): string | null {
  if (!Array.isArray(ids) || ids.some(x => typeof x !== 'string')) return 'รูปแบบเด็คอีโวไม่ถูกต้อง';
  if (ids.length > EVO_RULES.max) return `เด็คอีโวมีได้ไม่เกิน ${EVO_RULES.max} ใบ (ตอนนี้ ${ids.length})`;
  const n = new Map<string, number>();
  for (const id of ids as string[]) {
    const c = byId.get(id); if (!c || !isForm(c)) return `${c?.name ?? id} ใส่ในเด็คอีโวไม่ได้`;
    const k = (n.get(id) ?? 0) + 1; n.set(id, k);
    if (k > Math.min(EVO_RULES.maxCopies, owned.get(id) ?? 0)) return `คุณมี ${c.name} ไม่พอ (มี ${owned.get(id) ?? 0} ใบ)`;
  }
  return null;
}

/** Main deck + Evolution deck for a random game. Forms are never in the main deck. `extraOf` decides which forms the seat may use. */
export function buildSet(pool: CardDef[], pairs: FusionPair[], r: () => number = Math.random, extraOf?: (chainKeys: string[]) => CardDef[]): { main: CardDef[]; extra: CardDef[] } {
  const pick = <T>(a: T[]) => a[Math.floor(r() * a.length)];
  const chars = pool.filter(c => c.type === 'character'), all = [...new Set(chars.map(c => c.chain!).filter(Boolean))];
  const pc = new Set(pairs.flatMap(p => [p.a, p.b]));
  const chains = all.sort(() => r() - 0.5).sort((x, y) => (pc.has(y) ? 1 : 0) - (pc.has(x) ? 1 : 0)).slice(0, 7), d: CardDef[] = [], n = new Map<string, number>();
  const put = (c: CardDef | undefined, cap = DECK_RULES.maxCopies) => { if (!c || (n.get(c.id) ?? 0) >= cap || d.length >= DECK_RULES.size) return false; n.set(c.id, (n.get(c.id) ?? 0) + 1); d.push(c); return true; };
  for (const k of chains) { const a = chars.find(x => x.chain === k && x.level === 15); for (let i = 0; i < 3; i++) put(a); }
  const evo = pool.find(c => c.id === 'EVO-001'); for (let i = 0; i < 3; i++) put(evo);
  const fus = pool.find(c => c.id === 'FUS-001'); if (pairs.length) for (let i = 0; i < 2; i++) put(fus);
  const sp = pool.filter(c => c.type === 'spell'), tr = pool.filter(c => c.type === 'trap');
  for (let g = 0; d.length < DECK_RULES.size && g < 400 && (sp.length || tr.length); g++) put(pick(g % 3 === 2 && tr.length ? tr : sp.length ? sp : tr));
  const l15 = chars.filter(c => c.level === 15); for (let g = 0; d.length < DECK_RULES.size && g < 400 && l15.length; g++) put(pick(l15));
  const forms = extraOf ? extraOf(chains) : [];
  return { main: d.map(c => ({ ...c })), extra: forms.slice(0, EVO_RULES.max).map(c => ({ ...c })) };
}
