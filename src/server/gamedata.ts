import { CardService, AppError, User, can } from './service.ts';

const STATS = ['hp', 'atk', 'def'];
const MATCH = ['class', 'affiliation', 'element', 'story'];
const need = (u: User, p: string) => { if (!can(u, p)) throw new AppError(403, `ไม่มีสิทธิ์: ${p}`); };
const bad = (m: string): never => { throw new AppError(400, m); };

/** Game systems from GDD v0.3: rules, affiliation, gender, story, synergy, fusion, deck validation. */
export class GameData {
  constructor(private svc: CardService) {}
  private get db() { return this.svc.db; }

  // ---- game rules ----
  async rules(u: User) { need(u, 'read'); return (await this.db.query<any>(`SELECT key,label,value,status,note FROM game_rules ORDER BY key`)).rows; }
  async ruleValue(key: string) { return (await this.db.query<any>(`SELECT value FROM game_rules WHERE key=$1`, [key])).rows[0]?.value; }
  async setRule(u: User, key: string, value: unknown, status?: string) {
    need(u, 'users');
    if (status && !['confirmed', 'proposed'].includes(status)) bad('status ต้องเป็น confirmed หรือ proposed');
    const r = await this.db.query<any>(
      `UPDATE game_rules SET value=$2::jsonb, status=COALESCE($3,status), updated_at=now() WHERE key=$1 RETURNING key`,
      [key, JSON.stringify(value ?? null), status ?? null]);
    if (!r.rows.length) throw new AppError(404, 'ไม่พบกติกา');
    await this.svc.audit(u, 'rule.update', key, { value, status }, 'rule');
    return { ok: true };
  }

  // ---- affiliation / gender ----
  async taxValues(u: User, tax: string) {
    need(u, 'read');
    return (await this.db.query<any>(`SELECT key,name FROM taxonomy_values WHERE taxonomy_key=$1 ORDER BY name`, [tax])).rows;
  }
  async upsertGender(u: User, b: { key: string; name?: string }) {
    need(u, 'write');
    if (!/^[a-z0-9_-]{2,40}$/.test(b.key ?? '')) bad('key ต้องเป็น a-z 0-9 _ - ยาว 2–40');
    await this.db.query(
      `INSERT INTO taxonomy_values(taxonomy_key,key,name) VALUES ('gender',$1,$2)
       ON CONFLICT (taxonomy_key,key) DO UPDATE SET name=EXCLUDED.name`, [b.key, b.name || b.key]);
    await this.svc.audit(u, 'gender.upsert', b.key, b, 'gender');
    return { ok: true };
  }
  async affiliations(u: User) {
    need(u, 'read');
    const a = (await this.db.query<any>(
      `SELECT v.id,v.key,v.name,
         (SELECT count(*)::int FROM card_affiliations ca WHERE ca.value_id=v.id) members
       FROM taxonomy_values v WHERE v.taxonomy_key='affiliation' ORDER BY v.name`)).rows;
    const s = (await this.db.query<any>(`SELECT * FROM affiliation_synergies ORDER BY min_members`)).rows;
    return a.map(x => ({ ...x, synergies: s.filter(y => y.affiliation_id === x.id) }));
  }
  async upsertAffiliation(u: User, b: { key: string; name?: string }) {
    need(u, 'write');
    if (!/^[a-z0-9_-]{2,40}$/.test(b.key ?? '')) bad('key ต้องเป็น a-z 0-9 _ - ยาว 2–40');
    await this.db.query(
      `INSERT INTO taxonomy_values(taxonomy_key,key,name) VALUES ('affiliation',$1,$2)
       ON CONFLICT (taxonomy_key,key) DO UPDATE SET name=EXCLUDED.name`, [b.key, b.name || b.key]);
    await this.svc.audit(u, 'affiliation.upsert', b.key, b, 'affiliation');
    return { ok: true };
  }
  async upsertSynergy(u: User, b: any) {
    need(u, 'write');
    if (!STATS.includes(b.stat)) bad('stat ต้องเป็น hp/atk/def');
    if (!Number.isInteger(b.amount) || b.amount === 0) bad('amount ต้องเป็นจำนวนเต็มไม่ใช่ 0');
    if (!(b.min_members >= 2)) bad('min_members ต้อง ≥ 2');
    const v = (await this.db.query<any>(`SELECT id FROM taxonomy_values WHERE taxonomy_key='affiliation' AND key=$1`, [b.affiliation])).rows[0];
    if (!v) bad('ไม่พบสังกัด');
    await this.db.query(
      `INSERT INTO affiliation_synergies(affiliation_id,min_members,stat,amount,max_stacks,description) VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (affiliation_id,min_members,stat) DO UPDATE SET amount=EXCLUDED.amount,max_stacks=EXCLUDED.max_stacks,description=EXCLUDED.description`,
      [v.id, b.min_members, b.stat, b.amount, b.max_stacks ?? 1, b.description ?? null]);
    await this.svc.audit(u, 'synergy.upsert', b.affiliation, b, 'affiliation');
    return { ok: true };
  }
  async deleteSynergy(u: User, id: string) { need(u, 'write'); await this.db.query(`DELETE FROM affiliation_synergies WHERE id=$1`, [id]); return { ok: true }; }

