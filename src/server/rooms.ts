// Online 2-player rooms. The server owns the game state (src/engine/game.ts); clients get a seat-relative, redacted view and
// send actions. Polling transport: GET room every ~1.5s. Opponent hand/deck/face-down traps are never sent.
import { randomBytes } from 'node:crypto';
import { createGame, act, EngineError, type Action, type CardDef, type Game, type FusionPair } from '../engine/game.ts';
import { buildDeck, viewFor, validateDeck, deckFromIds } from '../engine/deck-view.ts';
import { TIMING, newMeta, tickRoom, needsTick, forfeit, type RoomMeta } from '../engine/turn-timer.ts';
import { AppError, type CardService } from './service.ts';

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const rnd = (n: number) => { const b = randomBytes(1)[0]; return b % n; };
const newCode = () => Array.from({ length: 5 }, () => CODE_CHARS[rnd(CODE_CHARS.length)]).join('');
const newToken = () => randomBytes(16).toString('hex');

export { buildDeck, viewFor };

export class Rooms {
  constructor(private svc: CardService) {}
  private get db() { return this.svc.db; }

  private async loadPool() {
    const rows = (await this.db.query<any>(`SELECT c.character_id id, c.name, c.card_type type, c.level, ch.key chain, c.hp, c.atk, c.def, el.key element
      FROM cards c LEFT JOIN evolution_chains ch ON ch.id=c.chain_id LEFT JOIN taxonomy_values el ON el.id=c.element_id WHERE c.status<>'archived'`)).rows;
    const pool: CardDef[] = rows.map(r => ({ id: r.id, name: r.name, type: r.type, level: r.level ?? null, chain: r.chain ?? null, hp: r.hp ?? null, atk: r.atk ?? null, def: r.def ?? 0, element: r.element ?? null }));
    const fp = (await this.db.query<any>(`SELECT a.key a, b.key b, f.hp_bonus hp, f.atk_bonus atk, f.def_bonus def FROM card_fusion_partners f
      JOIN cards c ON c.id=f.card_id JOIN evolution_chains a ON a.id=c.chain_id JOIN evolution_chains b ON b.id=f.partner_chain_id`)).rows;
    return { pool, pairs: fp as FusionPair[] };
  }

  /** null/undefined deck = random; otherwise a list of card ids, checked against the live card pool. */
  private async checkDeck(deck: unknown, pool: CardDef[]): Promise<string[] | null> {
    if (deck === undefined || deck === null) return null;
    const err = validateDeck(deck, new Map(pool.map(c => [c.id, c])));
    if (err) throw new AppError(400, err);
    return deck as string[];
  }

  async create(deck?: unknown) {
    await this.db.query(`DELETE FROM play_rooms WHERE updated_at < now() - interval '1 day'`);
    const ids = await this.checkDeck(deck, (await this.loadPool()).pool);
    const tok = newToken();
    for (let i = 0; i < 8; i++) {
      const code = newCode();
      const r = await this.db.query(`INSERT INTO play_rooms(code,tokens,decks) VALUES ($1,$2::jsonb,$3::jsonb) ON CONFLICT DO NOTHING RETURNING code`, [code, JSON.stringify([tok, null]), JSON.stringify([ids, null])]);
      if (r.rows.length) return { code, token: tok, seat: 0 };
    }
    throw new AppError(500, 'สร้างห้องไม่สำเร็จ ลองใหม่');
  }

  async join(code: string, deck?: unknown) {
    code = code.toUpperCase();
    const { pool, pairs } = await this.loadPool();
    if (pool.filter(c => c.type === 'character' && c.level === 15).length < 3) throw new AppError(409, 'ยังมีการ์ดไม่พอสำหรับเล่น');
    const mine = await this.checkDeck(deck, pool), byId = new Map(pool.map(c => [c.id, c]));
    const tok = newToken();
    return this.db.transaction(async (tx: any) => {
      const row = (await tx.query(`SELECT status, tokens, decks FROM play_rooms WHERE code=$1 FOR UPDATE`, [code])).rows[0];
      if (!row) throw new AppError(404, 'ไม่พบห้องนี้');
      if (row.status !== 'waiting') throw new AppError(409, 'ห้องนี้เริ่มเล่นแล้ว');
      const first = rnd(2) as 0 | 1, ids: (string[] | null)[] = [row.decks?.[0] ?? null, mine];
      // a creator's saved deck may have lost a card since the room was made: fall back to random for that seat only
      const mk = (x: string[] | null) => (x && !validateDeck(x, byId) ? deckFromIds(x, byId) : buildDeck(pool, pairs));
      const g = createGame([mk(ids[0]), mk(ids[1])], Date.now() % 1e9, first, { fusionPairs: pairs, interactive: true });
      const tokens = [row.tokens[0], tok], now = Date.now();
      await tx.query(`UPDATE play_rooms SET status='playing', tokens=$2::jsonb, state=$3::jsonb, decks=$4::jsonb, meta=$5::jsonb, version=1, updated_at=now() WHERE code=$1`,
        [code, JSON.stringify(tokens), JSON.stringify(g), JSON.stringify(ids), JSON.stringify(newMeta(now))]);
      return { code, token: tok, seat: 1 };
    });
  }

