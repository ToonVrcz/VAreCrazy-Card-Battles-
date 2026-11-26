// SIMULATION ONLY: Game Synergy as an external post-action aura (the live engine is untouched). Hypothesis values come from
// docs/balance/FULL_GAME_BALANCE_GAME_SYNERGY_HANDOFF_2026-11-26.md. ATK bonus is structurally absent (no atk field exists).
import { readFileSync } from 'node:fs';
import { act as engineAct, type Game, type Unit } from './lib.ts';
export type Bonus = { hp: number; def: number };
export interface SynCfg { name: string; table: Record<string, Bonus>; min: number; scope: 'group' | 'all'; cap: Bonus | null; hp: boolean; def: boolean; hpMode: 'grow' | 'maxOnly' }
export const TABLE: Record<string, Bonus> = {
  'among-us': { hp: 3, def: 2 }, fivem: { hp: 3, def: 1 }, 'goose-goose-duck': { hp: 3, def: 2 }, rov: { hp: 3, def: 2 }, ragnarok: { hp: 3, def: 1 },
  roblox: { hp: 3, def: 1 }, warz: { hp: 3, def: 2 }, 'board-game': { hp: 3, def: 1 }, 'ghost-story': { hp: 3, def: 2 },
};
const base: SynCfg = { name: 'B2', table: TABLE, min: 2, scope: 'group', cap: null, hp: true, def: true, hpMode: 'grow' };
export const VARIANTS: Record<string, SynCfg | null> = {
  base: null,                                                                      // control: no Game Synergy
  B2: base,                                                                        // table, 2-unit activation, additive across groups, NO cap
  B3: { ...base, name: 'B3', cap: { hp: 10, def: 4 } },                            // + per-unit cap HP+10 / DEF+4
  B4: { ...base, name: 'B4', scope: 'all', cap: { hp: 10, def: 4 } },              // recipients = ALL friendly units once any group is active
  B5: { ...base, name: 'B5', def: false, cap: { hp: 10, def: 4 } },                // HP only
  B6: { ...base, name: 'B6', hp: false, cap: { hp: 10, def: 4 } },                 // DEF only
  B7: { ...base, name: 'B7', hpMode: 'maxOnly', cap: { hp: 10, def: 4 } },         // HP raises MAX only (no instant current-HP gain)
};
// affiliation data = read-only snapshot of production card_affiliations (chain|level|groups); levels without a row have NO group.
const AFF = new Map<string, string[]>();
for (const row of readFileSync(new URL('./data/game-affiliations-production.txt', import.meta.url), 'utf8').trim().split(';')) { const [c, l, g] = row.split('|'); AFF.set(c + '|' + l, g.split(',')); }
export const groupsOf = (u: Unit): string[] => AFF.get(`${u.card.chain}|${u.card.level}`) ?? [];
export interface SynStats { unitActions: number; boostedActions: number; maxHpGranted: number; defGranted: number }
/** Call right AFTER engine act() (which has just run refreshAuras): recomputes the aura from the current field. */
export function applySynergy(g: Game, cfg: SynCfg, st?: SynStats) {
  for (const pi of [0, 1] as const) {
    const us = g.players[pi].field.filter((x): x is Unit => !!x), members = new Map<string, Unit[]>();
    for (const u of us) for (const gr of groupsOf(u)) if (cfg.table[gr]) (members.get(gr) ?? members.set(gr, []).get(gr)!).push(u);
    const bonus = new Map<Unit, Bonus>();
    for (const [gr, ms] of members) {
      if (ms.length < cfg.min) continue;                                            // not active: fewer than N distinct units
      const b = cfg.table[gr];
      for (const u of cfg.scope === 'group' ? ms : us) { const x = bonus.get(u) ?? { hp: 0, def: 0 }; x.hp += cfg.hp ? b.hp : 0; x.def += cfg.def ? b.def : 0; bonus.set(u, x); }
    }
    for (const u of us) {
      const a = u as any, b = bonus.get(u) ?? { hp: 0, def: 0 };
      const hp = cfg.cap ? Math.min(b.hp, cfg.cap.hp) : b.hp, def = cfg.cap ? Math.min(b.def, cfg.cap.def) : b.def;
      u.auraDef = (u.auraDef ?? 0) + def; a.synDef = def;                            // refreshAuras reset auraDef moments ago, so this never double-counts
      const d = hp - (a.synHp ?? 0);
      if (d) { u.maxHp += d; if (d > 0) { if (cfg.hpMode === 'grow') u.hp += d; } else u.hp = Math.max(1, Math.min(u.hp, u.maxHp)); a.synHp = hp; }
      if (st) { st.unitActions++; if (hp || def) st.boostedActions++; }
    }
  }
}
export function makeAct(cfg: SynCfg | null, st?: SynStats) {
  return (g: Game, a: any): Game => { const out = engineAct(g, a); if (cfg) applySynergy(out, cfg, st); return out; };
}