  /** Synergy bonus for a set of characters on the field (stack-capped). */
  async synergyBonus(characterIds: string[]) {
    const rows = (await this.db.query<any>(
      `SELECT v.key aff, count(DISTINCT c.id)::int n FROM cards c
         JOIN card_affiliations ca ON ca.card_id=c.id JOIN taxonomy_values v ON v.id=ca.value_id
        WHERE c.character_id = ANY($1) GROUP BY v.key`, [characterIds])).rows;
    const out: { affiliation: string; stat: string; amount: number }[] = [];
    for (const r of rows) {
      const syn = (await this.db.query<any>(
        `SELECT s.* FROM affiliation_synergies s JOIN taxonomy_values v ON v.id=s.affiliation_id
          WHERE v.key=$1 AND s.min_members<=$2`, [r.aff, r.n])).rows;
      const byStat: Record<string, any> = {};
      for (const s of syn) if (!byStat[s.stat] || s.min_members > byStat[s.stat].min_members) byStat[s.stat] = s;   // highest tier only
      for (const s of Object.values(byStat)) out.push({ affiliation: r.aff, stat: s.stat, amount: s.amount * Math.min(s.max_stacks, Math.floor(r.n / s.min_members)) });
    }
    return out;
  }

  // ---- gender + affiliation of a card ----
  private async cardRow(ref: string) {
    const r = (await this.db.query<any>(`SELECT id,status FROM cards WHERE id::text=$1 OR character_id=$1`, [ref])).rows[0];
    if (!r) throw new AppError(404, 'ไม่พบการ์ด'); return r;
  }
  async chains(u: User) {
    need(u, 'read');
    return (await this.db.query<any>(`SELECT ch.key, ch.name FROM evolution_chains ch ORDER BY ch.name`)).rows;
  }
  async cardMeta(u: User, ref: string) {
    need(u, 'read'); const c = await this.cardRow(ref);
    const g = (await this.db.query<any>(`SELECT v.key FROM cards c JOIN taxonomy_values v ON v.id=c.gender_id WHERE c.id=$1`, [c.id])).rows[0];
    const a = (await this.db.query<any>(`SELECT v.key,ca.reason FROM card_affiliations ca JOIN taxonomy_values v ON v.id=ca.value_id WHERE ca.card_id=$1 ORDER BY v.key`, [c.id])).rows;
    const sl = (await this.db.query<any>(`SELECT ch.key partner,l.name,l.stat,l.amount,l.description FROM card_story_links l JOIN evolution_chains ch ON ch.id=l.partner_chain_id WHERE l.card_id=$1 ORDER BY ch.key`, [c.id])).rows;
    const fp = (await this.db.query<any>(`SELECT ch.key partner,f.hp_bonus hp,f.atk_bonus atk,f.def_bonus def,f.note FROM card_fusion_partners f JOIN evolution_chains ch ON ch.id=f.partner_chain_id WHERE f.card_id=$1 ORDER BY ch.key`, [c.id])).rows;
    return { gender: g?.key ?? null, affiliations: a, story_links: sl, fusion_partners: fp };
  }
  async setCardMeta(u: User, ref: string, b: any) {
    need(u, 'write'); const c = await this.cardRow(ref);
    if (c.status !== 'draft') throw new AppError(409, 'แก้ได้เฉพาะการ์ดสถานะ Draft');
    const own = (await this.db.query<any>(`SELECT chain_id FROM cards WHERE id=$1`, [c.id])).rows[0].chain_id as string | null;
    const chainOf = async (key: string) => {
      const r = (await this.db.query<any>(`SELECT id FROM evolution_chains WHERE key=$1`, [key])).rows[0];
      if (!r) bad(`ไม่พบตัวละคร (สาย) "${key}"`);
      if (r.id === own) bad('เลือกตัวละครตัวเองไม่ได้');
      return r.id as string;
    };
    // validate everything first, write after
    let gid: string | null | undefined;
    if (b.gender !== undefined) {
      gid = null;
      if (b.gender) gid = (await this.db.query<any>(`SELECT id FROM taxonomy_values WHERE taxonomy_key='gender' AND key=$1`, [b.gender])).rows[0]?.id ?? bad('เพศไม่ถูกต้อง');
    }
    const aff: [string, string | null][] = [];
    if (b.affiliations) {
      for (const x of b.affiliations) {
        const it = typeof x === 'string' ? { key: x, reason: undefined } : x;
        const v = (await this.db.query<any>(`SELECT id FROM taxonomy_values WHERE taxonomy_key='affiliation' AND key=$1`, [it.key])).rows[0];
        if (!v) bad(`ไม่พบเกม/สังกัด "${it.key}" (สร้างก่อน)`);
        aff.push([v.id, it.reason ?? null]);
      }
    }
    const sl: any[] = [];
    if (b.story_links) {
      const seen = new Set<string>();
      for (const x of b.story_links) {
        if (!own) bad('การ์ดนี้ไม่มีสายตัวละคร (chain) จึงตั้ง Story ไม่ได้');
        if (seen.has(x.partner)) bad(`เลือก ${x.partner} ซ้ำ`); seen.add(x.partner);
        if (!x.name) bad('Story ต้องมีชื่อ');
        if (x.stat && !STATS.includes(x.stat)) bad('stat ต้องเป็น hp/atk/def');
        if (x.stat && !Number.isInteger(x.amount)) bad('amount ต้องเป็นจำนวนเต็ม');
        sl.push({ ...x, cid: await chainOf(x.partner) });
      }
    }
    const fp: any[] = [];
    if (b.fusion_partners) {
      const seen = new Set<string>();
      for (const x of b.fusion_partners) {
        if (!own) bad('การ์ดนี้ไม่มีสายตัวละคร (chain) จึงตั้ง Fusion ไม่ได้');
        if (seen.has(x.partner)) bad(`เลือก ${x.partner} ซ้ำ`); seen.add(x.partner);
        for (const k of ['hp', 'atk', 'def']) if (x[k] != null && !Number.isInteger(x[k])) bad(`โบนัส ${k} ต้องเป็นจำนวนเต็ม`);
        fp.push({ ...x, cid: await chainOf(x.partner) });
      }
    }
    await this.db.transaction(async tx => {
      if (gid !== undefined) await tx.query(`UPDATE cards SET gender_id=$2 WHERE id=$1`, [c.id, gid]);
      if (b.affiliations) {
        await tx.query(`DELETE FROM card_affiliations WHERE card_id=$1`, [c.id]);
        for (const [vid, reason] of aff) await tx.query(`INSERT INTO card_affiliations(card_id,value_id,reason) VALUES ($1,$2,$3)`, [c.id, vid, reason]);
      }
      if (b.story_links) {
        await tx.query(`DELETE FROM card_story_links WHERE card_id=$1`, [c.id]);
        for (const x of sl) await tx.query(`INSERT INTO card_story_links VALUES ($1,$2,$3,$4,$5,$6)`, [c.id, x.cid, x.name, x.stat ?? null, x.amount ?? null, x.description ?? null]);
      }
      if (b.fusion_partners) {
        await tx.query(`DELETE FROM card_fusion_partners WHERE card_id=$1`, [c.id]);
        for (const x of fp) await tx.query(`INSERT INTO card_fusion_partners VALUES ($1,$2,$3,$4,$5,$6)`, [c.id, x.cid, x.hp ?? 0, x.atk ?? 0, x.def ?? 0, x.note ?? null]);
      }
    });
    await this.svc.audit(u, 'card.meta', c.id, b);
    return { ok: true };
  }

