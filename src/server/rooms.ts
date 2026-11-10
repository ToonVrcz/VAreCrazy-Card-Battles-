// Online 2-player rooms. The server owns the game state (src/engine/game.ts); clients get a seat-relative, redacted view and
// send actions. Polling transport: GET room every ~1.5s. Opponent hand/deck/face-down traps are never sent.
import { randomBytes } from 'node:crypto';
import { createGame, act, EngineError, type Action, type CardDef, type Game, type FusionPair } from '../engine/game.ts';
import { buildDeck } from '../engine/deck-view.ts';
import { viewFor } from '../engine/deck-view.ts';
import { AppError, type CardService } from './service.ts';

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const rnd = (n: number) => { const b = randomBytes(1)[0]; return b % n; };
const newCode = () => Array.from({ length: 5 }, () => CODE_CHARS[rnd(CODE_CHARS.length)]).join('');
const newToken = () => randomBytes(16).toString('hex');

export { buildDeck, viewFor } from '../engine/deck-view.ts';

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

  async create() {
    await this.db.query(`DELETE FROM play_rooms WHERE updated_at < now() - interval '1 day'`);
    const tok = newToken();
    for (let i = 0; i < 8; i++) {
      const code = newCode();
      const r = await this.db.query(`INSERT INTO play_rooms(code,tokens) VALUES ($1,$2::jsonb) ON CONFLICT DO NOTHING RETURNING code`, [code, JSON.stringify([tok, null])]);
      if (r.rows.length) return { code, token: tok, seat: 0 };
    }
    throw new AppError(500, 'สร้างห้องไม่สำเร็จ ลองใหม่');
  }

  async join(code: string) {
    code = code.toUpperCase();
    const { pool, pairs } = await this.loadPool();
    if (pool.filter(c => c.type === 'character' && c.level === 15).length < 3) throw new AppError(409, 'ยังมีการ์ดไม่พอสำหรับเล่น');
    const tok = newToken();
    return this.db.transaction(async (tx: any) => {
      const row = (await tx.query(`SELECT status, tokens FROM play_rooms WHERE code=$1 FOR UPDATE`, [code])).rows[0];
      if (!row) throw new AppError(404, 'ไม่พบห้องนี้');
      if (row.status !== 'waiting') throw new AppError(409, 'ห้องนี้เริ่มเล่นแล้ว');
      const first = rnd(2) as 0 | 1;
      const g = createGame([buildDeck(pool, pairs), buildDeck(pool, pairs)], Date.now() % 1e9, first, { fusionPairs: pairs, interactive: true });
      const tokens = [row.tokens[0], tok];
      await tx.query(`UPDATE play_rooms SET status='playing', tokens=$2::jsonb, state=$3::jsonb, version=1, updated_at=now() WHERE code=$1`, [code, JSON.stringify(tokens), JSON.stringify(g)]);
      return { code, token: tok, seat: 1 };
    });
  }

  private seatOf(tokens: (string | null)[], token: string): 0 | 1 {
    const s = tokens.findIndex(t => t && t === token); if (s < 0) throw new AppError(403, 'โทเค็นห้องไม่ถูกต้อง'); return s as 0 | 1;
  }

  async view(code: string, token: string, since = -1) {
    const row = (await this.db.query<any>(`SELECT status, tokens, state, version FROM play_rooms WHERE code=$1`, [code.toUpperCase()])).rows[0];
    if (!row) throw new AppError(404, 'ไม่พบห้องนี้');
    const seat = this.seatOf(row.tokens, token);
    if (row.status === 'waiting') return { status: 'waiting', seat, version: row.version };
    if (since === row.version) return { status: row.status, seat, version: row.version, unchanged: true };
    return { status: row.status, seat, version: row.version, game: viewFor(row.state as Game, seat) };
  }

  async act(code: string, token: string, action: Action) {
    code = code.toUpperCase();
    if (!action || typeof action !== 'object' || typeof (action as any).t !== 'string') throw new AppError(400, 'รูปแบบการกระทำไม่ถูกต้อง');
    return this.db.transaction(async (tx: any) => {
      const row = (await tx.query(`SELECT status, tokens, state, version FROM play_rooms WHERE code=$1 FOR UPDATE`, [code])).rows[0];
      if (!row) throw new AppError(404, 'ไม่พบห้องนี้');
      const seat = this.seatOf(row.tokens, token);
      if (row.status !== 'playing') throw new AppError(409, row.status === 'waiting' ? 'ยังรอผู้เล่นอีกคน' : 'เกมจบแล้ว');
      const g = row.state as Game, turnOf = g.pending ? g.pending.responder : g.active;
      if (turnOf !== seat) throw new AppError(409, 'ยังไม่ถึงตาของคุณ');
      let next: Game;
      try { next = act(g, action); } catch (e) { if (e instanceof EngineError) throw new AppError(400, e.message); throw e; }
      await tx.query(`UPDATE play_rooms SET state=$2::jsonb, status=$3, version=version+1, updated_at=now() WHERE code=$1`, [code, JSON.stringify(next), next.winner !== null ? 'finished' : 'playing']);
      return { ok: true, version: row.version + 1 };
    });
  }
}
