import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { REGISTRY, entries, validateSystem, toLegacy, fromLegacy, optionsFor, type SystemConfig } from '../src/engine/effect-registry';
import { parseEffect } from '../src/engine/effects';

// Enumerate every combination the Editor could produce (all Registry keys incl. unsupported ones, sample params).
function* combos(): Generator<SystemConfig> {
  const k = (c: any) => entries(c).map(e => e.key);
  for (const trigger of k('trigger')) for (const condition of [null, ...k('condition')]) for (const cost of [null, ...k('cost')])
    for (const target of k('target')) for (const duration of k('duration')) for (const use_limit of k('use_limit'))
      for (const action of k('action')) {
        const shapes: Partial<SystemConfig>[] = action === 'heal' ? [{ amount: 3 }, { full: true }]
          : action === 'atk_up' ? [{ amount: 2 }, { amount: 2, perm: true }, { amount: 2, perm: true, max: 4 }]
          : ['atk_down', 'damage', 'draw', 'maxhp_up'].includes(action) ? [{ amount: 2 }] : [{}];
        for (const sh of shapes) yield { trigger, condition, cost, target, action, duration, use_limit, ...sh } as SystemConfig;
      }
}

describe('Effect Registry parity with the engine parser', () => {
  it('everything the Registry accepts is accepted by parseEffect, and round-trips', () => {
    let accepted = 0, total = 0;
    for (const s of combos()) {
      total++;
      if (validateSystem(s).length) continue;
      accepted++;
      const row = toLegacy(s);
      const eff = parseEffect({ ...row, description: 'x' });
      expect(eff, JSON.stringify(s)).not.toBeNull();
      const back = fromLegacy(row)!;
      expect(back, JSON.stringify(s)).not.toBeNull();
      expect(toLegacy(back), JSON.stringify(s)).toEqual(row);
      expect(eff!.trigger).toBe(s.trigger);
      expect(eff!.limit).toBe({ none: 'none', once_per_turn: 'turn', once_per_game: 'game' }[s.use_limit]);
    }
    expect(total).toBeGreaterThan(5000);
    expect(accepted).toBeGreaterThan(50);
  });

  it('what the parser accepts but the Registry rejects is only a documented set of odd combinations', () => {
    const odd: string[] = [];
    for (const s of combos()) {
      if (validateSystem(s).length === 0) continue;
      if (parseEffect({ ...toLegacy(s), description: 'x' })) odd.push(JSON.stringify(s));
    }
    // Known: the parser tolerates unsupported-for-the-editor keys only where its own wording matches; none expected except these shapes.
    const unexpected = odd.filter(j => {
      const s = JSON.parse(j) as SystemConfig;
      const looseDuration = s.action === 'atk_up' && s.perm && s.duration !== 'permanent';   // parser ignores duration when the text says ถาวร
      const passiveTemp = s.trigger === 'passive' && s.action === 'atk_down';                       // parser accepts a temporary ATK drop on passive
      const unsupportedKey = s.cost === 'sacrifice';   // this wording is not representable, so the legacy row simply has no cost
      const passiveFlags = s.trigger === 'passive' && s.action === 'atk_up' && !!s.perm;           // the flag is ignored by the parser; the Registry asks the Editor not to set it
      return !(passiveFlags || looseDuration || passiveTemp || unsupportedKey);
    });
    expect(unexpected.slice(0, 5)).toEqual([]);
  });

  it('unsupported entries never validate', () => {
    for (const e of REGISTRY.filter(x => x.status === 'unsupported')) {
      const s = { trigger: 'on_summon', target: 'self', action: 'draw', amount: 1, duration: 'instant', use_limit: 'none' } as SystemConfig;
      const f = e.category as 'trigger';
      const issues = validateSystem({ ...s, [f]: e.key } as SystemConfig);
      expect(issues.some(i => i.code === 'unsupported'), e.key).toBe(true);
    }
  });

  it('every seeded production-style effect row is either understood by the Registry or not run by the engine', async () => {
    const cards: any[] = JSON.parse(readFileSync('db/seed/toon-cards.json', 'utf8'));
    const rows = cards.flatMap(c => (c.effects ?? []).map((e: any) => ({ ...e, card_type: c.card_type })));
    expect(rows.length).toBeGreaterThan(50);
    let runnable = 0;
    for (const r of rows.filter((x: any) => x.card_type === 'character')) {
      const eff = parseEffect(r);
      const sys = fromLegacy(r);
      if (eff) {
        runnable++;
        expect(sys, `${r.action_text}`).not.toBeNull();
        expect(validateSystem(sys!), `${r.trigger} ${r.target_text} ${r.action_text} ${r.duration}`).toEqual([]);
        expect(toLegacy(sys!)).toMatchObject({ trigger: r.trigger, target_text: r.target_text, action_text: r.action_text, use_limit: r.use_limit });
      }
    }
    expect(runnable).toBeGreaterThan(10);
  });

  it('optionsFor switches off clashing choices', () => {
    const s = { trigger: 'passive', target: 'self', action: 'atk_up', amount: 1, duration: 'permanent', use_limit: 'none' } as SystemConfig;
    const acts = optionsFor('action', 'action', s);
    expect(acts.find(o => o.key === 'draw')!.enabled).toBe(false);
    expect(acts.find(o => o.key === 'maxhp_up')!.enabled).toBe(true);
    const trg = optionsFor('trigger', 'trigger', s);
    expect(trg.find(o => o.key === 'on_cast')!.enabled).toBe(false);
  });
});