  /** Per-card Story links: when two linked characters are on the field, the effect applies once per pair (never per duplicate copy). */
  async storyLinkBonus(characterIds: string[]) {
    const rows = (await this.db.query<any>(
      `SELECT a.character_id a_id, ach.key a_chain, bch.key b_chain, l.name, l.stat, l.amount, l.description
         FROM card_story_links l JOIN cards a ON a.id=l.card_id JOIN evolution_chains ach ON ach.id=a.chain_id JOIN evolution_chains bch ON bch.id=l.partner_chain_id
        WHERE a.character_id = ANY($1)`, [characterIds])).rows;
    const onField = new Set((await this.db.query<any>(`SELECT DISTINCT ch.key FROM cards c JOIN evolution_chains ch ON ch.id=c.chain_id WHERE c.character_id = ANY($1)`, [characterIds])).rows.map((r: any) => r.key));
    const seen = new Set<string>(), out: any[] = [];
    for (const r of rows) {
      if (!onField.has(r.b_chain)) continue;
      const k = [r.a_chain, r.b_chain].sort().join('|'); if (seen.has(k)) continue; seen.add(k);
      out.push({ pair: [r.a_chain, r.b_chain], name: r.name, stat: r.stat, amount: r.amount, description: r.description });
    }
    return out;
  }

