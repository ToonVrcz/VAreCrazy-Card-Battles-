// Online 2-player rooms. The server owns the game state (src/engine/game.ts); clients get a seat-relative, redacted view and
// send actions. Polling transport: GET room every ~1.5s. Opponent hand/deck/face-down traps are never sent.
import { randomBytes } from 'node:crypto';
import { createGame, act, EngineError, type Action, type CardDef, type Game, type FusionPair } from '../engine/game.ts';
import { buildDeck, buildSet, viewFor, validateDeck, validateEvoDeck, deckFromIds, EVO_RULES } from '../engine/deck-view.ts';
import { Economy, ECONOMY } from './economy.ts';
import { TIMING, newMeta, tickRoom, needsTick, forfeit, type RoomMeta } from '../engine/turn-timer.ts';
import { AppError, type CardService } from './service.ts';

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const rnd = (n: number) => { const b = randomBytes(1)[0]; return b % n; };
const newCode = () => Array.from({ length: 5 }, () => CODE_CHARS[rnd(CODE_CHARS.length)]).join('');
const newToken = () => randomBytes(16).toString('hex');

export { buildDeck, buildSet, viewFor };

type Tx = { query: <T = any>(sql: string, p?: any[]) => Promise<{ rows: T[] }> };
interface SeatDeck { m: string[] | null; e: string[] | null }
const asSeatDeck = (x: any): SeatDeck => (Array.isArray(x) ? { m: x, e: null } : x && typeof x === 'object' ? { m: x.m ?? null, e: x.e ?? null } : { m: null, e: null });

export class Rooms {
  private eco: Economy;
  constructor(private svc: CardService) { this.eco = new Economy(svc); }
  private get db() { return this.svc.db; }

  private async loadPool() {
    const rows = (await this.db.query<any>(`SELECT c.character_id id, c.name, c.card_type type, c.level, ch.key chain, c.hp, c.atk, c.def, el.key element
      FROM cards c LEFT JOIN evolution_chains ch ON ch.id=c.chain_id LEFT JOIN taxonomy_values el ON el.id=c.element_id WHERE c.status<>'archived'`)).rows;
    const pool: CardDef[] = rows.map(r => ({ id: r.id, name: r.name, type: r.type, level: r.level ?? null, chain: r.chain ?? null, hp: r.hp ?? null, atk: r.atk ?? null, def: r.def ?? 0, element: r.element ?? null }));
    const fp = (await this.db.query<any>(`SELECT a.key a, b.key b, f.hp_bonus hp, f.atk_bonus atk, f.def_bonus def FROM card_fusion_partners f
      JOIN cards c ON c.id=f.card_id JOIN evolution_chains a ON a.id=c.chain_id JOIN evolution_chains b ON b.id=f.partner_chain_id`)).rows;
    return { pool, pairs: fp as FusionPair[] };
  }

  /** Checks the chosen decks (main: 40 ids, evo: <=15 owned forms). null = let the server pick. Returns the profile id (null = guest). */
  private async checkDecks(deck: unknown, evo: unknown, key: string | undefined, pool: CardDef[]): Promise<{ pid: string | null; d: SeatDeck }> {
    const pid = await this.eco.resolve(key), byId = new Map(pool.map(c => [c.id, c]));
    let m: string[] | null = null, e: string[] | null = null;
    if (deck !== undefined && deck !== null) { const err = validateDeck(deck, byId); if (err) throw new AppError(400, err); m = deck as string[]; }
    if (evo !== undefined && evo !== null) {
      if (!pid) throw new AppError(401, 'ต้องมีโปรไฟล์ผู้เล่นถึงจะใช้เด็คอีโวได้');
      const err = validateEvoDeck(evo, byId, await this.eco.inventory(pid)); if (err) throw new AppError(400, err); e = evo as string[];
    }
    return { pid, d: { m, e } };
  }

  async create(deck?: unknown, evo?: unknown, key?: string) {
    await this.db.query(`DELETE FROM play_rooms WHERE updated_at < now() - interval '1 day'`);
    const { pid, d } = await this.checkDecks(deck, evo, key, (await this.loadPool()).pool);
    const tok = newToken();
    for (let i = 0; i < 8; i++) {
      const code = newCode();
      const r = await this.db.query(`INSERT INTO play_rooms(code,tokens,decks,profiles) VALUES ($1,$2::jsonb,$3::jsonb,$4::jsonb) ON CONFLICT DO NOTHING RETURNING code`, [code, JSON.stringify([tok, null]), JSON.stringify([d, null]), JSON.stringify([pid, null])]);
      if (r.rows.length) return { code, token: tok, seat: 0 };
    }
    throw new AppError(500, 'สร้างห้องไม่สำเร็จ ลองใหม่');
  }

