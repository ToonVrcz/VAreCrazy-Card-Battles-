# Playtest release notes (branch `feature/playtest-release`)

Scope approved by the Project Owner: hide character abilities that the engine does not run, a Google Form bug-report link,
"back to lobby" instead of "rematch", resume after refresh. Nothing else changed: no engine, reward, economy or database change.

## What changed (all in `public/play.html`)

| Change | Behaviour |
|---|---|
| Character abilities | The 56 character effects exist only as data/text; the engine does not execute them. The card detail now shows "ความสามารถของตัวละครยังไม่เปิดใช้งานในช่วงทดสอบ" for characters instead of listing the abilities. Spell / trap / evolution / fusion text is unchanged (those work). Effect data in the database and in `engine.js` is untouched, and the Admin card editor still shows it. |
| Game-over button | "เล่นใหม่" is now "กลับหน้าหลัก"; it reloads `/play` (lobby) for both bot and online games. No room is created and no reward is touched. |
| Bug report | `FEEDBACK_URL` (top of the room/feedback block in `play.html`) holds the Google Form link. **It is empty, so the button is hidden** until the Owner supplies the URL. When set, a "🐞 แจ้งปัญหา" link appears in the lobby and in the game bar (opens in a new tab, `noopener`, static URL: no player, room or token data is appended). No backend, table, API or migration. |
| Resume | Creating or joining a room stores `{code, token, seat}` in `localStorage['vcz_room']`. On load (without `?join=`) the page asks the server for that room with the stored token: still `waiting` → waiting screen; `playing` → back in the match; `finished` / gone / wrong token → the entry is dropped and the lobby is shown with a short message. A network error keeps the entry so a retry works. The entry is cleared when the match ends, when the creator cancels a waiting room and by the game-over button. The existing server timers still apply: more than 2 minutes without polling is a forfeit. No server change: the existing room token is the session. |

## How to turn on the bug-report button

Edit one line in `public/play.html`: `const FEEDBACK_URL='https://forms.gle/...';` (the form should ask: in-game name (optional), problem type,
description, room code (optional), device, screenshot (optional)). Then deploy as usual (needs the Owner's "Deploy").

## Browser test (local only)

`node scripts/playtest-e2e.cjs` starts `scripts/playtest-server.ts` (in-memory database, every seed card, same `/play` rewrite as `vercel.json`)
and drives Chromium with Playwright. It never contacts Supabase or Vercel. It checks: lobby not blank, feedback button hidden/shown,
five bot games to the end, the ability notice, "กลับหน้าหลัก", phone-viewport layout (Pixel 5 / iPhone 13 **emulation only**, not real devices or WebKit),
and PvP with two browser contexts (invite link, refresh while waiting, refresh mid-game, surrender, no re-entry of a finished room, stale entry).
Needs the `playwright` package and Chromium (preinstalled in the Claude Code cloud image; not a project dependency). It is not part of `npm test`.

Limits: the bot games are short (a passive human loses within about 5 turns), so they prove the UI loop, not bot strength; the turn timer and
disconnect paths are covered by `tests/online-timers.test.ts`, not by this script.

## Production PvP verification — procedure for the Owner (not run; needs two testers)

Do not create test matches on production from the repository tooling. When two people are available:

1. Two devices open the live game (`/play`), both get a profile; one creates a room, the other joins by link.
2. Play at least 6 turns (end turns is enough) and finish by surrender (or play to the end). Note the room code and the time.
3. Check (read-only SQL in the Supabase SQL editor):

```sql
SELECT id, room_code, ended_at, end_reason, winner_seat, forfeit_seat, turns, both_profiles, rewards_paid FROM pvp_matches ORDER BY ended_at DESC LIMIT 5;
SELECT match_id, seat, is_winner, has_profile, reward_points, reward_vrcoin, stats FROM pvp_match_players WHERE match_id = '<id from the first query>';
SELECT kind, points, vrcoin, ref, created_at FROM economy_ledger WHERE kind = 'match' ORDER BY id DESC LIMIT 4;
```

Expected: exactly 1 `pvp_matches` row for the room, 2 `pvp_match_players` rows, the winner / `end_reason` as played, ledger rows equal to the
current rules (200 points per profile when the match had at least 6 turns), and the "paid matches without history" query in
`docs/PVP-ANTI-FARMING.md` returns nothing. Repeat for timeout (stop polling on one device for 3 turns) and disconnect (close one tab for more than 2 minutes).

## Known limits of this release

- Character abilities are not implemented (they are hidden, not removed). Affiliation / story bonuses are not applied in play.
- Anti-farming is still data collection only (see `docs/PVP-ANTI-FARMING.md`).
- Phone checks so far are emulated viewports. Real Android / iOS devices are still to be tested by a person.