  /** Fusion by Fusion Spell: both cards in hand and one lists the other as a partner. */
  async fusionPair(spellInHand: boolean, a: string, b: string, hand: string[]) {
    const errors: string[] = [];
    if (!spellInHand) errors.push('ต้องมีการ์ดเวท Fusion');
    if (a === b) errors.push('ต้องเป็นการ์ดคนละใบ');
    for (const x of [a, b]) if (!hand.includes(x)) errors.push(`${x} ไม่ได้อยู่บนมือ`);
    const r = (await this.db.query<any>(
      `SELECT ca.character_id owner, f.hp_bonus hp, f.atk_bonus atk, f.def_bonus def, f.note
         FROM card_fusion_partners f JOIN cards ca ON ca.id=f.card_id JOIN cards cb ON cb.chain_id=f.partner_chain_id
        WHERE (ca.character_id=$1 AND cb.character_id=$2) OR (ca.character_id=$2 AND cb.character_id=$1)`, [a, b])).rows;
    if (!r.length) errors.push('การ์ดสองใบนี้ไม่ได้ติ๊กเป็นคู่ Fusion กัน');
    if (errors.length) return { ok: false, errors, bonuses: [], stacked: null as any };
    const cs = (await this.db.query<any>(`SELECT character_id,hp,atk,def FROM cards WHERE character_id = ANY($1)`, [[a, b]])).rows;
    const top = cs.find((c: any) => c.character_id === a), bot = cs.find((c: any) => c.character_id === b);
    const cfg = (await this.ruleValue('fusion_stack_stats')) ?? { top_card_percent: 100, bottom_card_percent: 50 };
    const stacked: Record<string, number> = {};
    for (const k of ['hp', 'atk', 'def']) {
      const pair = r.reduce((n: number, x: any) => Math.max(n, x[k] ?? 0), 0);            // one pair bonus, not both sides summed
      stacked[k] = Math.floor((top[k] ?? 0) * cfg.top_card_percent / 100) + Math.floor((bot[k] ?? 0) * cfg.bottom_card_percent / 100) + pair;
    }
    return { ok: true, errors, bonuses: r, stacked: { top: a, bottom: b, one_slot: true, ...stacked } };
  }

