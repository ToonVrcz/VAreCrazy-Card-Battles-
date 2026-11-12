// Online 2-player rooms. The server owns the game state (src/engine/game.ts); clients get a seat-relative, redacted view and
// send actions. Polling transport: GET room every ~1.5s. Opponent hand/deck/face-down traps are never sent.
import { randomBytes, randomUUID } from 'node:crypto';
import { parseEffect, type Effect } from '../engine/effects.ts';
import { createGame, act, EngineError, STATS_VERSION, type Action, type CardDef, type Game, type FusionPair } from '../engine/game.ts';
import { buildDeck, buildSet, viewFor, viewSpectator, validateDeck, validateEvoDeck, deckFromIds, EVO_RULES } from '../engine/deck-view.ts';
import { Economy, ECONOMY } from './economy.ts';
import { TIMING, TURN_RANGE, newMeta, tickRoom, needsTick, forfeit, turnLen, type RoomMeta } from '../engine/turn-timer.ts';
import { AppError, type CardService } from './service.ts';

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const rnd = (n: number) => { const b = randomBytes(1)[0]; return b % n; };
const newCode = () => Array.from({ length: 5 }, () => CODE_CHARS[rnd(CODE_CHARS.length)]).join('');
const newToken = () => randomBytes(16).toString('hex');
export const ROOM = { spectatorMax: 10, nameMax: 24, lobbyPresenceMs: 30_000, listWaitMs: 10 * 60_000 } as const;

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
    const fxRows = (await this.db.query<any>(`SELECT c.character_id id, e.trigger, e.target_text, e.action_text, e.condition_text, e.cost_text, e.duration, e.use_limit, e.description
      FROM card_effects e JOIN cards c ON c.id=e.card_id WHERE c.status<>'archived' ORDER BY c.character_id, e.sort_order`)).rows;
    const fx = new Map<string, Effect[]>();
    for (const r of fxRows) { const e = parseEffect(r); if (e) fx.set(r.id, [...(fx.get(r.id) ?? []), e]); }   // only abilities the engine understands exactly
    const pool: CardDef[] = rows.map(r => ({ id: r.id, name: r.name, type: r.type, level: r.level ?? null, chain: r.chain ?? null, hp: r.hp ?? null, atk: r.atk ?? null, def: r.def ?? 0, element: r.element ?? null, effects: fx.get(r.id) }));
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

  private roomName(name: unknown) { return String(name ?? '').trim().replace(/\s+/g, ' ').slice(0, ROOM.nameMax) || null; }
  private turnMsOf(sec: unknown): number | null {
    if (sec === undefined || sec === null || sec === '') return null;
    const ms = Math.round(Number(sec) * 1000);
    if (!Number.isFinite(ms) || ms < TURN_RANGE.minMs || ms > TURN_RANGE.maxMs) throw new AppError(400, `เวลาต่อเทิร์นต้องอยู่ระหว่าง ${TURN_RANGE.minMs / 1000}–${TURN_RANGE.maxMs / 1000} วินาที`);
    return ms === TIMING.turnMs ? null : ms;
  }

  async create(deck?: unknown, evo?: unknown, key?: string, opts: { name?: unknown; public?: unknown; turnSec?: unknown } = {}) {
    await this.db.query(`DELETE FROM play_rooms WHERE updated_at < now() - interval '1 day'`);
    const turnMs = this.turnMsOf(opts.turnSec), name = this.roomName(opts.name), isPublic = opts.public === true;
    const { pid, d } = await this.checkDecks(deck, evo, key, (await this.loadPool()).pool);
    const tok = newToken(), now = Date.now();
    for (let i = 0; i < 8; i++) {
      const code = newCode();
      const r = await this.db.query(`INSERT INTO play_rooms(code,tokens,decks,profiles,name,is_public,turn_ms,meta) VALUES ($1,$2::jsonb,$3::jsonb,$4::jsonb,$5,$6,$7,$8::jsonb) ON CONFLICT DO NOTHING RETURNING code`,
        [code, JSON.stringify([tok, null]), JSON.stringify([d, null]), JSON.stringify([pid, null]), name, isPublic, turnMs, JSON.stringify({ seen: [now, null], kicked: [] })]);
      if (r.rows.length) return { code, token: tok, seat: 0 };
    }
    throw new AppError(500, 'สร้างห้องไม่สำเร็จ ลองใหม่');
  }

  /** The guest takes seat 1 and the room enters the lobby. The game does NOT start: the host starts it (start()). */
  async join(code: string, deck?: unknown, evo?: unknown, key?: string) {
    code = code.toUpperCase();
    const { pool } = await this.loadPool();
    if (pool.filter(c => c.type === 'character' && c.level === 15).length < 3) throw new AppError(409, 'ยังมีการ์ดไม่พอสำหรับเล่น');
    const mine = await this.checkDecks(deck, evo, key, pool), tok = newToken();
    return this.db.transaction(async (tx: Tx) => {
      const row = (await tx.query(`SELECT status, tokens, decks, profiles, meta FROM play_rooms WHERE code=$1 FOR UPDATE`, [code])).rows[0];
      if (!row) throw new AppError(404, 'ไม่พบห้องนี้');
      if (row.status === 'lobby') throw new AppError(409, 'ห้องนี้มีผู้เล่นครบแล้ว');
      if (row.status !== 'waiting') throw new AppError(409, 'ห้องนี้เริ่มเล่นแล้ว');
      if (mine.pid && mine.pid === row.profiles?.[0]) throw new AppError(409, 'เข้าห้องของตัวเองไม่ได้');
      const meta = (row.meta ?? {}) as any; meta.seen = [meta.seen?.[0] ?? null, Date.now()];
      await tx.query(`UPDATE play_rooms SET status='lobby', tokens=$2::jsonb, decks=$3::jsonb, profiles=$4::jsonb, ready='[false,false]'::jsonb, meta=$5::jsonb, version=version+1, updated_at=now() WHERE code=$1`,
        [code, JSON.stringify([row.tokens[0], tok]), JSON.stringify([asSeatDeck(row.decks?.[0]), mine.d]), JSON.stringify([row.profiles?.[0] ?? null, mine.pid]), JSON.stringify(meta)]);
      return { code, token: tok, seat: 1 };
    });
  }

  /** Guest (seat 1) marks themself ready / not ready. */
  async ready(code: string, token: string, ready: unknown) {
    code = code.toUpperCase();
    return this.db.transaction(async (tx: Tx) => {
      const row = (await tx.query(`SELECT status, tokens FROM play_rooms WHERE code=$1 FOR UPDATE`, [code])).rows[0];
      if (!row) throw new AppError(404, 'ไม่พบห้องนี้');
      const seat = this.seatOf(row.tokens, token);
      if (seat !== 1) throw new AppError(409, 'เจ้าของห้องไม่ต้องกด Ready — กดเริ่มเกมได้เมื่อผู้เล่นอีกคนพร้อม');
      if (row.status !== 'lobby') throw new AppError(409, 'ห้องนี้ไม่อยู่ในช่วงรอเริ่มเกม');
      await tx.query(`UPDATE play_rooms SET ready=$2::jsonb, version=version+1, updated_at=now() WHERE code=$1`, [code, JSON.stringify([false, ready === true])]);
      return { ok: true, ready: ready === true };
    });
  }

  /** Host starts the game. Checked on the server: both seats taken, guest ready, both still connected, both decks still valid. */
  async start(code: string, token: string) {
    code = code.toUpperCase();
    const { pool, pairs } = await this.loadPool(), byId = new Map(pool.map(c => [c.id, c]));
    return this.db.transaction(async (tx: Tx) => {
      const row = (await tx.query(`SELECT status, tokens, decks, profiles, ready, meta, turn_ms FROM play_rooms WHERE code=$1 FOR UPDATE`, [code])).rows[0];
      if (!row) throw new AppError(404, 'ไม่พบห้องนี้');
      if (this.seatOf(row.tokens, token) !== 0) throw new AppError(403, 'เฉพาะเจ้าของห้องที่เริ่มเกมได้');
      if (row.status === 'playing' || row.status === 'finished') throw new AppError(409, 'ห้องนี้เริ่มเล่นไปแล้ว');
      if (row.status !== 'lobby' || !row.tokens[1]) throw new AppError(409, 'ยังรอผู้เล่นอีกคนเข้าห้อง');
      if (!row.ready?.[1]) throw new AppError(409, 'ผู้เล่นอีกคนยังไม่กด Ready');
      const now = Date.now(), meta0 = (row.meta ?? {}) as any, seen1 = meta0.seen?.[1];
      if (!seen1 || now - seen1 > ROOM.lobbyPresenceMs) throw new AppError(409, 'ผู้เล่นอีกคนหลุดการเชื่อมต่อ รอให้กลับมาก่อน');
      const first = rnd(2) as 0 | 1, pids = [row.profiles?.[0] ?? null, row.profiles?.[1] ?? null], seatDecks = [asSeatDeck(row.decks?.[0]), asSeatDeck(row.decks?.[1])];
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
      const meta = { ...newMeta(now, row.turn_ms ?? undefined), matchId: randomUUID(), startedAt: now, kicked: meta0.kicked ?? [] };
      await tx.query(`UPDATE play_rooms SET status='playing', state=$2::jsonb, meta=$3::jsonb, version=1, updated_at=now() WHERE code=$1`, [code, JSON.stringify(g), JSON.stringify(meta)]);
      return { ok: true };
    });
  }

  /** Host removes the guest (lobby only) or a spectator (any time). target: 'guest' | { spectator: index } */
  async kick(code: string, token: string, target: unknown) {
    code = code.toUpperCase();
    return this.db.transaction(async (tx: Tx) => {
      const row = (await tx.query(`SELECT status, tokens, decks, profiles, meta, spectators FROM play_rooms WHERE code=$1 FOR UPDATE`, [code])).rows[0];
      if (!row) throw new AppError(404, 'ไม่พบห้องนี้');
      if (this.seatOf(row.tokens, token) !== 0) throw new AppError(403, 'เฉพาะเจ้าของห้องที่เชิญออกได้');
      const meta = (row.meta ?? {}) as any; meta.kicked = [...(meta.kicked ?? [])].slice(-50);
      if (target === 'guest') {
        if (row.status !== 'lobby') throw new AppError(409, row.status === 'waiting' ? 'ยังไม่มีผู้เล่นอีกคนในห้อง' : 'เชิญผู้เล่นออกกลางเกมไม่ได้ (ใช้ยอมแพ้แทน)');
        meta.kicked.push(row.tokens[1]); meta.seen = [meta.seen?.[0] ?? null, null];
        await tx.query(`UPDATE play_rooms SET status='waiting', tokens=$2::jsonb, decks=$3::jsonb, profiles=$4::jsonb, ready='[false,false]'::jsonb, meta=$5::jsonb, version=version+1, updated_at=now() WHERE code=$1`,
          [code, JSON.stringify([row.tokens[0], null]), JSON.stringify([row.decks?.[0] ?? null, null]), JSON.stringify([row.profiles?.[0] ?? null, null]), JSON.stringify(meta)]);
        return { ok: true };
      }
      const i = target && typeof target === 'object' ? Number((target as any).spectator) : NaN, sp = [...(row.spectators ?? [])] as string[];
      if (!Number.isInteger(i) || i < 0 || i >= sp.length) throw new AppError(404, 'ไม่พบผู้ชมคนนี้');
      meta.kicked.push(sp[i]); sp.splice(i, 1);
      await tx.query(`UPDATE play_rooms SET spectators=$2::jsonb, meta=$3::jsonb, version=version+1 WHERE code=$1`, [code, JSON.stringify(sp), JSON.stringify(meta)]);
      return { ok: true };
    });
  }

  /** Join as a read-only spectator. Public rooms only; at most ROOM.spectatorMax per room. */
  async spectate(code: string) {
    code = code.toUpperCase(); const tok = newToken();
    return this.db.transaction(async (tx: Tx) => {
      const row = (await tx.query(`SELECT status, is_public, spectators FROM play_rooms WHERE code=$1 FOR UPDATE`, [code])).rows[0];
      if (!row) throw new AppError(404, 'ไม่พบห้องนี้');
      if (!row.is_public) throw new AppError(403, 'ห้องส่วนตัวไม่รับผู้ชม');
      if (row.status === 'finished') throw new AppError(409, 'เกมในห้องนี้จบแล้ว');
      const sp = [...(row.spectators ?? [])] as string[];
      if (sp.length >= ROOM.spectatorMax) throw new AppError(409, `ห้องนี้มีผู้ชมครบ ${ROOM.spectatorMax} คนแล้ว`);
      sp.push(tok);
      await tx.query(`UPDATE play_rooms SET spectators=$2::jsonb, version=version+1 WHERE code=$1`, [code, JSON.stringify(sp)]);
      return { code, token: tok, seat: 'spectator' as const };
    });
  }

  /** Public rooms that can still be joined or watched (waiting rooms must have been active in the last 10 minutes). */
  async listPublic() {
    const rows = (await this.db.query<any>(`SELECT code, name, status, turn_ms, jsonb_array_length(spectators) sp, profiles FROM play_rooms
      WHERE is_public AND (status='playing' AND updated_at > now() - interval '2 hours' OR status IN ('waiting','lobby') AND updated_at > now() - interval '10 minutes')
      ORDER BY (status='waiting') DESC, updated_at DESC LIMIT 30`)).rows;
    const out = [];
    for (const r of rows) { const nm = await this.names(r.profiles); out.push({ code: r.code, name: r.name, host: nm[0], status: r.status, turnSec: Math.round((r.turn_ms ?? TIMING.turnMs) / 1000), spectators: r.sp, spectatorMax: ROOM.spectatorMax, canJoin: r.status === 'waiting', canWatch: r.sp < ROOM.spectatorMax }); }
    return { rooms: out };
  }

  private async names(profiles: (string | null)[] | null | undefined): Promise<(string | null)[]> {
    const ids = [profiles?.[0] ?? null, profiles?.[1] ?? null];
    const rows = ids.some(Boolean) ? (await this.db.query<any>(`SELECT id, name FROM players WHERE id = $1::uuid OR id = $2::uuid`, [ids[0], ids[1]])).rows : [];
    return ids.map(id => (id ? rows.find((r: any) => r.id === id)?.name ?? 'ผู้เล่น' : null));
  }

  private seatOf(tokens: (string | null)[], token: string): 0 | 1 {
    const s = tokens.findIndex(t => t && t === token); if (s < 0) throw new AppError(403, 'โทเค็นห้องไม่ถูกต้อง'); return s as 0 | 1;
  }

  /** Pays both seats (that have profiles) once, when a match ends after enough turns. Mutates meta; call inside the room transaction. */
  private async settle(tx: Tx, code: string, profiles: (string | null)[], g: Game, meta: RoomMeta) {
    if (g.winner === null || meta.rewarded) return;
    meta.rewarded = true;
    if (g.turn >= ECONOMY.minTurnsForReward) meta.rewards = await this.eco.award(tx, profiles ?? [null, null], code);
    await this.record(tx, code, profiles ?? [null, null], g, meta);   // history only: never changes rewards (anti-farming phase 1)
  }

  /** Writes the persistent match record (pvp_matches + pvp_match_players). Runs once per match, inside the settle transaction (guarded by meta.rewarded
   *  and by the primary key on the match id). A failure here must never block the game or the payout, so it is isolated in a savepoint. */
  private async record(tx: Tx, code: string, profiles: (string | null)[], g: Game, meta: RoomMeta) {
    const id = (meta.matchId ??= randomUUID());   // rooms created before this update have no id yet
    try {
      await tx.query(`SAVEPOINT pvp_record`);
      const valid = new Set((await tx.query<any>(`SELECT id FROM players WHERE id = $1::uuid OR id = $2::uuid`, [profiles[0] ?? null, profiles[1] ?? null])).rows.map(r => r.id as string));
      const has = [0, 1].map(s => !!profiles[s] && valid.has(profiles[s]!)), pid = [0, 1].map(s => (has[s] ? profiles[s] : null)), win = g.winner as 0 | 1;
      const reason = meta.endReason === 'left' ? 'surrender' : meta.endReason === 'timeout' ? 'timeout' : meta.endReason === 'absent' ? 'disconnect' : 'normal';
      const paid = (s: number) => meta.rewards?.[s] ?? null;
      const ins = await tx.query<any>(`INSERT INTO pvp_matches(id,room_code,started_at,ended_at,player0_id,player1_id,seat0_profile,seat1_profile,winner_seat,end_reason,forfeit_seat,turns,stats_version,rewards_paid)
        VALUES ($1::uuid,$2,$3::timestamptz,now(),$4::uuid,$5::uuid,$6::boolean,$7::boolean,$8::smallint,$9,$10::smallint,$11::int,$12::smallint,$13::boolean) ON CONFLICT (id) DO NOTHING RETURNING id`,
        [id, code, meta.startedAt ? new Date(meta.startedAt).toISOString() : null, pid[0], pid[1], has[0], has[1], win, reason, reason === 'normal' ? null : meta.forfeit ?? null, g.turn, g.stats ? STATS_VERSION : null, !!meta.rewards?.some(r => r)]);
      if (ins.rows.length) for (const s of [0, 1]) {
        await tx.query(`INSERT INTO pvp_match_players(match_id,seat,player_id,has_profile,is_winner,stats,reward_points,reward_vrcoin) VALUES ($1::uuid,$2::smallint,$3::uuid,$4::boolean,$5::boolean,$6::jsonb,$7::int,$8::int)`,
          [id, s, pid[s], has[s], win === s, g.stats ? JSON.stringify(g.stats[s as 0 | 1]) : null, paid(s)?.points ?? 0, paid(s)?.vrcoin ?? 0]);
      }
      await tx.query(`RELEASE SAVEPOINT pvp_record`);
      meta.historyRecorded = true;
    } catch (e) {
      console.error('pvp match history not recorded', e);
      meta.historyRecorded = false; meta.historyError = String((e as any)?.message ?? e).slice(0, 200);   // traceable: play_rooms.meta ->> 'historyRecorded' = 'false' (see docs/PVP-ANTI-FARMING.md)
      try { await tx.query(`ROLLBACK TO SAVEPOINT pvp_record`); await tx.query(`RELEASE SAVEPOINT pvp_record`); } catch { /* transaction already unusable: let the caller see it */ }
    }
  }

  private shape(row: any, seat: 0 | 1, now: number, full: boolean, spectator = false) {
    const meta = (row.meta ?? {}) as RoomMeta, base: any = { status: row.status, seat, version: row.version, serverNow: now, deadline: meta.deadline ?? null };
    if (spectator) base.spectator = true;
    if (row.status === 'finished') { base.endReason = meta.endReason ?? null; base.forfeitedYou = spectator || meta.forfeit === undefined || meta.forfeit === null ? null : meta.forfeit === seat; base.reward = spectator ? null : meta.rewards?.[seat] ?? null; }
    return full ? { ...base, game: spectator ? viewSpectator(row.state as Game) : viewFor(row.state as Game, seat) } : { ...base, unchanged: true };
  }

  /** What everyone in a not-yet-started room sees (waiting / lobby). */
  private async lobbyShape(code: string, row: any, who: { seat?: 0 | 1; spectator?: boolean }, now: number) {
    const nm = await this.names(row.profiles), meta = (row.meta ?? {}) as any, here = (s: 0 | 1) => !!meta.seen?.[s] && now - meta.seen[s] < ROOM.lobbyPresenceMs;
    return { status: row.status, seat: who.seat ?? 0, version: row.version, spectator: !!who.spectator, serverNow: now,
      room: { code, name: row.name ?? null, isPublic: !!row.is_public, turnSec: Math.round((row.turn_ms ?? TIMING.turnMs) / 1000), ready: row.ready ?? [false, false],
        players: [{ name: nm[0] ?? 'ผู้เล่น', here: here(0) }, row.tokens?.[1] ? { name: nm[1] ?? 'ผู้เล่น', here: here(1) } : null],
        spectators: (row.spectators ?? []).length, spectatorMax: ROOM.spectatorMax } };
  }

  /** Lobby presence: stamps `seen` for the caller (at most every few seconds) and sends a guest who vanished back out of the lobby. */
  private async touch(code: string, seat: 0 | 1, now: number) {
    return this.db.transaction(async (tx: Tx) => {
      const row = (await tx.query(`SELECT status, tokens, decks, profiles, meta, version, ready, name, is_public, turn_ms, spectators FROM play_rooms WHERE code=$1 FOR UPDATE`, [code])).rows[0];
      if (!row || (row.status !== 'waiting' && row.status !== 'lobby')) return row;
      const meta = (row.meta ?? {}) as any; meta.seen = [meta.seen?.[0] ?? null, meta.seen?.[1] ?? null]; meta.seen[seat] = now;
      let { tokens, decks, profiles, status, version, ready } = row;
      if (status === 'lobby' && meta.seen[1] && now - meta.seen[1] > TIMING.absentMs) {   // the guest left without telling us
        (meta.kicked ??= []).push(tokens[1]); meta.seen[1] = null; tokens = [tokens[0], null]; decks = [decks?.[0] ?? null, null]; profiles = [profiles?.[0] ?? null, null]; status = 'waiting'; ready = [false, false]; version += 1;
      }
      if (status === 'lobby' && meta.seen[0] && now - meta.seen[0] > TIMING.absentMs) { await tx.query(`DELETE FROM play_rooms WHERE code=$1`, [code]); return undefined; }   // the host left
      await tx.query(`UPDATE play_rooms SET status=$2, tokens=$3::jsonb, decks=$4::jsonb, profiles=$5::jsonb, ready=$6::jsonb, meta=$7::jsonb, version=$8, updated_at=now() WHERE code=$1`,
        [code, status, JSON.stringify(tokens), JSON.stringify(decks), JSON.stringify(profiles), JSON.stringify(ready), JSON.stringify(meta), version]);
      return { ...row, status, tokens, decks, profiles, ready, meta, version };
    });
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
    let row = (await this.db.query<any>(`SELECT status, tokens, state, version, meta, profiles, ready, name, is_public, turn_ms, spectators FROM play_rooms WHERE code=$1`, [code])).rows[0];
    if (!row) throw new AppError(404, 'ไม่พบห้องนี้');
    const now = Date.now(), seatIdx = (row.tokens as (string | null)[]).findIndex(t => t && t === token);
    if (seatIdx < 0) {
      if ((row.spectators ?? []).includes(token)) {                                   // spectator: read-only
        if (row.status === 'waiting' || row.status === 'lobby') return this.lobbyShape(code, row, { spectator: true }, now);
        return this.shape(row, 0, now, since !== row.version, true);
      }
      if (((row.meta as any)?.kicked ?? []).includes(token)) return { status: 'kicked', seat: 0, version: row.version };
      throw new AppError(403, 'โทเค็นห้องไม่ถูกต้อง');
    }
    const seat = seatIdx as 0 | 1;
    if (row.status === 'waiting' || row.status === 'lobby') {
      const seen = (row.meta as any)?.seen?.[seat];
      if (!seen || now - seen > ROOM.lobbyPresenceMs / 3) { const t = await this.touch(code, seat, now); if (!t) throw new AppError(404, 'ห้องนี้ถูกปิดแล้ว'); row = { ...row, ...t }; }
      return this.lobbyShape(code, row, { seat }, now);
    }
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
      meta.misses[seat] = 0; meta.deadline = g.winner !== null ? null : now + turnLen(meta); version += 1;
      await save(g.winner !== null ? 'finished' : 'playing');
      return { ok: true, version };
    });
  }

  /** Leaving a running game = resigning. Waiting room: the host closes it. Lobby: the guest steps out (room goes back to waiting), the host closes it. Spectator: just leaves. */
  async leave(code: string, token: string) {
    code = code.toUpperCase();
    return this.db.transaction(async (tx: Tx) => {
      const row = (await tx.query(`SELECT status, tokens, decks, profiles, state, version, meta, spectators FROM play_rooms WHERE code=$1 FOR UPDATE`, [code])).rows[0];
      if (!row) throw new AppError(404, 'ไม่พบห้องนี้');
      const sp = (row.spectators ?? []) as string[], si = sp.indexOf(token);
      if (si >= 0 && !row.tokens.includes(token)) { sp.splice(si, 1); await tx.query(`UPDATE play_rooms SET spectators=$2::jsonb, version=version+1 WHERE code=$1`, [code, JSON.stringify(sp)]); return { ok: true }; }
      const seat = this.seatOf(row.tokens, token);
      if (row.status === 'waiting' || (row.status === 'lobby' && seat === 0)) { await tx.query(`DELETE FROM play_rooms WHERE code=$1`, [code]); return { ok: true }; }
      if (row.status === 'lobby') {
        const meta = (row.meta ?? {}) as any; meta.seen = [meta.seen?.[0] ?? null, null];
        await tx.query(`UPDATE play_rooms SET status='waiting', tokens=$2::jsonb, decks=$3::jsonb, profiles=$4::jsonb, ready='[false,false]'::jsonb, meta=$5::jsonb, version=version+1, updated_at=now() WHERE code=$1`,
          [code, JSON.stringify([row.tokens[0], null]), JSON.stringify([row.decks?.[0] ?? null, null]), JSON.stringify([row.profiles?.[0] ?? null, null]), JSON.stringify(meta)]);
        return { ok: true };
      }
      if (row.status === 'playing') {
        const g = row.state as Game, meta = row.meta as RoomMeta; forfeit(g, seat, 'left', meta);
        await this.settle(tx, code, (await tx.query(`SELECT profiles FROM play_rooms WHERE code=$1`, [code])).rows[0].profiles, g, meta);
        await tx.query(`UPDATE play_rooms SET state=$2::jsonb, meta=$3::jsonb, status='finished', version=$4, updated_at=now() WHERE code=$1`, [code, JSON.stringify(g), JSON.stringify(meta), row.version + 1]);
      }
      return { ok: true };
    });
  }
}
