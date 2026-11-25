// Signature support registry: vocabulary parity with the engine, validator, and the Draft-only save route.
import { describe, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { migrateUp } from '../db/migrate';
import { CardService, type User } from '../src/server/service';
import { SUPPORT_OPS, SUPPORT_TRIGGERS, SUPPORT_WHO, SUPPORT_UNTIL, OP_PARAMS, SUPPORT_LABELS, validateSupport } from '../src/engine/support-registry';

const GAME = readFileSync('src/engine/game.ts', 'utf8'), SEED = readFileSync('db/seed/signature-cards.sql', 'utf8');
const union = (re: RegExp) => [...(GAME.match(re)?.[1] ?? '').matchAll(/'([a-z_0-9]+)'/g)].map(m => m[1]);

describe('registry parity with the engine', () => {
  it('lists exactly the ops, triggers, who and until values declared by the engine types', () => {
    expect([...SUPPORT_OPS].sort()).toEqual(union(/interface SupportOp \{ op: ([^;]+?);\s*who/).sort());
    expect([...SUPPORT_TRIGGERS].sort()).toEqual(union(/type TrapTrigger = ([^;]+);/).sort());
    expect([...SUPPORT_WHO].sort()).toEqual(union(/type SupportWho = ([^;]+);/).sort());
    expect([...SUPPORT_UNTIL].sort()).toEqual(union(/until\?: ([^}]+) \}/).sort());
  });
  it('every op and trigger is actually handled by the engine code, and has a Thai label and a param spec', () => {
    for (const o of SUPPORT_OPS) { if (o !== 'survive_at_1') expect(GAME.split(`'${o}'`).length, o).toBeGreaterThan(2); expect(OP_PARAMS[o], o).toBeTruthy(); expect((SUPPORT_LABELS.op as any)[o], o).toBeTruthy(); }
    expect(GAME).toMatch(/fire\(g, pi, 'effect_destroy', u\)\) \{ u\.hp = 1/);   // survive_at_1 is declarative: the handler for effect_destroy does it
    for (const t of SUPPORT_TRIGGERS) { expect(GAME.split(`'${t}'`).length, t).toBeGreaterThan(2); expect((SUPPORT_LABELS.trigger as any)[t], t).toBeTruthy(); }
    for (const w of SUPPORT_WHO) expect((SUPPORT_LABELS.who as any)[w], w).toBeTruthy();
  });
});

describe('validateSupport', () => {
  it('accepts all 39 seeded Signature configs', async () => {
    const db = new PGlite(); await migrateUp(db); await db.exec(SEED);
    const rows = (await db.query<any>(`SELECT c.character_id, c.card_type, c.support, ch.key FROM cards c LEFT JOIN evolution_chains ch ON ch.id=c.chain_id WHERE c.support IS NOT NULL`)).rows;
    expect(rows.length).toBe(39);
    for (const r of rows) { const v = validateSupport(typeof r.support === 'string' ? JSON.parse(r.support) : r.support, { cardType: r.card_type }); expect(v.errors, r.character_id).toEqual([]); }
  });
  const spell = (o: any = {}) => ({ kind: 'spell', link: 'k', ops: [{ op: 'buff', who: 'link', stat: 'atk', amount: 10, until: 'turn' }], ...o });
  it('rejects unknown or malformed values', () => {
    const bad = (s: any, re: RegExp, opts = {}) => expect(validateSupport(s, opts).errors.join(';')).toMatch(re);
    bad(null, /ออบเจ็กต์/); bad(spell({ kind: 'x' }), /kind/); bad(spell({ link: '' }), /link/);
    bad(spell({ ops: [] }), /ops/); bad(spell({ ops: [{ op: 'nuke' }] }), /ไม่รู้จัก/);
    bad(spell({ ops: [{ op: 'buff', who: 'link', amount: 1 }] }), /ATK หรือ DEF/);
    bad(spell({ ops: [{ op: 'heal', who: 'link' }] }), /จำนวน/);
    bad(spell({ ops: [{ op: 'heal', who: 'link', amount: 1.5 }] }), /จำนวนเต็ม/);
    bad(spell({ ops: [{ op: 'heal', who: 'moon', amount: 1 }] }), /who/);
    bad(spell({ ops: [{ op: 'buff', who: 'link', stat: 'atk', amount: 1, until: 'forever' }] }), /until/);
    bad(spell({ trigger: 'enemy_attack' }), /ไม่มี trigger/);
    bad({ kind: 'trap', link: 'k', ops: [{ op: 'negate_target' }] }, /trigger/);
    bad({ kind: 'trap', link: 'k', trigger: 'enemy_attack', ops: [{ op: 'heal', who: 'enemy', amount: 1 }] }, /เป้าศัตรู/);
    bad(spell({ ops: [{ op: 'negate_target' }] }), /เฉพาะกับดัก/);
    bad(spell(), /ไม่ตรงกับประเภท/, { cardType: 'trap' });
    bad(spell(), /ไม่พบสาย/, { chains: ['other'] });
  });
  it('strips unknown keys', () => {
    const v = validateSupport(spell({ evil: 1, ops: [{ op: 'draw', amount: 1, junk: 'x' }] }));
    expect(v.errors).toEqual([]); expect(v.clean).toEqual({ kind: 'spell', link: 'k', ops: [{ op: 'draw', amount: 1 }] });
  });
});