  async join(code: string, deck?: unknown, evo?: unknown, key?: string) {
    code = code.toUpperCase();
    const { pool, pairs } = await this.loadPool();
    if (pool.filter(c => c.type === 'character' && c.level === 15).length < 3) throw new AppError(409, 'ยังมีการ์ดไม่พอสำหรับเล่น');
    const mine = await this.checkDecks(deck, evo, key, pool), byId = new Map(pool.map(c => [c.id, c]));
    const tok = newToken();
    return this.db.transaction(async (tx: Tx) => {
      const row = (await tx.query(`SELECT status, tokens, decks, profiles FROM play_rooms WHERE code=$1 FOR UPDATE`, [code])).rows[0];
      if (!row) throw new AppError(404, 'ไม่พบห้องนี้');
      if (row.status !== 'waiting') throw new AppError(409, 'ห้องนี้เริ่มเล่นแล้ว');
      if (mine.pid && mine.pid === row.profiles?.[0]) throw new AppError(409, 'เข้าห้องของตัวเองไม่ได้');
      const first = rnd(2) as 0 | 1, pids = [row.profiles?.[0] ?? null, mine.pid], seatDecks = [asSeatDeck(row.decks?.[0]), mine.d];
      // Build each seat: chosen main deck (else random), chosen evo deck (else every owned form that fits the main deck's chains, max 15)
      const sets: { main: CardDef[]; extra: CardDef[] }[] = [];
      for (let s = 0; s < 2; s++) {
        const inv = pids[s] ? await this.eco.inventory(pids[s], tx) : new Map<string, number>(), sd = seatDecks[s];
        const auto = (chains: string[]) => pool.filter(c => c.type === 'character' && (c.level ?? 0) > 15 && c.chain && chains.includes(c.chain) && inv.has(c.id)).sort((a, b) => (a.level ?? 0) - (b.level ?? 0))
          .flatMap(c => Array.from({ length: Math.min(inv.get(c.id)!, ECONOMY.maxCopies) }, () => c)).slice(0, EVO_RULES.max);
        const mainOk = sd.m && !validateDeck(sd.m, byId), evoOk = sd.e && !validateEvoDeck(sd.e, byId, inv);
        if (mainOk) {
          const main = deckFromIds(sd.m!, byId), chains = [...new Set(main.filter(c => c.type === 'character' && c.chain).map(c => c.chain!))];
          sets.push({ main, extra: evoOk ? deckFromIds(sd.e!, byId) : auto(chains).map(c => ({ ...c })) });
        } else { const b = buildSet(pool, pairs, Math.random, auto); sets.push({ main: b.main, extra: evoOk ? deckFromIds(sd.e!, byId) : b.extra }); }
      }
      const g = createGame([sets[0].main, sets[1].main], Date.now() % 1e9, first, { fusionPairs: pairs, interactive: true, extras: [sets[0].extra, sets[1].extra] });
      const tokens = [row.tokens[0], tok], now = Date.now();
      await tx.query(`UPDATE play_rooms SET status='playing', tokens=$2::jsonb, state=$3::jsonb, decks=$4::jsonb, profiles=$5::jsonb, meta=$6::jsonb, version=1, updated_at=now() WHERE code=$1`,
        [code, JSON.stringify(tokens), JSON.stringify(g), JSON.stringify(seatDecks), JSON.stringify(pids), JSON.stringify(newMeta(now))]);
      return { code, token: tok, seat: 1 };
    });
  }

  private seatOf(tokens: (string | null)[], token: string): 0 | 1 {
    const s = tokens.findIndex(t => t && t === token); if (s < 0) throw new AppError(403, 'โทเค็นห้องไม่ถูกต้อง'); return s as 0 | 1;
  }

  /** Pays both seats (that have profiles) once, when a match ends after enough turns. Mutates meta; call inside the room transaction. */
  private async settle(tx: Tx, code: string, profiles: (string | null)[], g: Game, meta: RoomMeta) {
    if (g.winner === null || meta.rewarded) return;
    meta.rewarded = true;
    if (g.turn < ECONOMY.minTurnsForReward) return;
    meta.rewards = await this.eco.award(tx, profiles ?? [null, null], code);
  }

  private shape(row: any, seat: 0 | 1, now: number, full: boolean) {
    const meta = (row.meta ?? {}) as RoomMeta, base: any = { status: row.status, seat, version: row.version, serverNow: now, deadline: meta.deadline ?? null };
    if (row.status === 'finished') { base.endReason = meta.endReason ?? null; base.forfeitedYou = meta.forfeit === undefined || meta.forfeit === null ? null : meta.forfeit === seat; base.reward = meta.rewards?.[seat] ?? null; }
    return full ? { ...base, game: viewFor(row.state as Game, seat) } : { ...base, unchanged: true };
  }

