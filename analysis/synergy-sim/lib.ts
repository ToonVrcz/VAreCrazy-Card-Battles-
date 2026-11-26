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
export const units = (g: Game, s: 0 | 1) => g.players[s].field.filter((x): x is Unit => !!x);
export const effAtk = (u: Unit) => Math.max(0, u.atk + u.bonusAtk + (u.auraAtk ?? 0));
export const effDef = (u: Unit) => Math.max(0, u.def + u.bonusDef + (u.auraDef ?? 0));
