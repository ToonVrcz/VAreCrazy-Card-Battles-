// Guest player profiles, wallet (points + Vrcoin), card inventory and the shop for Lv.40/70 cards.
// Profiles are anonymous for now (a secret key kept in the browser); they are meant to be linked to Universe accounts later.
import { createHash, randomBytes } from 'node:crypto';
import { AppError, type CardService } from './service.ts';

export const ECONOMY = {
  matchPoints: 200,        // each finished PvP match
  vrcoinEvery: 10,         // every 10th PvP match ...
  vrcoinBatch: 10,         // ... earns this much Vrcoin
  maxCopies: 3,            // most copies of one card a player can own (= deck limit)
  starterPoints: 500,      // gift on profile creation, so the shop can be tried (one Lv.40 card)
  minTurnsForReward: 6,    // a match that ends sooner (instant resign) earns nothing: anti-farming
} as const;

const hash = (k: string) => createHash('sha256').update(k).digest('hex');
type Db = { query: <T = any>(sql: string, p?: any[]) => Promise<{ rows: T[] }> };

export interface Wallet { id: string; name: string; points: number; vrcoin: number; matches: number; matchesToVrcoin: number }

export class Economy {
  constructor(private svc: CardService) {}
  private get db(): any { return this.svc.db; }
  private wallet(r: any): Wallet { return { id: r.id, name: r.name, points: r.points, vrcoin: r.vrcoin, matches: r.pvp_matches, matchesToVrcoin: ECONOMY.vrcoinEvery - (r.pvp_matches % ECONOMY.vrcoinEvery) }; }

  async createProfile(name?: string) {
    const key = randomBytes(24).toString('hex'), nm = String(name ?? '').trim().slice(0, 24) || 'ผู้เล่น';
    return this.db.transaction(async (tx: Db) => {
      const r = (await tx.query(`INSERT INTO players(key_hash,name,points) VALUES ($1,$2,$3) RETURNING *`, [hash(key), nm, ECONOMY.starterPoints])).rows[0];
      if (ECONOMY.starterPoints) await tx.query(`INSERT INTO economy_ledger(player_id,kind,points,ref) VALUES ($1,'starter',$2,'welcome')`, [r.id, ECONOMY.starterPoints]);
      return { key, ...this.wallet(r) };
    });
  }

  /** Resolves a profile key. null/empty = guest (undefined); a key that matches nobody is an error so a stale key is noticed. */
  async resolve(key: string | undefined | null, db: Db = this.db): Promise<string | null> {
    if (!key) return null;
    const r = (await db.query(`SELECT id FROM players WHERE key_hash=$1`, [hash(key)])).rows[0];
    if (!r) throw new AppError(401, 'ไม่พบโปรไฟล์ผู้เล่น (คีย์ไม่ถูกต้อง)');
    return r.id;
  }
  private async need(key: string | undefined | null) { const id = await this.resolve(key); if (!id) throw new AppError(401, 'ต้องมีโปรไฟล์ผู้เล่นก่อน'); return id; }

  async inventory(playerId: string, db: Db = this.db): Promise<Map<string, number>> {
    return new Map((await db.query(`SELECT card_id, qty FROM player_cards WHERE player_id=$1`, [playerId])).rows.map((r: any) => [r.card_id as string, r.qty as number]));
  }

  async me(key: string | undefined) {
    const id = await this.need(key);
    const w = this.wallet((await this.db.query(`SELECT * FROM players WHERE id=$1`, [id])).rows[0]);
    return { ...w, inventory: Object.fromEntries(await this.inventory(id)), rules: { matchPoints: ECONOMY.matchPoints, vrcoinEvery: ECONOMY.vrcoinEvery, vrcoinBatch: ECONOMY.vrcoinBatch, maxCopies: ECONOMY.maxCopies } };
  }

  async prices() { return (await this.db.query(`SELECT level, currency, price FROM shop_prices ORDER BY level`)).rows; }

  /** Cards on sale: every non-archived character above Lv.15, with its price (null = not for sale yet) and how many the player owns. */
  async shop(key?: string) {
    const id = key ? await this.resolve(key) : null, inv = id ? await this.inventory(id) : new Map<string, number>();
    const pr = new Map((await this.prices()).map((p: any) => [p.level, p]));
    const rows = (await this.db.query(`SELECT character_id id, name, level FROM cards WHERE status<>'archived' AND card_type='character' AND level>15 ORDER BY level, character_id`)).rows;
    return { items: rows.map((c: any) => { const p: any = pr.get(c.level); return { id: c.id, name: c.name, level: c.level, price: p ? { currency: p.currency, amount: p.price } : null, owned: inv.get(c.id) ?? 0 }; }), maxCopies: ECONOMY.maxCopies };
  }

