// SIMULATION ONLY. Imports the real engine read-only; nothing under src/, db/ or public/ is modified. Game Synergy lives entirely in this folder.
import { readFileSync } from 'node:fs';
import { createGame, act, legalActions, refreshAuras, type CardDef, type Game, type StoryLink, type Unit } from '../../src/engine/game.ts';
import { seedCards } from '../../src/engine/cards.ts';
export { createGame, act, legalActions, refreshAuras };
export type { CardDef, Game, StoryLink, Unit };
const here = (f: string) => new URL(f, import.meta.url);
const R = (f: string) => JSON.parse(readFileSync(new URL('../../db/seed/' + f, import.meta.url), 'utf8'));
// Story: db/seed/story-links.json holds all 29 production rows on this revision (8 baseline + 21 owner rows) -> de-duplicated by (a,b) defensively.
const dd = (xs: StoryLink[]) => { const m = new Map<string, StoryLink>(); for (const l of xs) m.set(l.a + '|' + l.b, l); return [...m.values()]; };
export const STORY: StoryLink[] = dd(R('story-links.json').map((l: any) => ({ a: l.a, b: l.b, name: l.name, mods: l.mods })));
// Fusion pairs: production has 37 pairs (read-only SELECT from card_fusion_partners 2026-11-26); the repo seed has 1.
export const PAIRS = JSON.parse(readFileSync(here('./data/fusion-pairs-production-37.json'), 'utf8'));
export const BASE: CardDef[] = seedCards();
export const SIG: CardDef[] = R('signature-cards.json').map((c: any): CardDef => ({ id: c.character_id, name: c.name, type: c.card_type, level: null, chain: null, hp: null, atk: null, def: 0, element: null, support: c.support, effects: [] }));
export const CHARS = BASE.filter(c => c.type === 'character');
// SIM-ONLY balance lever (in-memory, never written anywhere): TUNE="a,b[,c]" raises DEF of FREE Lv15 characters by role (shop cards Lv40+ are never touched): base ATK <= 20 -> +a, 21..30 -> +b, >= 31 -> +c. HP and ATK are never touched.
if (process.env.TUNE) { const [a, b, hi = 0] = process.env.TUNE.split(',').map(Number); for (const c of CHARS.filter(x => x.level === 15)) { const k = c.atk ?? 0; if (k <= 20) c.def = (c.def ?? 0) + a; else if (k <= 30) c.def = (c.def ?? 0) + b; else c.def = (c.def ?? 0) + hi; } }
// SIM-ONLY (in memory): DEFADD="chain:delta,chain:delta" adds DEF to Lv15 characters of that chain GLOBALLY (every deck that uses the card sees the same value, like real card data would).
if (process.env.DEFADD) { const m = new Map(process.env.DEFADD.split(',').filter(Boolean).map(s => s.split(':') as [string, string])); for (const c of CHARS.filter(x => x.level === 15 && m.has(x.chain ?? ''))) c.def = (c.def ?? 0) + Number(m.get(c.chain!)); }
export const units = (g: Game, s: 0 | 1) => g.players[s].field.filter((x): x is Unit => !!x);
export const effAtk = (u: Unit) => Math.max(0, u.atk + u.bonusAtk + (u.auraAtk ?? 0));
export const effDef = (u: Unit) => Math.max(0, u.def + u.bonusDef + (u.auraDef ?? 0));