  /** Import support: optional gender / affiliations / story_links / fusion_partners per card (applied after cards exist). */
  async applyImportMeta(u: User, items: any[]) {
    const errors: { row: number; error: string }[] = [];
    for (const [i, it] of items.entries()) {
      const b: any = {};
      for (const k of ['gender', 'affiliations', 'story_links', 'fusion_partners']) if (it[k] !== undefined && it[k] !== '') b[k] = it[k];
      if (!Object.keys(b).length) continue;
      try { await this.setCardMeta(u, it.character_id, b); } catch (e: any) { errors.push({ row: i + 1, error: e.message }); }
    }
    return errors;
  }

  // ---- story ----
  async stories(u: User) {
    need(u, 'read');
    return (await this.db.query<any>(
      `SELECT s.*, COALESCE((SELECT array_agg(ch.key ORDER BY ch.key) FROM story_members m JOIN evolution_chains ch ON ch.id=m.chain_id WHERE m.story_id=s.id),'{}') members
       FROM stories s ORDER BY s.name`)).rows;
  }
  async upsertStory(u: User, b: any) {
    need(u, 'write');
    if (!/^[a-z0-9_-]{2,40}$/.test(b.key ?? '')) bad('key ต้องเป็น a-z 0-9 _ - ยาว 2–40');
    if (!b.name) bad('ต้องมีชื่อ');
    if (!['positive', 'negative', 'conditional'].includes(b.kind)) bad('kind ต้องเป็น positive/negative/conditional');
    if (b.stat && !STATS.includes(b.stat)) bad('stat ต้องเป็น hp/atk/def');
    if (b.kind !== 'conditional' || b.stat) {
      if (!b.stat || !Number.isInteger(b.amount) || b.amount === 0) bad('ต้องมี stat และ amount (จำนวนเต็มไม่ใช่ 0)');
      if (b.kind === 'positive' && b.amount < 0) bad('Positive Story ต้องมี amount เป็นบวก');
      if (b.kind === 'negative' && b.amount > 0) bad('Negative Story ต้องมี amount เป็นลบ');
    }
    if (b.kind === 'conditional' && !b.condition_text) bad('Conditional Story ต้องระบุเงื่อนไข');
    const members: string[] = [...new Set<string>(b.members ?? [])];
    if (members.length < 2) bad('Story ต้องมีตัวละคร (chain) อย่างน้อย 2 สาย');
    const chains = (await this.db.query<any>(`SELECT id,key FROM evolution_chains WHERE key = ANY($1)`, [members])).rows;
    const miss = members.filter(k => !chains.some((c: any) => c.key === k));
    if (miss.length) bad(`ไม่พบสาย (chain): ${miss.join(', ')}`);
    await this.db.transaction(async tx => {
      const r = await tx.query<any>(
        `INSERT INTO stories(key,name,kind,stat,amount,condition_text,target_text,max_stacks,description)
         VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7,'ทุกตัวละครในเรื่องนี้'),$8,$9)
         ON CONFLICT (key) DO UPDATE SET name=EXCLUDED.name,kind=EXCLUDED.kind,stat=EXCLUDED.stat,amount=EXCLUDED.amount,
           condition_text=EXCLUDED.condition_text,target_text=EXCLUDED.target_text,max_stacks=EXCLUDED.max_stacks,description=EXCLUDED.description
         RETURNING id`,
        [b.key, b.name, b.kind, b.stat ?? null, b.amount ?? null, b.condition_text ?? null, b.target_text ?? null, b.max_stacks ?? 1, b.description ?? null]);
      await tx.query(`DELETE FROM story_members WHERE story_id=$1`, [r.rows[0].id]);
      for (const c of chains) await tx.query(`INSERT INTO story_members VALUES ($1,$2)`, [r.rows[0].id, c.id]);
    });
    await this.svc.audit(u, 'story.upsert', b.key, b, 'story');
    return { ok: true };
  }
  async deleteStory(u: User, key: string) { need(u, 'write'); await this.db.query(`DELETE FROM stories WHERE key=$1`, [key]); return { ok: true }; }