  async buy(key: string | undefined, cardId: unknown) {
    const pid = await this.need(key);
    if (typeof cardId !== 'string') throw new AppError(400, 'ไม่ระบุการ์ด');
    return this.db.transaction(async (tx: Db) => {
      const c = (await tx.query(`SELECT character_id id, name, level FROM cards WHERE character_id=$1 AND status<>'archived' AND card_type='character' AND level>15`, [cardId])).rows[0];
      if (!c) throw new AppError(404, 'ไม่พบการ์ดนี้ในร้านค้า');
      const pr = (await tx.query(`SELECT currency, price FROM shop_prices WHERE level=$1`, [c.level])).rows[0];
      if (!pr) throw new AppError(409, `การ์ดเลเวล ${c.level} ยังไม่เปิดขาย`);
      const p = (await tx.query(`SELECT * FROM players WHERE id=$1 FOR UPDATE`, [pid])).rows[0];
      const have = (await tx.query(`SELECT qty FROM player_cards WHERE player_id=$1 AND card_id=$2`, [pid, cardId])).rows[0]?.qty ?? 0;
      if (have >= ECONOMY.maxCopies) throw new AppError(409, `มี ${c.name} ครบ ${ECONOMY.maxCopies} ใบแล้ว`);
      if (p[pr.currency] < pr.price) throw new AppError(402, pr.currency === 'points' ? `แต้มไม่พอ (ต้องการ ${pr.price} มี ${p.points})` : `Vrcoin ไม่พอ (ต้องการ ${pr.price} มี ${p.vrcoin})`);
      await tx.query(`UPDATE players SET ${pr.currency}=${pr.currency}-$2 WHERE id=$1`, [pid, pr.price]);
      await tx.query(`INSERT INTO player_cards(player_id,card_id,qty) VALUES ($1,$2,1) ON CONFLICT (player_id,card_id) DO UPDATE SET qty=player_cards.qty+1`, [pid, cardId]);
      await tx.query(`INSERT INTO economy_ledger(player_id,kind,points,vrcoin,ref) VALUES ($1,'buy',$2,$3,$4)`, [pid, pr.currency === 'points' ? -pr.price : 0, pr.currency === 'vrcoin' ? -pr.price : 0, cardId]);
      return { ok: true, card: c.id, owned: have + 1, spent: { currency: pr.currency, amount: pr.price } };
    });
  }

  /** Pays out a finished PvP match to the seats that have a profile. Call once per match, inside the room's transaction. */
  async award(tx: Db, playerIds: (string | null)[], ref: string) {
    const out: ({ points: number; vrcoin: number; matches: number } | null)[] = [];
    for (const pid of playerIds) {
      if (!pid) { out.push(null); continue; }
      const p = (await tx.query(`UPDATE players SET points=points+$2, pvp_matches=pvp_matches+1 WHERE id=$1 RETURNING pvp_matches`, [pid, ECONOMY.matchPoints])).rows[0];
      if (!p) { out.push(null); continue; }
      const bonus = p.pvp_matches % ECONOMY.vrcoinEvery === 0 ? ECONOMY.vrcoinBatch : 0;
      if (bonus) await tx.query(`UPDATE players SET vrcoin=vrcoin+$2 WHERE id=$1`, [pid, bonus]);
      await tx.query(`INSERT INTO economy_ledger(player_id,kind,points,vrcoin,ref) VALUES ($1,'match',$2,$3,$4)`, [pid, ECONOMY.matchPoints, bonus, ref]);
      out.push({ points: ECONOMY.matchPoints, vrcoin: bonus, matches: p.pvp_matches });
    }
    return out;
  }

  // ---- player data (read-only history + rename; Phase 2) ----
  /** Renames the caller's profile. Name only: never touches wallet, cards or ledger. */
  async rename(key: string | undefined, name: unknown) {
    const id = await this.need(key), nm = String(name ?? '').trim().replace(/\s+/g, ' ').slice(0, 24);
    if (!nm) throw new AppError(400, 'ชื่อห้ามว่าง');
    await this.db.query(`UPDATE players SET name=$2 WHERE id=$1`, [id, nm]);
    return { ok: true, name: nm };
  }

