import { readFileSync } from 'node:fs';
import type { CardDef } from './game';
import { parseEffect } from './effects';
const load = (f: string): any[] => JSON.parse(readFileSync(new URL(`../../db/seed/${f}`, import.meta.url), 'utf8'));
/** All draft cards from the seed files as engine card definitions. */
export const seedCards = (): CardDef[] => ['toon-cards.json', 'support-cards.json', 'trap-cards.json', 'spell-cards.json'].flatMap(load).map(c => ({
  id: c.character_id, name: c.name, type: c.card_type, level: c.level ?? null, chain: c.chain_key ?? null, hp: c.hp ?? null, atk: c.atk ?? null, def: c.def ?? 0, element: c.element ?? null,
  effects: (c.effects ?? []).map(parseEffect).filter(Boolean) }));