  /** Story bonuses for characters on the field: each story applies once per story key, capped by max_stacks (never per duplicate copy). */
  async storyBonus(characterIds: string[]) {
    const cs = (await this.db.query<any>(`SELECT DISTINCT chain_id FROM cards WHERE character_id = ANY($1) AND chain_id IS NOT NULL`, [characterIds])).rows.map((r: any) => r.chain_id);
    const rows = (await this.db.query<any>(
      `SELECT s.key,s.name,s.kind,s.stat,s.amount,s.max_stacks,s.condition_text,
              count(DISTINCT m.chain_id) FILTER (WHERE m.chain_id = ANY($1::uuid[]))::int present, count(DISTINCT m.chain_id)::int total
         FROM stories s JOIN story_members m ON m.story_id=s.id GROUP BY s.id`, [cs])).rows;
    return rows.filter((r: any) => r.present >= 2 && r.stat && r.amount)
      .map((r: any) => ({ story: r.key, kind: r.kind, stat: r.stat, amount: r.amount * Math.min(r.max_stacks, 1), conditional: r.kind === 'conditional' ? r.condition_text : null }));
  }

  // ---- fusion ----
  async fusionRecipes(u: User) {
    need(u, 'read');
    return (await this.db.query<any>(`SELECT f.*, c.character_id result FROM fusion_recipes f LEFT JOIN cards c ON c.id=f.result_card_id ORDER BY f.name`)).rows;
  }
  async upsertRecipe(u: User, b: any) {
    need(u, 'write');
    if (!/^[a-z0-9_-]{2,40}$/.test(b.key ?? '')) bad('key ต้องเป็น a-z 0-9 _ - ยาว 2–40');
    if (!b.name) bad('ต้องมีชื่อ');
    const mm: string[] = b.must_match ?? [];
    if (mm.some(x => !MATCH.includes(x))) bad(`must_match ต้องเป็น ${MATCH.join('/')}`);
    const min = b.min_materials ?? 2; if (!(min >= 2)) bad('min_materials ต้อง ≥ 2');
    let rid: string | null = null;
    if (b.result) { rid = (await this.db.query<any>(`SELECT id FROM cards WHERE character_id=$1`, [b.result])).rows[0]?.id ?? bad('ไม่พบการ์ดผลลัพธ์'); }
    if (!mm.length && !(b.required_chain_keys ?? []).length) bad('ต้องกำหนดเงื่อนไข: must_match หรือ required_chain_keys (ไม่ให้ทุกคู่ผสมกันได้)');
    await this.db.query(
      `INSERT INTO fusion_recipes(key,name,result_card_id,min_materials,must_match,required_chain_keys,description,is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE($8,true))
       ON CONFLICT (key) DO UPDATE SET name=EXCLUDED.name,result_card_id=EXCLUDED.result_card_id,min_materials=EXCLUDED.min_materials,
         must_match=EXCLUDED.must_match,required_chain_keys=EXCLUDED.required_chain_keys,description=EXCLUDED.description,is_active=EXCLUDED.is_active`,
      [b.key, b.name, rid, min, mm, b.required_chain_keys ?? [], b.description ?? null, b.is_active ?? null]);
    await this.svc.audit(u, 'fusion.upsert', b.key, b, 'fusion');
    return { ok: true };
  }
  async deleteRecipe(u: User, key: string) { need(u, 'write'); await this.db.query(`DELETE FROM fusion_recipes WHERE key=$1`, [key]); return { ok: true }; }