  /** Housekeeping on the write path: stamps presence, runs timeouts / absence forfeits, bumps the version if the game changed. */
  private async tick(code: string, seat: 0 | 1, now: number) {
    return this.db.transaction(async (tx: Tx) => {
      const row = (await tx.query(`SELECT status, tokens, state, version, meta, profiles FROM play_rooms WHERE code=$1 FOR UPDATE`, [code])).rows[0];
      if (!row) throw new AppError(404, 'ไม่พบห้องนี้');
      if (row.status !== 'playing') return row;
      const meta = row.meta as RoomMeta, r = tickRoom(row.state as Game, meta, seat, now);
      await this.settle(tx, code, row.profiles, r.game, meta);
      const status = r.game.winner !== null ? 'finished' : 'playing', version = row.version + (r.changed ? 1 : 0);
      await tx.query(`UPDATE play_rooms SET state=$2::jsonb, meta=$3::jsonb, status=$4, version=$5${r.changed ? ', updated_at=now()' : ''} WHERE code=$1`, [code, JSON.stringify(r.game), JSON.stringify(meta), status, version]);
      return { ...row, state: r.game, meta, status, version };
    });
  }

  async view(code: string, token: string, since = -1) {
    code = code.toUpperCase();
    let row = (await this.db.query<any>(`SELECT status, tokens, state, version, meta FROM play_rooms WHERE code=$1`, [code])).rows[0];
    if (!row) throw new AppError(404, 'ไม่พบห้องนี้');
    const seat = this.seatOf(row.tokens, token), now = Date.now();
    if (row.status === 'waiting') return { status: 'waiting', seat, version: row.version };
    if (row.status === 'playing' && needsTick(row.state as Game, row.meta as RoomMeta, seat, now)) row = await this.tick(code, seat, now);
    return this.shape(row, seat, now, since !== row.version);
  }

  async act(code: string, token: string, action: Action) {
    code = code.toUpperCase();
    if (!action || typeof action !== 'object' || typeof (action as any).t !== 'string') throw new AppError(400, 'รูปแบบการกระทำไม่ถูกต้อง');
    return this.db.transaction(async (tx: Tx) => {
      const row = (await tx.query(`SELECT status, tokens, state, version, meta, profiles FROM play_rooms WHERE code=$1 FOR UPDATE`, [code])).rows[0];
      if (!row) throw new AppError(404, 'ไม่พบห้องนี้');
      const seat = this.seatOf(row.tokens, token), now = Date.now();
      if (row.status !== 'playing') throw new AppError(409, row.status === 'waiting' ? 'ยังรอผู้เล่นอีกคน' : 'เกมจบแล้ว');
      const meta = row.meta as RoomMeta, t = tickRoom(row.state as Game, meta, seat, now);   // a late move runs overdue timeouts first
      let g = t.game, version = row.version + (t.changed ? 1 : 0);
      const save = async (status: string) => { await this.settle(tx, code, row.profiles, g, meta); await tx.query(`UPDATE play_rooms SET state=$2::jsonb, meta=$3::jsonb, status=$4, version=$5, updated_at=now() WHERE code=$1`, [code, JSON.stringify(g), JSON.stringify(meta), status, version]); };
      if (g.winner !== null) { await save('finished'); throw new AppError(409, 'เกมจบแล้ว'); }
      if ((g.pending ? g.pending.responder : g.active) !== seat) { if (t.changed) await save('playing'); throw new AppError(409, 'ยังไม่ถึงตาของคุณ'); }
      try { g = act(g, action); } catch (e) { if (e instanceof EngineError) { if (t.changed) await save('playing'); throw new AppError(400, e.message); } throw e; }
      meta.misses[seat] = 0; meta.deadline = g.winner !== null ? null : now + TIMING.turnMs; version += 1;
      await save(g.winner !== null ? 'finished' : 'playing');
      return { ok: true, version };
    });
  }

  /** Leaving a running game = resigning; leaving a waiting room closes it. */
  async leave(code: string, token: string) {
    code = code.toUpperCase();
    return this.db.transaction(async (tx: Tx) => {
      const row = (await tx.query(`SELECT status, tokens, state, version, meta, profiles FROM play_rooms WHERE code=$1 FOR UPDATE`, [code])).rows[0];
      if (!row) throw new AppError(404, 'ไม่พบห้องนี้');
      const seat = this.seatOf(row.tokens, token);
      if (row.status === 'waiting') { await tx.query(`DELETE FROM play_rooms WHERE code=$1`, [code]); return { ok: true }; }
      if (row.status === 'playing') {
        const g = row.state as Game, meta = row.meta as RoomMeta; forfeit(g, seat, 'left', meta);
        await this.settle(tx, code, row.profiles, g, meta);
        await tx.query(`UPDATE play_rooms SET state=$2::jsonb, meta=$3::jsonb, status='finished', version=$4, updated_at=now() WHERE code=$1`, [code, JSON.stringify(g), JSON.stringify(meta), row.version + 1]);
      }
      return { ok: true };
    });
  }
}
