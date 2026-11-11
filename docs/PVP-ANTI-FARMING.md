# PvP Anti-Farming — Phase 1: data collection

**Status: data collection only. Anti-farming is NOT active.** Rewards are paid exactly as before
(`src/server/economy.ts` → `Economy.award`, 200 points per finished match of at least 6 turns to every seat that has a profile,
+10 Vrcoin on every 10th rewarded match). Phase 1 only *records* what happened so later phases can be tuned with real data.

No pair limit, no Match Quality threshold, no reward denial, no IP / device fingerprint collection.

## 1. What Phase 1 adds

| Piece | Where |
|---|---|
| Per-player action counters in the engine | `src/engine/game.ts` (`PlayerStats`, `Game.stats`, `STATS_VERSION`) |
| Counters hidden from clients | `src/engine/deck-view.ts` → `viewFor` deletes `stats` |
| Match id + start time stored in the room | `src/server/rooms.ts` → `join` (`play_rooms.meta.matchId`, `meta.startedAt`; type in `src/engine/turn-timer.ts`) |
| Persistent match history | migration `db/migrations/014_pvp_match_history.{up,down}.sql` |
| Recording inside the settlement transaction | `src/server/rooms.ts` → `settle` → `record` |
| Tests | `tests/pvp-stats.test.ts` (engine), `tests/pvp-history.test.ts` (rooms + migration) |

## 2. Statistics definitions (`PlayerStats`, `STATS_VERSION = 1`)

Counted per seat, only when a server-validated action **succeeded and changed the game state**. Failed / invalid requests throw
`EngineError` before any state is returned, so they can never be counted. `pass` and `next` are never counted, including the ones the
turn timer sends automatically (`autoEndTurn`). The game log text is never used. Counters live in the game state (`play_rooms.state.stats`),
are updated on the server's own copy of the game, and are removed from every client view.

| Counter | Meaning |
|---|---|
| `summon` | Lv.15 character summoned |
| `evolve` | Evolution performed (also when a trap cancels it: the cards were spent) |
| `fuse` | Fusion performed |
| `set` | Trap set face-down |
| `cast` | Spell cast |
| `attack` | Attack declared (unit or direct). An attack cancelled by a trap still counts |
| `attackDirect` | Subset of `attack` aimed at the player |
| `trap` | One of this player's face-down traps actually fired (a `pass` on a chain window does not count) |
| `dmgUnit` | Unit HP actually removed (clamped to the HP the unit had) by this player's attacks, spells, counter-attacks and trap reflections |
| `dmgLp` | LP actually removed from the opponent (clamped to the LP left) |
| `dmgDelayed` | Unit HP removed by this player's lingering effects: poison ticks and turn-start / turn-end traps. Kept apart because it needs no further action from the player |
| `activeTurns` | Own turns in which at least one of summon / evolve / fuse / set / cast / attack succeeded (a turn counts once however many actions it has) |
| `lastActiveTurn` | Bookkeeping for `activeTurns` (the `g.turn` of the last counted turn) |

A chain window (`pending`) counts nothing until it is resolved; the original action is then replayed once and counted once.

Changing the meaning of a counter requires bumping `STATS_VERSION`.

## 3. Migration 014 — `pvp_match_history`

Additive and reversible. `down` drops the two new tables only (player balances, the ledger and rooms are untouched).