  async validateFusion(recipeKey: string, materialIds: string[]) {
    const f = (await this.db.query<any>(`SELECT f.*, c.character_id result FROM fusion_recipes f LEFT JOIN cards c ON c.id=f.result_card_id WHERE f.key=$1 AND f.is_active`, [recipeKey])).rows[0];
    if (!f) throw new AppError(404, 'ไม่พบสูตร Fusion');
    const errors: string[] = [];
    const cs = (await this.db.query<any>(
      `SELECT c.id,c.character_id,c.card_type,ch.key chain_key,c.class_id,c.element_id FROM cards c LEFT JOIN evolution_chains ch ON ch.id=c.chain_id WHERE c.character_id = ANY($1)`, [materialIds])).rows;
    for (const id of materialIds) if (!cs.some((c: any) => c.character_id === id)) errors.push(`ไม่พบการ์ด ${id}`);
    if (materialIds.length < f.min_materials) errors.push(`ต้องใช้วัตถุดิบอย่างน้อย ${f.min_materials} ใบ`);
    if (cs.some((c: any) => c.card_type !== 'character')) errors.push('วัตถุดิบต้องเป็นการ์ดตัวละคร');
    for (const k of f.required_chain_keys) if (!cs.some((c: any) => c.chain_key === k)) errors.push(`ขาดตัวละครสาย ${k}`);
    const ids = cs.map((c: any) => c.id);
    const same = (vals: any[]) => vals.length === cs.length && vals.every(v => v && v === vals[0]);
    const sets = async (sql: string) => (await this.db.query<any>(sql, [ids])).rows;
    for (const m of f.must_match as string[]) {
      if (m === 'class' && !same(cs.map((c: any) => c.class_id))) errors.push('อาชีพต้องตรงกัน');
      if (m === 'element' && !same(cs.map((c: any) => c.element_id))) errors.push('ธาตุต้องตรงกัน');
      if (m === 'affiliation') {
        const r = await sets(`SELECT value_id FROM card_affiliations WHERE card_id = ANY($1) GROUP BY value_id HAVING count(DISTINCT card_id)=${ids.length}`);
        if (!ids.length || !r.length) errors.push('ต้องมีสังกัดเกมร่วมกัน');
      }
      if (m === 'story') {
        const r = await sets(`SELECT m.story_id FROM story_members m JOIN cards c ON c.chain_id=m.chain_id WHERE c.id = ANY($1) GROUP BY m.story_id HAVING count(DISTINCT c.id)=${ids.length}`);
        if (!ids.length || !r.length) errors.push('ต้องมี Story ร่วมกัน');
      }
    }
    return { ok: errors.length === 0, errors, result: f.result };
  }

  // ---- deck ----
  async validateDeck(codes: string[]) {
    const size = Number(await this.ruleValue('deck_size') ?? 40), maxCopies = Number(await this.ruleValue('max_copies') ?? 3);
    const cs = (await this.db.query<any>(
      `SELECT c.character_id,c.card_type,c.level,ch.key chain_key FROM cards c LEFT JOIN evolution_chains ch ON ch.id=c.chain_id WHERE c.character_id = ANY($1)`, [codes])).rows;
    const by = new Map<string, any>(cs.map((c: any) => [c.character_id, c]));
    const errors: string[] = [];
    if (codes.length !== size) errors.push(`เด็คต้องมี ${size} ใบพอดี (ตอนนี้ ${codes.length})`);
    for (const c of new Set(codes)) if (!by.has(c)) errors.push(`ไม่พบการ์ด ${c}`);
    const copies = new Map<string, number>();
    for (const code of codes) { const c = by.get(code); if (!c) continue; const k = c.card_type === 'character' && c.chain_key ? 'chain:' + c.chain_key : code; copies.set(k, (copies.get(k) ?? 0) + 1); }
    for (const [k, n] of copies) if (n > maxCopies) errors.push(`${k.replace('chain:', 'สาย ')} มี ${n} ใบ เกินสูงสุด ${maxCopies}`);
    for (const code of new Set(codes)) {
      const c = by.get(code);
      if (c?.card_type === 'character' && c.level > 15 && c.chain_key && !codes.some(x => by.get(x)?.chain_key === c.chain_key && by.get(x)?.level === 15))
        errors.push(`${code} เป็นร่างวิวัฒนาการ แต่ในเด็คไม่มีร่างเริ่มต้น (Lv.15) ของสายเดียวกัน`);
    }
    const evo = codes.filter(x => by.get(x)?.card_type === 'evolution').length;
    return { ok: errors.length === 0, errors, counts: { total: codes.length, evolution_cards: evo } };
  }
}
