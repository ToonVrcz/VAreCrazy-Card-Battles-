// Browser bundle for the play screen: engine + bot + all seed cards (images/text for the UI).
import * as G from './engine/game';
import { botPick } from './engine/bot';
import { viewEvents, formatEvent, createNotifier, squash } from './engine/events';
import toon from '../db/seed/toon-cards.json' with { type: 'json' };
import support from '../db/seed/support-cards.json' with { type: 'json' };
import traps from '../db/seed/trap-cards.json' with { type: 'json' };
import { parseEffect } from './engine/effects';
import fusionPairs from '../db/seed/fusion-pairs.json' with { type: 'json' };
import spells from '../db/seed/spell-cards.json' with { type: 'json' };
export const pairs: G.FusionPair[] = fusionPairs as any;
export const engine = { ...G, botPick, viewEvents, formatEvent, createNotifier, squash };
export const defs = [...toon, ...support, ...traps, ...spells].map((c: any) => ({
  id: c.character_id, name: c.name, type: c.card_type, level: c.level ?? null, chain: c.chain_key ?? null, chainName: c.chain_name ?? null,
  hp: c.hp ?? null, atk: c.atk ?? null, def: c.def ?? 0, element: c.element ?? null, img: '/' + c.image_path,
  text: c.rules_text ?? '', flavor: c.flavor_text ?? '', fx: (c.effects ?? []).map((e: any) => ({ t: e.description, ok: !!parseEffect(e) })),
  effects: (c.effects ?? []).map(parseEffect).filter(Boolean) }));