  /** The caller's own ledger (newest first). kind 'buy' rows carry the card name; nothing here can change a balance. */
  async ledger(key: string | undefined, limit = 50) {
    const id = await this.need(key), n = Math.min(100, Math.max(1, Math.floor(Number(limit)) || 50));
    const rows = (await this.db.query(`SELECT l.id, l.kind, l.points, l.vrcoin, l.ref, l.created_at, c.name card FROM economy_ledger l
      LEFT JOIN cards c ON l.kind='buy' AND c.character_id=l.ref WHERE l.player_id=$1 ORDER BY l.id DESC LIMIT $2`, [id, n])).rows;
    return { items: rows.map((r: any) => ({ id: Number(r.id), kind: r.kind, points: r.points, vrcoin: r.vrcoin, card: r.card ?? null, at: r.created_at })) };
  }

  /** The caller's finished PvP matches (newest first) + totals. Reads pvp_matches / pvp_match_players only. */
  async matches(key: string | undefined, limit = 30) {
    const id = await this.need(key), n = Math.min(100, Math.max(1, Math.floor(Number(limit)) || 30));
    const rows = (await this.db.query(`SELECT m.ended_at, m.turns, m.end_reason, m.forfeit_seat, p.seat, p.is_winner, p.reward_points, p.reward_vrcoin
      FROM pvp_match_players p JOIN pvp_matches m ON m.id=p.match_id WHERE p.player_id=$1 ORDER BY m.ended_at DESC LIMIT $2`, [id, n])).rows;
    const t = (await this.db.query(`SELECT count(*)::int total, count(*) FILTER (WHERE is_winner)::int wins FROM pvp_match_players WHERE player_id=$1`, [id])).rows[0];
    return { total: t.total, wins: t.wins, losses: t.total - t.wins,
      items: rows.map((r: any) => ({ at: r.ended_at, turns: r.turns, win: !!r.is_winner, reason: r.end_reason, youForfeited: r.forfeit_seat === null || r.forfeit_seat === undefined ? null : r.forfeit_seat === r.seat, points: r.reward_points, vrcoin: r.reward_vrcoin })) };
  }

  // ---- admin ----
  async adminPlayers() { return (await this.db.query(`SELECT id, name, points, vrcoin, pvp_matches, created_at, (SELECT coalesce(sum(qty),0)::int FROM player_cards c WHERE c.player_id=p.id) cards FROM players p ORDER BY created_at DESC LIMIT 200`)).rows; }
  async adminGrant(playerId: string, points: number, vrcoin: number, note: string) {
    if (!Number.isInteger(points) || !Number.isInteger(vrcoin) || Math.abs(points) > 1e6 || Math.abs(vrcoin) > 1e6) throw new AppError(400, 'จำนวนไม่ถูกต้อง');
    return this.db.transaction(async (tx: Db) => {
      const p = (await tx.query(`SELECT points, vrcoin FROM players WHERE id=$1 FOR UPDATE`, [playerId])).rows[0];
      if (!p) throw new AppError(404, 'ไม่พบผู้เล่น');
      if (p.points + points < 0 || p.vrcoin + vrcoin < 0) throw new AppError(400, 'ยอดคงเหลือติดลบไม่ได้');
      await tx.query(`UPDATE players SET points=points+$2, vrcoin=vrcoin+$3 WHERE id=$1`, [playerId, points, vrcoin]);
      await tx.query(`INSERT INTO economy_ledger(player_id,kind,points,vrcoin,ref) VALUES ($1,'admin',$2,$3,$4)`, [playerId, points, vrcoin, String(note ?? '').slice(0, 80)]);
      return { ok: true };
    });
  }
  async adminSetPrice(level: number, currency: string, price: number) {
    if (![40, 70, 99].includes(level) || !['points', 'vrcoin'].includes(currency) || !Number.isInteger(price) || price < 0 || price > 1e7) throw new AppError(400, 'ข้อมูลราคาไม่ถูกต้อง');
    await this.db.query(`INSERT INTO shop_prices(level,currency,price) VALUES ($1,$2,$3) ON CONFLICT (level) DO UPDATE SET currency=$2, price=$3`, [level, currency, price]);
    return { ok: true };
  }
  async adminRemovePrice(level: number) { await this.db.query(`DELETE FROM shop_prices WHERE level=$1`, [level]); return { ok: true }; }
}