**`pvp_matches`** — one row per finished match
`id uuid PK` (generated when the match starts, so a match can be recorded only once) · `room_code` (informational, not unique: codes are reused) ·
`started_at` (NULL for rooms started before the update) · `ended_at` · `player0_id` / `player1_id` (seat 0 = creator, seat 1 = joiner; NULL = guest seat) ·
`seat0_profile` / `seat1_profile` / `both_profiles` (generated) · `winner_seat` · `end_reason` (`normal` | `surrender` | `timeout` | `disconnect`) ·
`forfeit_seat` (the seat that surrendered / timed out / disconnected; NULL for a normal win) · `turns` (`Game.turn` at the end, both players' turns) ·
`stats_version` (NULL = room predates statistics) · `rewards_paid` (informational: current rules paid this match) ·
reserved and unused in Phase 1: `quality_score`, `quality_passed`, `quality_rules`, `evaluated_at`.

**`pvp_match_players`** — two rows per match, PK `(match_id, seat)`
`player_id` · `has_profile` · `is_winner` · `stats` (the seat's `PlayerStats` JSON, NULL for old rooms) · `reward_points` / `reward_vrcoin`
(what the current rules actually paid) · reserved: `participation_score`.

End reasons come from the existing `play_rooms.meta.endReason`: `left` → `surrender`, `timeout` → `timeout`, `absent` → `disconnect`, none → `normal`.
Rows are not linked to `play_rooms`, so they survive the daily room purge. **Retention:** nothing deletes history (at least 90 days is required);
any pruning job needs a separate decision. Deleting a player keeps the match (the id becomes NULL; `has_profile` keeps the fact).
RLS is enabled (no policies), like the other economy tables.

## 4. Settlement behaviour

`Rooms.settle` runs inside the room's row-locked transaction. It is unchanged except that, after the payout, it calls `record`:
the guard `meta.rewarded` runs the settlement once, and `INSERT … ON CONFLICT (id) DO NOTHING` on the match id makes a repeated call harmless.
`record` runs inside a `SAVEPOINT`: if the history cannot be written (for example migration 014 is not applied yet) the whole partial write is rolled
back to the savepoint (no orphan rows), the error is logged (`pvp match history not recorded`), and the game still finishes and pays as before —
history is lost for that match, gameplay and payouts are not. The failure is traceable: the room's `meta.historyRecorded` is `true` on success and
`false` (with a short `meta.historyError`) on failure. Rooms are purged after one day, so also use the ledger query below, which does not expire.

Compatibility: rooms started before this update have no `stats`, `matchId` or `startedAt`. They keep working; the id is created when the match is
settled and the record has `stats_version = NULL`, `started_at = NULL` and NULL per-player stats.

## 5. Build and deploy requirements

The engine changed, so the browser bundle and the edge function must be rebuilt (commands are in `CLAUDE.md`):

```bash
npx esbuild src/play-entry.ts --bundle --format=iife --global-name=VCZE --minify --charset=utf8 --outfile=public/engine.js
npx esbuild src/edge/index.ts --bundle --format=esm --platform=node --external:@electric-sql/pglite --external:postgres --minify --charset=utf8 --outfile=/tmp/edge.js && sed -i 's#from"postgres"#from"npm:postgres@3"#g' /tmp/edge.js
```

Deploy order (only when the Project Owner says "Deploy"): apply migration 014 → deploy the edge function → merge to `main`.
Applying the edge function before the migration does not break play, but those matches are not recorded.
Rollback: `014_pvp_match_history.down.sql` (loses the collected history), or redeploy the previous edge bundle.

### Detecting matches that have no history

```sql
-- paid matches whose history is missing (the ledger is permanent; ended_at and the ledger row share the settle transaction's now())
SELECT l.ref AS room_code, l.created_at, l.player_id
FROM economy_ledger l
WHERE l.kind = 'match'
  AND NOT EXISTS (SELECT 1 FROM pvp_matches m WHERE m.room_code = l.ref AND m.ended_at = l.created_at);
-- any match (paid or not) while the room still exists (rooms live about a day)
SELECT code, meta->>'historyError' FROM play_rooms WHERE status = 'finished' AND meta->>'historyRecorded' = 'false';
```

Unpaid matches (surrender / timeout / disconnect before turn 6, guests) have no ledger row, so only the room query can find them, and only until the room is purged.
Matches settled before the update was deployed have no history at all; treat the deploy time as the start of reliable history.

Useful queries once data exists:

```sql
-- matches involving a guest seat
SELECT id, ended_at, seat0_profile, seat1_profile FROM pvp_matches WHERE NOT both_profiles;
-- distribution of a counter, to choose Match Quality thresholds later
SELECT percentile_cont(ARRAY[0.1,0.25,0.5,0.75,0.9]) WITHIN GROUP (ORDER BY (stats->>'activeTurns')::int)
FROM pvp_match_players WHERE stats IS NOT NULL;
```

## 6. Installing / rolling back migration 014 (not done yet)

Nothing has been applied to Supabase. When the Project Owner says "Deploy": run `db/migrations/014_pvp_match_history.up.sql` on the production database
(the project's migrator is `db/migrate.ts`; on Supabase the SQL is applied as a migration), then deploy the rebuilt edge function, then merge.
Rollback: run `014_pvp_match_history.down.sql` (drops `pvp_match_players` then `pvp_matches`; balances, ledger, players and rooms are untouched, collected history is lost).
Because of the savepoint, an edge function deployed before the migration keeps working; those matches are simply not recorded.

## 7. Limits of Phase 1

- Legacy rooms (started before the update) have no stats, so their history rows have `stats_version = NULL` and NULL per-player stats.
- The history write is verified against PGlite (real Postgres semantics). The `postgres.js` wrapper used by the Supabase edge function was not exercised against a live database.
- Current reward quirks are intentionally preserved and recorded, not fixed: a surrender after turn 6 is still paid, and a profile playing a guest is still paid.

## 8. Order of work for the next phases (each needs Project Owner approval)

1. **Phase 2 — shadow evaluation:** compute Match Quality from the collected stats, store `quality_*` / `participation_score`, compare with the actual payouts, choose thresholds from the observed distribution (no enforcement).
2. **Phase 3 — enforcement:** per-player eligibility (surrender / timeout / disconnect rules, both profiles required), Asia/Bangkok daily pair counter (unordered pair, max 3), unique ledger per (player, match), keep the 6-turn minimum.
3. **Phase 4 — Admin:** editable thresholds and pair limit with validation and before/after audit, reward history and match inspection.
4. **Phase 5 — client messages and deploy:** explain why a reward was not given; update `CLAUDE.md`; deploy in the documented order.

## 9. Approved rules for later phases (NOT active)

- At most 3 qualifying rewarded matches per unordered player pair per Asia/Bangkok calendar day; from the 4th onward neither player gets Points or Vrcoin from that pair that day.
- A player who surrenders gets no reward; when the opponent times out or disconnects, the confirmed winner may be rewarded; the timed-out / disconnected player is not.
- Both players must have valid profiles to qualify for rewards.
- The existing minimum of 6 turns stays as an additional initial condition.
- Match Quality thresholds must be editable by Admin; their values are chosen from the data collected in Phase 1 (no defaults are invented here).
- No IP or device fingerprints are collected.
- 200 points per rewarded match and 10 Vrcoin per 10 rewarded matches stay as they are unless separately approved.