describe('CardService.saveSupport', () => {
  async function world() {
    const db = new PGlite(); await migrateUp(db); await db.exec(SEED);
    const svc = new CardService(db, '/tmp/vcz-test-storage');
    const mk = async (email: string, role: any) => { await svc.createUser(email, 'password123', role); return (await svc.login(email, 'password123')).user as User; };
    for (const k of ['1goku', 'thai32']) await db.query(`INSERT INTO evolution_chains(key,name) VALUES ($1,$1) ON CONFLICT DO NOTHING`, [k]);
    const ed = await mk('e@x.com', 'card_editor'), viewer = await mk('v@x.com', 'viewer');
    const id = (cid: string) => db.query<any>(`SELECT id FROM cards WHERE character_id=$1`, [cid]).then(r => r.rows[0].id as string);
    return { db, svc, ed, viewer, id };
  }
  it('getCard exposes support; an editor can change a Draft; the change is audit-logged', async () => {
    const { db, svc, ed, id } = await world(); const cid = await id('SPL-011');
    const c: any = await svc.getCard(ed, cid); expect(c.support.ops[0].amount).toBe(10);
    const next = { ...c.support, ops: [{ op: 'buff', who: 'link', stat: 'atk', amount: 15, until: 'turn' }] };
    const r: any = await svc.saveSupport(ed, cid, { support: next }); expect(r.support.ops[0].amount).toBe(15);
    expect((await db.query<any>(`SELECT count(*)::int n FROM audit_log WHERE action='support:update'`)).rows[0].n).toBe(1);
  });
  it('rejects: viewer, non-draft, non-spell/trap, invalid config, unknown chain', async () => {
    const { db, svc, ed, viewer, id } = await world(); const cid = await id('SPL-011'), sup = ((await svc.getCard(ed, cid)) as any).support;
    await expect(svc.saveSupport(viewer, cid, { support: sup })).rejects.toThrow(/ไม่มีสิทธิ์/);
    await expect(svc.saveSupport(ed, cid, { support: { ...sup, ops: [{ op: 'nuke' }] } })).rejects.toThrow(/ไม่รู้จัก/);
    await expect(svc.saveSupport(ed, cid, { support: { ...sup, link: 'no-such-chain' } })).rejects.toThrow(/ไม่พบสาย/);
    await expect(svc.saveSupport(ed, cid, {})).rejects.toThrow(/ออบเจ็กต์/);
    await db.query(`UPDATE cards SET status='published' WHERE id=$1`, [cid]);
    await expect(svc.saveSupport(ed, cid, { support: sup })).rejects.toThrow(/Draft/);
    const ch = (await db.query<any>(`SELECT id FROM cards WHERE card_type='character' LIMIT 1`)).rows[0];
    if (ch) await expect(svc.saveSupport(ed, ch.id, { support: sup })).rejects.toThrow(/เวทมนตร์\/กับดัก/);
  });
});