  private seatOf(tokens: (string | null)[], token: string): 0 | 1 {
    const s = tokens.findIndex(t => t && t === token); if (s < 0) throw new AppError(403, 'โทเค็นห้องไม่ถูกต้อง'); return s as 0 | 1;
  }

  private shape(row: any, seat: 0 | 1, now: number, full: boolean) {
    const meta = (row.meta ?? {}) as RoomMeta, base: any = { status: row.status, seat, version: row.version, serverNow: now, deadline: meta.deadline ?? null };
    if (row.status === 'finished') { base.endReason = meta.endReason ?? null; base.forfeitedYou = meta.forfeit === undefined || meta.forfeit === null ? null : meta.forfeit === seat; }
    return full ? { ...base, game: viewFor(row.state as Game, seat) } : { ...base, unchanged: true };
  }

  /** Housekeeping on the write path: stamps presence, runs timeouts / absence forfeits, bumps the version if the game changed. */
  private async tick(code: string, seat: 0 | 1, now: number) {
    return this.db.transaction(async (tx: any) => {
      const row = (await tx.query(`SELECT status, tokens, state, version, meta FROM play_rooms WHERE code=$1 FOR UPDATE`, [code])).rows[0];
      if (!row) throw new AppError(404, 'ไม่พบห้องนี้');
      if (row.status !== 'playing') return row;
      const meta = row.meta as RoomMeta, r = tickRoom(row.state as Game, meta, seat, now);
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
    return this.db.transaction(async (tx: any) => {
      const row = (await tx.query(`SELECT status, tokens, state, version, meta FROM play_rooms WHERE code=$1 FOR UPDATE`, [code])).rows[0];
      if (!row) throw new AppError(404, 'ไม่พบห้องนี้');
      const seat = this.seatOf(row.tokens, token), now = Date.now();
      if (row.status !== 'playing') throw new AppError(409, row.status === 'waiting' ? 'ยังรอผู้เล่นอีกคน' : 'เกมจบแล้ว');
      const meta = row.meta as RoomMeta, t = tickRoom(row.state as Game, meta, seat, now);   // a late move runs overdue timeouts first
      let g = t.game, version = row.version + (t.changed ? 1 : 0);
      const save = (status: string) => tx.query(`UPDATE play_rooms SET state=$2::jsonb, meta=$3::jsonb, status=$4, version=$5, updated_at=now() WHERE code=$1`, [code, JSON.stringify(g), JSON.stringify(meta), status, version]);
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
    return this.db.transaction(async (tx: any) => {
      const row = (await tx.query(`SELECT status, tokens, state, version, meta FROM play_rooms WHERE code=$1 FOR UPDATE`, [code])).rows[0];
      if (!row) throw new AppError(404, 'ไม่พบห้องนี้');
      const seat = this.seatOf(row.tokens, token);
      if (row.status === 'waiting') { await tx.query(`DELETE FROM play_rooms WHERE code=$1`, [code]); return { ok: true }; }
      if (row.status === 'playing') {
        const g = row.state as Game, meta = row.meta as RoomMeta; forfeit(g, seat, 'left', meta);
        await tx.query(`UPDATE play_rooms SET state=$2::jsonb, meta=$3::jsonb, status='finished', version=$4, updated_at=now() WHERE code=$1`, [code, JSON.stringify(g), JSON.stringify(meta), row.version + 1]);
      }
      return { ok: true };
    });
  }
}
