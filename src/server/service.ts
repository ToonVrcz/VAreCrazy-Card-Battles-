import type { PGlite } from '@electric-sql/pglite';
import { scryptSync, randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export type Role = 'super_admin' | 'card_editor' | 'reviewer' | 'publisher' | 'viewer';
export class AppError extends Error {
  constructor(public code: number, msg: string) { super(msg); }
}
export interface User { id: string; email: string; role: Role }

// ---- permissions ----
const PERMS: Record<Role, string[]> = {
  super_admin: ['read', 'write', 'submit', 'review', 'publish', 'users', 'import'],
  card_editor: ['read', 'write', 'submit', 'import'],
  reviewer: ['read', 'review'],
  publisher: ['read', 'publish'],
  viewer: ['read'],
};
export const can = (u: User, p: string) => PERMS[u.role]?.includes(p);
function need(u: User, p: string) { if (!can(u, p)) throw new AppError(403, `ไม่มีสิทธิ์: ${p}`); }

// from -> to -> required permission
const FLOW: Record<string, Record<string, string>> = {
  draft: { in_review: 'submit' },
  in_review: { approved: 'review', draft: 'review' },
  approved: { published: 'publish', draft: 'review' },
  published: { archived: 'publish', draft: 'publish' },
  archived: { draft: 'publish' },
};

export const TRIGGERS = ['on_summon','on_evolve','on_attack','on_destroyed','turn_start','turn_end','to_graveyard','passive','combo','on_cast'];
const DURATIONS = ['instant','until_end_of_turn','n_turns','permanent'];
const LIMITS = ['none','once_per_turn','once_per_game'];

// ---- auth ----
const hashPw = (pw: string, salt = randomBytes(16).toString('hex')) =>
  `${salt}:${scryptSync(pw, salt, 32).toString('hex')}`;
const checkPw = (pw: string, stored: string) => {
  const [salt, h] = stored.split(':');
  return timingSafeEqual(Buffer.from(h, 'hex'), scryptSync(pw, salt, 32));
};
const sha = (s: string) => createHash('sha256').update(s).digest('hex');

export class CardService {
  /** Optional remote storage hook (Supabase Storage); falls back to local disk. */
  public put?: (path: string, data: Uint8Array, mime: string) => Promise<void>;
  constructor(public db: PGlite, public storageDir = './storage') {}

  async createUser(email: string, password: string, role: Role) {
    if (password.length < 8) throw new AppError(400, 'รหัสผ่านต้องยาวอย่างน้อย 8 ตัว');
    await this.db.query(`INSERT INTO admin_users(email,role_key,password_hash) VALUES ($1,$2,$3)`,
      [email.toLowerCase(), role, hashPw(password)]);
  }

  async login(email: string, password: string) {
    const r = await this.db.query<any>(`SELECT * FROM admin_users WHERE email=$1 AND is_active`, [email.toLowerCase()]);
    const u = r.rows[0];
    if (!u || !u.password_hash || !checkPw(password, u.password_hash)) throw new AppError(401, 'อีเมลหรือรหัสผ่านไม่ถูกต้อง');
    const token = randomBytes(32).toString('hex');
    await this.db.query(`INSERT INTO admin_sessions(token_hash,user_id,expires_at) VALUES ($1,$2, now() + interval '12 hours')`, [sha(token), u.id]);
    return { token, user: { id: u.id, email: u.email, role: u.role_key } as User };
  }

  async auth(token?: string): Promise<User> {
    if (!token) throw new AppError(401, 'ต้องเข้าสู่ระบบ');
    const r = await this.db.query<any>(
      `SELECT u.id,u.email,u.role_key FROM admin_sessions s JOIN admin_users u ON u.id=s.user_id
       WHERE s.token_hash=$1 AND s.expires_at>now() AND u.is_active`, [sha(token)]);
    if (!r.rows[0]) throw new AppError(401, 'เซสชันหมดอายุ');
    return { id: r.rows[0].id, email: r.rows[0].email, role: r.rows[0].role_key };
  }

  async logout(token: string) { await this.db.query(`DELETE FROM admin_sessions WHERE token_hash=$1`, [sha(token)]); }

  async audit(u: User, action: string, id: string, diff?: unknown, entity = 'card') {
    await this.db.query(`INSERT INTO audit_log(actor,action,entity,entity_id,diff) VALUES ($1,$2,$3,$4,$5::jsonb)`,
      [u.email, action, entity, id, JSON.stringify(diff ?? null)]);
  }

  // ---- user management (super_admin only) ----
  private static ROLES: Role[] = ['super_admin', 'card_editor', 'reviewer', 'publisher', 'viewer'];

  async listUsers(u: User) {
    need(u, 'users');
    return (await this.db.query(`SELECT id,email,role_key AS role,is_active,created_at FROM admin_users ORDER BY created_at, email`)).rows;
  }

  async adminCreateUser(u: User, email: string, password: string, role: Role) {
    need(u, 'users');
    email = String(email ?? '').trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$|^[^@\s]+@local$/.test(email)) throw new AppError(400, 'อีเมลไม่ถูกต้อง');
    if (!CardService.ROLES.includes(role)) throw new AppError(400, 'role ไม่ถูกต้อง');
    try { await this.createUser(email, password, role); }
    catch (e: any) {
      if (e instanceof AppError) throw e;
      if (/unique|duplicate/i.test(e.message)) throw new AppError(409, 'อีเมลนี้มีผู้ใช้แล้ว');
      throw e;
    }
    const id = (await this.db.query<any>(`SELECT id FROM admin_users WHERE email=$1`, [email])).rows[0].id;
    await this.audit(u, 'user:create', email, { role }, 'user');
    return id as string;
  }

  private async activeSupers() {
    return (await this.db.query<any>(`SELECT count(*)::int c FROM admin_users WHERE role_key='super_admin' AND is_active`)).rows[0].c as number;
  }

  async updateUser(u: User, id: string, patch: { role?: Role; is_active?: boolean }) {
    need(u, 'users');
    const t = (await this.db.query<any>(`SELECT * FROM admin_users WHERE id=$1`, [id])).rows[0];
    if (!t) throw new AppError(404, 'ไม่พบผู้ใช้');
    const newRole = patch.role ?? t.role_key, newActive = patch.is_active ?? t.is_active;
    if (!CardService.ROLES.includes(newRole)) throw new AppError(400, 'role ไม่ถูกต้อง');
    if (id === u.id && (!newActive || newRole !== t.role_key)) throw new AppError(409, 'แก้ role หรือปิดบัญชีของตัวเองไม่ได้');
    const losesSuper = t.role_key === 'super_admin' && t.is_active && (newRole !== 'super_admin' || !newActive);
    if (losesSuper && (await this.activeSupers()) <= 1) throw new AppError(409, 'ต้องเหลือ Super Admin ที่ใช้งานอย่างน้อย 1 คน');
    await this.db.query(`UPDATE admin_users SET role_key=$1,is_active=$2 WHERE id=$3`, [newRole, newActive, id]);
    if (!newActive || newRole !== t.role_key) await this.db.query(`DELETE FROM admin_sessions WHERE user_id=$1`, [id]); // force re-login
    await this.audit(u, 'user:update', t.email, { role: newRole, is_active: newActive }, 'user');
  }

  async resetPassword(u: User, id: string, password: string) {
    need(u, 'users');
    if (String(password ?? '').length < 8) throw new AppError(400, 'รหัสผ่านต้องยาวอย่างน้อย 8 ตัว');
    const t = (await this.db.query<any>(`SELECT email FROM admin_users WHERE id=$1`, [id])).rows[0];
    if (!t) throw new AppError(404, 'ไม่พบผู้ใช้');
    await this.db.query(`UPDATE admin_users SET password_hash=$1 WHERE id=$2`, [hashPw(password), id]);
    await this.db.query(`DELETE FROM admin_sessions WHERE user_id=$1`, [id]);
    await this.audit(u, 'user:reset-password', t.email, null, 'user');
  }

  async changeOwnPassword(u: User, oldPw: string, newPw: string, keepToken?: string) {
    if (String(newPw ?? '').length < 8) throw new AppError(400, 'รหัสผ่านใหม่ต้องยาวอย่างน้อย 8 ตัว');
    const r = (await this.db.query<any>(`SELECT password_hash FROM admin_users WHERE id=$1`, [u.id])).rows[0];
    if (!r || !checkPw(String(oldPw ?? ''), r.password_hash)) throw new AppError(401, 'รหัสผ่านเดิมไม่ถูกต้อง');
    await this.db.query(`UPDATE admin_users SET password_hash=$1 WHERE id=$2`, [hashPw(newPw), u.id]);
    await this.db.query(`DELETE FROM admin_sessions WHERE user_id=$1 AND token_hash<>$2`, [u.id, keepToken ? sha(keepToken) : '']);
    await this.audit(u, 'user:change-password', u.email, null, 'user');
  }

  // ---- taxonomy helpers ----
  private async taxId(tax: string, key?: string | null) {
    if (!key) return null;
    await this.db.query(`INSERT INTO taxonomies(key,name) VALUES ($1,$1) ON CONFLICT DO NOTHING`, [tax]);
    const r = await this.db.query<any>(
      `INSERT INTO taxonomy_values(taxonomy_key,key,name) VALUES ($1,$2,$2)
       ON CONFLICT (taxonomy_key,key) DO UPDATE SET key=EXCLUDED.key RETURNING id`, [tax, key]);
    return r.rows[0].id as string;
  }
  private async chainId(key?: string | null, name?: string | null) {
    if (!key) return null;
    const r = await this.db.query<any>(
      `INSERT INTO evolution_chains(key,name) VALUES ($1,COALESCE($2,$1)) ON CONFLICT (key) DO UPDATE SET name=COALESCE($2,evolution_chains.name) RETURNING id`, [key, name || null]);
    return r.rows[0].id as string;
  }

  // ---- read ----
  private static SELECT = `
    SELECT c.id, c.character_id, c.name, c.card_type, c.level, c.hp, c.atk, c.def, c.has_combo,
      c.rules_text, c.flavor_text, c.atk_icon, c.shop_price_points, c.shop_price_vrcoin, c.status, c.version_no, c.updated_at,
      ch.key AS chain_key, ch.name AS chain_name, pf.character_id AS evolves_from,
      el.key AS element, ra.key AS race, cl.key AS class,
      m.storage_path AS image_path, m.render_mode, m.id AS media_id
    FROM cards c
    LEFT JOIN evolution_chains ch ON ch.id=c.chain_id
    LEFT JOIN cards pf ON pf.id=c.evolves_from
    LEFT JOIN taxonomy_values el ON el.id=c.element_id
    LEFT JOIN taxonomy_values ra ON ra.id=c.race_id
    LEFT JOIN taxonomy_values cl ON cl.id=c.class_id
    LEFT JOIN media_assets m ON m.id=c.media_id`;

  async listCards(u: User, f: { status?: string; q?: string } = {}) {
    need(u, 'read');
    const p: unknown[] = []; const w: string[] = [];
    if (f.status) { p.push(f.status); w.push(`c.status=$${p.length}`); }
    if (f.q) { p.push(`%${f.q}%`); w.push(`(c.name ILIKE $${p.length} OR c.character_id ILIKE $${p.length})`); }
    const r = await this.db.query<any>(`${CardService.SELECT} ${w.length ? 'WHERE ' + w.join(' AND ') : ''} ORDER BY ch.key, c.level, c.character_id`, p);
    return r.rows;
  }
  async getCard(u: User, id: string) {
    need(u, 'read');
    const r = await this.db.query<any>(`${CardService.SELECT} WHERE c.id=$1`, [id]);
    if (!r.rows[0]) throw new AppError(404, 'ไม่พบการ์ด');
    return { ...r.rows[0], effects: (await this.effectsFor([id])).get(id) ?? [] };
  }

  private async effectsFor(ids: string[]) {
    const m = new Map<string, any[]>();
    if (!ids.length) return m;
    const r = await this.db.query<any>(`SELECT card_id,trigger,condition_text,cost_text,target_text,action_text,duration,duration_turns,use_limit,description
      FROM card_effects WHERE card_id = ANY($1::uuid[]) ORDER BY card_id, sort_order`, [ids]);
    for (const { card_id, ...e } of r.rows) (m.get(card_id) ?? m.set(card_id, []).get(card_id)!).push(e);
    return m;
  }

  private static cleanEffects(raw: any): any[] {
    if (typeof raw === 'string') { try { raw = JSON.parse(raw); } catch { throw new AppError(400, 'effects ต้องเป็น JSON'); } }
    if (!Array.isArray(raw)) throw new AppError(400, 'effects ต้องเป็นรายการ');
    if (raw.length > 10) throw new AppError(400, 'เอฟเฟกต์ได้ไม่เกิน 10 รายการต่อการ์ด');
    return raw.map((e, i) => {
      const t = (v: any) => (v == null || String(v).trim() === '' ? null : String(v).trim());
      const x = { trigger: t(e.trigger), condition_text: t(e.condition_text), cost_text: t(e.cost_text), target_text: t(e.target_text),
        action_text: t(e.action_text), duration: t(e.duration) ?? 'instant', duration_turns: e.duration_turns ? Number(e.duration_turns) : null,
        use_limit: t(e.use_limit) ?? 'none', description: t(e.description) };
      const n = i + 1;
      if (!x.trigger || !TRIGGERS.includes(x.trigger)) throw new AppError(400, `เอฟเฟกต์ #${n}: จังหวะ (trigger) ไม่ถูกต้อง`);
      if (!x.description) throw new AppError(400, `เอฟเฟกต์ #${n}: ต้องมีคำอธิบายที่ผู้เล่นเห็น`);
      if (x.description.length > 500) throw new AppError(400, `เอฟเฟกต์ #${n}: คำอธิบายยาวเกิน 500 ตัวอักษร`);
      if (!DURATIONS.includes(x.duration)) throw new AppError(400, `เอฟเฟกต์ #${n}: ระยะเวลาไม่ถูกต้อง`);
      if (!LIMITS.includes(x.use_limit)) throw new AppError(400, `เอฟเฟกต์ #${n}: ขีดจำกัดการใช้ไม่ถูกต้อง`);
      if (x.duration === 'n_turns' && !x.duration_turns) throw new AppError(400, `เอฟเฟกต์ #${n}: ระบุจำนวนเทิร์น`);
      if (x.duration !== 'n_turns') x.duration_turns = null;
      return x;
    });
  }

  // ---- write ----
  async saveCard(u: User, input: any, id?: string) {
    need(u, 'write');
    if (!input.character_id || !input.name || !input.card_type) throw new AppError(400, 'ต้องมี character_id, name, card_type');
    if (id) {
      const cur = (await this.db.query<any>(`SELECT status FROM cards WHERE id=$1`, [id])).rows[0];
      if (!cur) throw new AppError(404, 'ไม่พบการ์ด');
      if (cur.status !== 'draft') throw new AppError(409, 'แก้ไขได้เฉพาะสถานะ Draft (ถอนกลับเป็น Draft ก่อน)');
    }
    const effects = input.effects == null || input.effects === '' ? undefined : CardService.cleanEffects(input.effects);
    const chain = await this.chainId(input.chain_key, input.chain_name);
    const [el, ra, cl] = await Promise.all([
      this.taxId('element', input.element), this.taxId('race', input.race), this.taxId('class', input.class)]);
    let from: string | null = null;
    if (input.evolves_from) {
      const r = await this.db.query<any>(`SELECT id FROM cards WHERE character_id=$1`, [input.evolves_from]);
      if (!r.rows[0]) throw new AppError(400, `ไม่พบร่างก่อนหน้า ${input.evolves_from}`);
      from = r.rows[0].id;
    }
    const n = (v: any) => (v === '' || v == null ? null : Number(v));
    const vals = [input.character_id, input.name, input.card_type, n(input.level), chain, from, n(input.hp), n(input.atk),
      n(input.def) ?? 0, !!input.has_combo, input.rules_text || null, input.flavor_text || null, el, ra, cl, input.media_id || null, n(input.shop_price_points), n(input.shop_price_vrcoin), input.atk_icon || null];
    try {
      let cid = id;
      if (id) {
        await this.db.query(`UPDATE cards SET character_id=$1,name=$2,card_type=$3,level=$4,chain_id=$5,evolves_from=$6,hp=$7,atk=$8,def=$9,
          has_combo=$10,rules_text=$11,flavor_text=$12,element_id=$13,race_id=$14,class_id=$15,media_id=$16,shop_price_points=$17,shop_price_vrcoin=$18,atk_icon=$19 WHERE id=$20`, [...vals, id]);
      } else {
        const r = await this.db.query<any>(`INSERT INTO cards(character_id,name,card_type,level,chain_id,evolves_from,hp,atk,def,has_combo,
          rules_text,flavor_text,element_id,race_id,class_id,media_id,shop_price_points,shop_price_vrcoin,atk_icon,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20) RETURNING id`, [...vals, u.id]);
        cid = r.rows[0].id;
      }
      if (effects) {
        await this.db.query(`DELETE FROM card_effects WHERE card_id=$1`, [cid]);
        for (const [i, e] of effects.entries())
          await this.db.query(`INSERT INTO card_effects(card_id,sort_order,trigger,condition_text,cost_text,target_text,action_text,duration,duration_turns,use_limit,description)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`, [cid, i, e.trigger, e.condition_text, e.cost_text, e.target_text, e.action_text, e.duration, e.duration_turns, e.use_limit, e.description]);
      }
      await this.audit(u, id ? 'update' : 'create', cid!, input);
      return this.getCard(u, cid!);
    } catch (e: any) {
      if (e instanceof AppError) throw e;
      if (/unique|duplicate/i.test(e.message)) throw new AppError(409, 'Character ID ซ้ำ หรือ Level ซ้ำในสายเดียวกัน');
      throw new AppError(400, e.message);
    }
  }

  /** Removes a Draft card (effects/meta cascade). Non-drafts must be withdrawn to Draft first. */
  async deleteCard(u: any, id: string) {
    need(u, 'write');
    const c = (await this.db.query<any>('SELECT id,status,character_id FROM cards WHERE id=$1', [id])).rows[0];
    if (!c) throw new AppError(404, 'ไม่พบการ์ด');
    if (c.status !== 'draft') throw new AppError(409, 'ลบได้เฉพาะการ์ดสถานะ Draft (ถอนกลับเป็น Draft ก่อน)');
    const ref = (await this.db.query<any>('SELECT character_id FROM cards WHERE evolves_from=$1', [id])).rows;
    if (ref.length) throw new AppError(409, `ลบไม่ได้: ${ref.map(r => r.character_id).join(', ')} วิวัฒนาการมาจากใบนี้ (ลบหรือแก้ใบนั้นก่อน)`);
    const fr = (await this.db.query<any>('SELECT name FROM fusion_recipes WHERE result_card_id=$1', [id])).rows;
    if (fr.length) throw new AppError(409, `ลบไม่ได้: เป็นผลลัพธ์ของสูตร Fusion ${fr.map(r => r.name).join(', ')}`);
    await this.db.query('DELETE FROM cards WHERE id=$1', [id]);
    await this.audit(u, 'delete', id, { character_id: c.character_id });
    return { ok: true };
  }

  async transition(u: User, id: string, to: string) {
    const cur = (await this.db.query<any>(`SELECT status,character_id FROM cards WHERE id=$1`, [id])).rows[0];
    if (!cur) throw new AppError(404, 'ไม่พบการ์ด');
    const perm = FLOW[cur.status]?.[to];
    if (!perm) throw new AppError(409, `เปลี่ยน ${cur.status} → ${to} ไม่ได้`);
    need(u, perm);
    try {
      await this.db.query(`UPDATE cards SET status=$1 WHERE id=$2`, [to, id]);
    } catch (e: any) {
      throw new AppError(422, e.message.replace(/^.*PUBLISH_RULE: /, ''));
    }
    await this.audit(u, `status:${cur.status}->${to}`, id);
    return this.getCard(u, id);
  }

  async uploadMedia(u: User, filename: string, mime: string, data: Buffer, renderMode: 'full' | 'art_only' = 'art_only') {
    need(u, 'write');
    const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[mime];
    if (!ext) throw new AppError(400, 'รองรับเฉพาะ JPG/PNG/WEBP');
    if (data.length > 5 * 1024 * 1024) throw new AppError(413, 'ไฟล์ใหญ่เกิน 5MB');
    const name = `${randomBytes(8).toString('hex')}.${ext}`;
    if (this.put) await this.put(`media/${name}`, data, mime);
    else { mkdirSync(this.storageDir, { recursive: true }); writeFileSync(join(this.storageDir, name), data); }
    const r = await this.db.query<any>(`INSERT INTO media_assets(storage_path,mime,render_mode) VALUES ($1,$2,$3) RETURNING id,storage_path`,
      [`media/${name}`, mime, renderMode]);
    return r.rows[0] as { id: string; storage_path: string };
  }

  // ---- card frames (per type: "type:spell", per card: "card:<character_id>") ----
  async listFrames(u: User) {
    need(u, 'read');
    return (await this.db.query<any>(`SELECT f.scope, m.storage_path AS path FROM card_frames f JOIN media_assets m ON m.id=f.media_id ORDER BY f.scope`)).rows;
  }
  async setFrame(u: User, scope: string, mediaId: string) {
    need(u, 'write');
    if (!/^(type:(character|evolution|fusion|spell|trap|item)|card:[\w-]+)$/.test(scope)) throw new AppError(400, 'scope ไม่ถูกต้อง');
    if (!(await this.db.query<any>(`SELECT 1 FROM media_assets WHERE id=$1`, [mediaId])).rows[0]) throw new AppError(400, 'ไม่พบไฟล์กรอบ');
    await this.db.query(`INSERT INTO card_frames(scope,media_id) VALUES ($1,$2) ON CONFLICT (scope) DO UPDATE SET media_id=$2, updated_at=now()`, [scope, mediaId]);
    return { ok: true };
  }
  async deleteFrame(u: User, scope: string) {
    need(u, 'write');
    await this.db.query(`DELETE FROM card_frames WHERE scope=$1`, [scope]);
    return { ok: true };
  }

  // ---- export / import ----
  static COLS = ['character_id', 'name', 'card_type', 'level', 'chain_key', 'evolves_from', 'hp', 'atk', 'def', 'has_combo',
    'element', 'race', 'class', 'atk_icon', 'shop_price_points', 'shop_price_vrcoin', 'rules_text', 'flavor_text', 'image_path', 'effects'];

  async exportJSON(u: User) {
    const cards = await this.listCards(u);
    const fx = await this.effectsFor(cards.map((c: any) => c.id));
    return cards.map((c: any) => ({ ...Object.fromEntries(CardService.COLS.map(k => [k, c[k] ?? null])), effects: fx.get(c.id) ?? [] }));
  }
  async exportCSV(u: User) {
    const rows = await this.exportJSON(u);
    const esc = (v: any) => { const s = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    return [CardService.COLS.join(','), ...rows.map(r => CardService.COLS.map(k => esc((r as any)[k])).join(','))].join('\n');
  }

  static parseCSV(text: string): any[] {
    const rows: string[][] = []; let row: string[] = [], f = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += ch; }
      else if (ch === '"') q = true;
      else if (ch === ',') { row.push(f); f = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(f); f = ''; if (row.some(x => x !== '')) rows.push(row); row = []; }
      else f += ch;
    }
    row.push(f); if (row.some(x => x !== '')) rows.push(row);
    const [head, ...body] = rows;
    return body.map(r => Object.fromEntries(head.map((h, i) => [h.trim(), r[i] === '' ? null : r[i]])));
  }

  /** Upserts cards as Draft in ONE transaction; any bad row rolls everything back. dryRun rolls back always. */
  async importCards(u: User, items: any[], dryRun = false) {
    need(u, 'import');
    const errors: { row: number; message: string }[] = [];
    let created = 0, updated = 0;
    class Rollback extends Error {}
    try {
      await this.db.transaction(async tx => {
        const svc = new CardService(tx as unknown as PGlite, this.storageDir); svc.put = this.put;
        const byCode = new Map<string, any>();
        for (const [i, it] of items.entries()) {
          if (byCode.has(it.character_id)) errors.push({ row: i + 2, message: `character_id ซ้ำในไฟล์: ${it.character_id}` });
          byCode.set(it.character_id, it);
        }
        if (errors.length) throw new Rollback();
        // pass 1: without evolves_from; pass 2: link
        const ids = new Map<string, string>();
        for (const [i, it] of items.entries()) {
          try {
            const ex = (await tx.query<any>(`SELECT id,status FROM cards WHERE character_id=$1`, [it.character_id])).rows[0];
            if (ex && ex.status !== 'draft') throw new AppError(409, `${it.character_id} ไม่ใช่ Draft จึงนำเข้าทับไม่ได้`);
            let media_id: string | null = null;
            if (it.image_path) {
              media_id = (await tx.query<any>(`INSERT INTO media_assets(storage_path,mime) VALUES ($1,'image/jpeg')
                ON CONFLICT (storage_path) DO UPDATE SET storage_path=EXCLUDED.storage_path RETURNING id`, [it.image_path])).rows[0].id;
            }
            const saved = await svc.saveCard(u, { ...it, evolves_from: null, media_id, has_combo: it.has_combo === true || it.has_combo === 'true' }, ex?.id);
            ids.set(it.character_id, saved.id);
            ex ? updated++ : created++;
          } catch (e: any) { errors.push({ row: i + 2, message: e.message }); }
        }
        if (errors.length) throw new Rollback();
        for (const [i, it] of items.entries()) {
          if (!it.evolves_from) continue;
          const to = ids.get(it.character_id)!;
          const from = (await tx.query<any>(`SELECT id FROM cards WHERE character_id=$1`, [it.evolves_from])).rows[0];
          if (!from) { errors.push({ row: i + 2, message: `ไม่พบร่างก่อนหน้า ${it.evolves_from}` }); continue; }
          await tx.query(`UPDATE cards SET evolves_from=$1 WHERE id=$2`, [from.id, to]);
        }
        if (errors.length || dryRun) throw new Rollback();
      });
    } catch (e) { if (!(e instanceof Rollback)) throw e; }
    const ok = errors.length === 0;
    if (ok && !dryRun) await this.audit(u, 'import', 'bulk', { created, updated });
    return { ok, dryRun, created: ok ? created : 0, updated: ok ? updated : 0, errors };
  }

  async auditLog(u: User, limit = 50) {
    need(u, 'read');
    return (await this.db.query(`SELECT id,actor,action,entity,entity_id,at FROM audit_log ORDER BY id DESC LIMIT $1`, [limit])).rows;
  }
}
