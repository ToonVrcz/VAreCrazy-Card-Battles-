# Deck-out, Control Stat and DEF Fine-Tuning Simulation — 2026-11-26

Branch `analysis/full-game-balance-game-synergy-2026-11-26`. **Simulation only** — no card data, DB, CMS, engine, rules, merge or deploy.
Pool (strict): free Lv15 characters, SPL-001..010, TRP-001..010, EVO-001, FUS-001. No Lv40/70/99, no Signature 39 (the runner aborts if one appears). Main deck stays 40 cards. Game Synergy variant B7 on (HP only, no ATK). Real Bot vs Bot, 5 archetypes + Random; 30 games per ordered pair (≈300 games/archetype, 95% CI ≈ ±5.7 pt) unless noted N=60 (≈600 games, ≈ ±4 pt). Bands: Aggro 55–65, Tank 40–55, Heal 45–55, Combo 50–60, Control 45–55, Random 45–55.
"Turns" = engine `g.turn`, which counts **both players' turns** (own turns = total ÷ 2).

## 1. Deck-out Root Cause

Rules from the engine: each player draws 1 card at the start of each own turn; drawing from an empty deck loses. Both start with 5 cards (10 total) → 35 draws per player in a 40-card deck, so the natural clock is ≈ 70 total turns (≈ 35 own turns); effect draws bring it forward.

Draw effects in the pool: 9 of 39 Lv15 characters (CHAEM, FOLLOW-YOU, PK: on summon; THOMAS and MON: on summon with discard-1 cost; GOD-WA, JAOJAY, NONG-TAENGMO: on attack once per turn; WENDYWENDIE: on attack with discard-1) and spell SPL-005 (draw 2). No trap draws.
```
Lv15 characters with a Draw effect (9/39):
  CHAEM-015 chaem [{"trigger":"on_summon","amount":1,"limit":"game"}]
  FOLLOW-YOU-015 follow-you [{"trigger":"on_summon","amount":1,"limit":"game"}]
  GOD-WA-015 god-wa [{"trigger":"on_attack","amount":1,"limit":"turn"}]
  JAOJAY-015 jaojay [{"trigger":"on_attack","amount":1,"limit":"turn"}]
  MON-015 mon [{"trigger":"on_summon","amount":1,"limit":"game","cost":"discard1"}]
  NONG-TAENGMO-015 nong-taengmo [{"trigger":"on_attack","amount":1,"limit":"turn"}]
  PK-015 pk [{"trigger":"on_summon","amount":1,"limit":"game"}]
  THOMAS-015 thomas [{"trigger":"on_summon","amount":1,"limit":"game","cost":"discard1"}]
  WENDYWENDIE-015 wendywendie [{"trigger":"on_attack","amount":1,"limit":"turn","cost":"discard1"}]
Spells/traps in the basic pool that draw:
  SPL-005 จั่วปริศนา
```

#### No DEF change (current cards)
| Archetype | Deck-out % | LP % | Avg total turns | Own turns/player | Avg turn at deck-out | Effect draws/game (both players) | No-progress turns % | Games with ≥6-turn gap % |
|---|---|---|---|---|---|---|---|---|
| Aggro | 1.3 | 98.7 | 19.1 | 9.5 | 48 | 6.86 | 28.2 | 0.3 |
| Tank | 3 | 97 | 27.7 | 13.9 | 55.2 | 6.13 | 24.7 | 0.7 |
| Heal | 4 | 96 | 26.7 | 13.3 | 54.5 | 7.38 | 22.2 | 0.7 |
| Combo | 2.3 | 97.7 | 22.7 | 11.4 | 45.4 | 8.62 | 26.5 | 1.3 |
| Control | 4.7 | 95.3 | 27.5 | 13.8 | 52.6 | 7.57 | 23.9 | 2 |
| Random | 5.3 | 94.7 | 25.2 | 12.6 | 52.3 | 6.66 | 23.7 | 0.3 |

| row win% vs → | Aggro | Tank | Heal | Combo | Control | Random | overall |
|---|---|---|---|---|---|---|---|
| Aggro | – | 100 | 95 | 83.3 | 96.7 | 75 | 90 |
| Tank | 0 | – | 3.3 | 8.3 | 33.3 | 8.3 | 10.6 |
| Heal | 5 | 96.7 | – | 28.3 | 81.7 | 28.3 | 48 |
| Combo | 16.7 | 91.7 | 71.7 | – | 68.3 | 43.3 | 58.3 |
| Control | 3.3 | 66.7 | 18.3 | 31.7 | – | 21.7 | 28.3 |
| Random | 25 | 91.7 | 71.7 | 56.7 | 78.3 | – | 64.7 |



(row above = current cards, before any DEF change: games end by LP, 94–99%.)

Findings (DEF 12/10, N=60 table in §2/§4):
- Deck-out share: Tank 61%, Heal 63%, Control 57%, Random 48%, Combo 24%, Aggro 7%. With current DEF (no change) it is only 1–5% everywhere — **deck-out appears only after the DEF increase**.
- Cause: after the DEF lever, hits become small (damage = ATK − DEF, min 1), so units survive and LP erodes slowly; games run to the natural draw clock. Average end turn at deck-out is ≈ 60 total (≈ 30 own turns).
- Effect draws are not the cause: ≈ 4 cards/game in Tank, ≈ 6 in Heal (both players together, approximate: cards drained minus one per turn); they only pull the clock forward by about 2–3 own turns. Combo draws most (≈ 11.5) and ends earliest by deck-out.
- Stalling is not the cause either: turns with no damage/destroy event are only 9–14% for Tank/Heal (current cards: 22–28%), and games with a ≥6-turn gap without progress are ≤0.7%. The game is slow-but-moving, not stuck.
- LP depletion vs deck-out: Tank 38/61, Heal 37/63, Control 43/57 (LP/deck). This is why LP 80/60/50 and the direct-attack cap did not shorten games (earlier addendum).

Interpretation: the game is long because per-turn damage collapsed, not because of draw or stalling. Shortening needs more damage per turn (smaller DEF, or a damage floor/other damage source), not rules around LP, draw, or deck size.

## 2. Control Stat Simulation

Sim-only, in memory: the 7 Control Lv15 characters are cloned inside the Control deck only (other decks, Random and real card data untouched). DEF-by-role 12/10 is applied to everyone first, then the Control delta. HP never changes. Before/after per card (ATK/DEF; "tier" = after DEF 12/10):
```
Control Lv15 (raw seed ATK/DEF; DEF12/10 tier bonus: ATK<=20 +12, 21-30 +10):
  SKYMOON-015 HP 100 ATK 18 DEF 3 | with tier DEF: 15 | D: 18/15  A+3: 18/18  A+6: 18/21  B+5: 23/15  B+10: 28/15  C+3/+5: 23/18  C+6/+10: 28/21
  ZEESKY-015 HP 78 ATK 23 DEF 3 | with tier DEF: 13 | D: 23/13  A+3: 23/16  A+6: 23/19  B+5: 28/13  B+10: 33/13  C+3/+5: 28/16  C+6/+10: 33/19
  LUCKY-015 HP 76 ATK 24 DEF 3 | with tier DEF: 13 | D: 24/13  A+3: 24/16  A+6: 24/19  B+5: 29/13  B+10: 34/13  C+3/+5: 29/16  C+6/+10: 34/19
  LORDNAM-015 HP 85 ATK 25 DEF 2 | with tier DEF: 12 | D: 25/12  A+3: 25/15  A+6: 25/18  B+5: 30/12  B+10: 35/12  C+3/+5: 30/15  C+6/+10: 35/18
  CHAEM-015 HP 85 ATK 24 DEF 2 | with tier DEF: 12 | D: 24/12  A+3: 24/15  A+6: 24/18  B+5: 29/12  B+10: 34/12  C+3/+5: 29/15  C+6/+10: 34/18
  PK-015 HP 85 ATK 25 DEF 2 | with tier DEF: 12 | D: 25/12  A+3: 25/15  A+6: 25/18  B+5: 30/12  B+10: 35/12  C+3/+5: 30/15  C+6/+10: 35/18
  THOMAS-015 HP 95 ATK 25 DEF 2 | with tier DEF: 12 | D: 25/12  A+3: 25/15  A+6: 25/18  B+5: 30/12  B+10: 35/12  C+3/+5: 30/15  C+6/+10: 35/18
```

Results (30 games/pair unless noted):

| Group | Control change | Aggro | Tank | Heal | Combo | Control | Random | In band |
|---|---|---|---|---|---|---|---|---|
| D (control set) | none | 59.0 | 53.7 | 46.3 | 62.7 | 22.7 | 55.0 | 4/6 |
| A DEF only | +2 DEF | 55.7 | 43.7 | 44.0 | 59.0 | 44.0 | 53.0 | 4/6 |
| A DEF only | +3 DEF | 55.4 | 40.7 | 41.3 | 59.0 | 50.6 | 52.3 | 5/6 |
| A DEF only | +4 DEF | 52.0 | 40.7 | 38.7 | 56.7 | 59.7 | 51.7 | 3/6 |
| A DEF only | +6 DEF | 49.4 | 38.7 | 36.7 | 55.3 | 69.0 | 50.3 | 2/6 |
| B ATK only | +2 ATK | 54.4 | 51.3 | 42.0 | 59.0 | 40.0 | 52.7 | 3/6 |
| B ATK only | +3 ATK | 53.0 | 48.7 | 42.7 | 56.3 | 48.0 | 50.7 | 4/6 |
| B ATK only | +5 ATK | 51.4 | 42.3 | 36.7 | 54.0 | 69.3 | 45.7 | 3/6 |
| B ATK only | +10 ATK | 47.0 | 34.3 | 32.3 | 50.7 | 93.7 | 41.3 | 1/6 |
| C both | +2 ATK/+2 DEF | 52.0 | 43.7 | 39.3 | 54.7 | 58.0 | 51.7 | 3/6 |
| C both | +3 DEF/+5 ATK | 47.7 | 34.7 | 33.7 | 51.3 | 89.7 | 42.3 | 1/6 |
| C both | +6 DEF/+10 ATK | 45.7 | 34.3 | 32.0 | 49.3 | 98.7 | 39.3 | 0/6 |

Confirmation at N=60 (≈600 games/archetype):

| Group | Aggro | Tank | Heal | Combo | Control | Random | In band |
|---|---|---|---|---|---|---|---|
| D | 57.3 | 53.5 | 50.7 | 64.2 | 23.8 | 50.2 | 4/6 (Combo 64.2 over the 60 cap, Control under) |
| A +3 DEF | 53.5 | 39.1 | 46.2 | 59.5 | 53.8 | 47.5 | 4/6 (Aggro −1.5 and Tank −0.9 just below band) |

Findings:
- Control is extremely sensitive: each +1 DEF ≈ +6–7 pt, each +1 ATK ≈ +4–5 pt. Group A (DEF) is the cleaner lever; B/C overshoot quickly (Control 90–99%, i.e. far too strong, and it drags every other archetype down). Group C is not recommended at any tested size.
- Sweet spot is between A +2 (44%) and A +3 (51–54%). A +3 DEF is in band overall but is a hard counter to Tank (Control beats Tank 75% at N=60; Tank beats Control only 25%).
- Control is not too strong against others at A +3: it is ≤ 53% against Aggro/Combo/Heal and loses to Random (44%); only Tank is a problem match-up.
- With Control no longer feeding Tank/Heal free wins (D: Control lost 96.7% to Tank), Tank falls from ~53.5 to ~39 — the gain for Control comes mostly out of Tank.

## 3. DEF Fine-Tuning (comparison sets only — nothing approved)

All with Control unchanged, N=30.

| DEF by ATK tier (≤20 / 21–30) | Aggro | Tank | Heal | Combo | Control | Random | In band | Tank turns | Aggro turns |
|---|---|---|---|---|---|---|---|---|---|
| 0 / 0 (current) | 90.0 | 10.6 | 48.0 | 58.3 | 28.3 | 64.7 | 2/6 | 27.7 | 19.1 |
| 10 / 8 | 70.7 | 45.3 | 44.0 | 60.3 | 19.3 | 60.3 | 1/6 | 48.1 | 24.8 |
| 11 / 9 | 65.6 | 51.3 | 43.7 | 63.4 | 19.3 | 56.7 | 1/6 | 51.1 | 25.5 |
| 12 / 9 | 62.3 | 60.7 | 43.0 | 57.7 | 19.7 | 56.0 | 2/6 | 54.0 | 26.4 |
| **12 / 10** | 59.0 | 53.7 | 46.3 | 62.7 | 22.7 | 55.0 | 4/6 | 54.8 | 27.0 |
| 13 / 11 | 48.0 | 56.0 | 50.3 | 63.3 | 23.7 | 57.3 | 1/6 | 61.6 | 27.8 |

12/10 remains the best of the sets tried for the five non-Control archetypes; adding Control A +3 brings in-band to 5/6 (N=30) / 4/6 (N=60, two misses by ≈1 pt). Larger DEF always lengthens games (Tank 28 → 55 total turns).

## 4. Full Archetype Matchup Matrix

#### DEF 12/10, Control unchanged (D, N=60)
| Archetype | Deck-out % | LP % | Avg total turns | Own turns/player | Avg turn at deck-out | Effect draws/game (both players) | No-progress turns % | Games with ≥6-turn gap % |
|---|---|---|---|---|---|---|---|---|
| Aggro | 7 | 93 | 27.6 | 13.8 | 54.3 | 8.23 | 18.3 | 0.2 |
| Tank | 61.2 | 38.5 | 52.8 | 26.4 | 61.5 | 4.04 | 10.6 | 0.2 |
| Heal | 63 | 36.7 | 50.5 | 25.3 | 60.5 | 5.7 | 9.2 | 0 |
| Combo | 24.3 | 75.7 | 34.3 | 17.1 | 51.6 | 11.55 | 16 | 0.7 |
| Control | 57.2 | 42.8 | 44.9 | 22.5 | 55.8 | 10.65 | 13.9 | 0.5 |
| Random | 48 | 52 | 42 | 21 | 56.2 | 9.32 | 12.6 | 0.2 |

| row win% vs → | Aggro | Tank | Heal | Combo | Control | Random | overall |
|---|---|---|---|---|---|---|---|
| Aggro | – | 54.2 | 53.3 | 51.7 | 71.7 | 55.8 | 57.3 |
| Tank | 45.8 | – | 50.8 | 23.3 | 96.7 | 50.8 | 53.5 |
| Heal | 46.7 | 47.5 | – | 37.5 | 72.5 | 49.2 | 50.7 |
| Combo | 48.3 | 76.7 | 62.5 | – | 70.8 | 62.5 | 64.2 |
| Control | 28.3 | 3.3 | 27.5 | 29.2 | – | 30.8 | 23.8 |
| Random | 44.2 | 49.2 | 50.8 | 37.5 | 69.2 | – | 50.2 |


#### DEF 12/10 + Control DEF +3 (A+3, N=60)
| Archetype | Deck-out % | LP % | Avg total turns | Own turns/player | Avg turn at deck-out | Effect draws/game (both players) | No-progress turns % | Games with ≥6-turn gap % |
|---|---|---|---|---|---|---|---|---|
| Aggro | 7.3 | 92.7 | 27.7 | 13.9 | 54.4 | 8.29 | 17.9 | 0.2 |
| Tank | 60.8 | 38.8 | 54.5 | 27.3 | 64.3 | 2.37 | 14 | 0.3 |
| Heal | 65.2 | 34.5 | 51.1 | 25.5 | 60.5 | 5.88 | 9.8 | 0 |
| Combo | 29.7 | 70.3 | 35.7 | 17.8 | 51.9 | 11.64 | 15.6 | 0.5 |
| Control | 70.2 | 29.8 | 50 | 25 | 58.2 | 9.41 | 17.9 | 0.5 |
| Random | 53.5 | 46.5 | 43.3 | 21.6 | 56.2 | 9.41 | 13 | 0.2 |

| row win% vs → | Aggro | Tank | Heal | Combo | Control | Random | overall |
|---|---|---|---|---|---|---|---|
| Aggro | – | 54.2 | 53.3 | 51.7 | 52.5 | 55.8 | 53.5 |
| Tank | 45.8 | – | 50.8 | 23.3 | 25 | 50.8 | 39.1 |
| Heal | 46.7 | 47.5 | – | 37.5 | 50 | 49.2 | 46.2 |
| Combo | 48.3 | 76.7 | 62.5 | – | 47.5 | 62.5 | 59.5 |
| Control | 47.5 | 75 | 50 | 52.5 | – | 44.2 | 53.8 |
| Random | 44.2 | 49.2 | 50.8 | 37.5 | 55.8 | – | 47.5 |




## 5. Game Length and Turns

Total turns (both players), N=60: current cards Aggro 19 / Tank 28; DEF 12/10: Aggro 27.6 / Tank 52.8 / Heal 50.5 / Control 44.9 / Random 42.0 / Combo 34.3; with Control A +3 Control rises to ≈ 50 (deck-out 70% of its games). Own turns per player: 14 (Aggro) to 27 (Tank). DEF 12/10 roughly doubles game length. Deck-out occurs at about turn 60 (≈ 30 own turns). Tested and ruled out as shortening levers: starting LP 80/60/50, direct-attack cap, Control draw cards (they speed up your own deck-out).

## 6. Recommendations (pros / cons)

1. **DEF 12/10 by ATK tier + Control Lv15 DEF +3 (+2.5 target)** — Pros: only 7 DEF values change for Control plus the tier lever; 4–5 of 6 archetypes in band; Control in band without raising its ATK. Cons: games ≈ 2× longer; Control hard-counters Tank (75%); Tank sits ≈ 39–40; this is a real card-data change (needs owner approval), not yet decided.
2. **Control +2 DEF with a small extra for the weakest cards** (finer than integer steps) — Pros: stays under Tank's counter; Cons: Control 44% (just below band); needs another round of testing.
3. **Accept longer games and keep 40-card decks** — consistent with the deck-size freeze. Cons: ~30 own turns per game for Tank/Heal mirrors; most of those end by deck-out.
4. **Not recommended:** ATK increases for Control (B/C), LP or direct-cap changes, extra Control draw cards.

Open points for the owner: (a) whether any DEF change to real Lv15 cards is acceptable; (b) accept ≈ 2× game length; (c) Tank vs Control match-up; (d) a later damage-floor / damage-source change would shorten games more than any value change, but is a rule change and was not tested here.

Caveats: Bot-vs-Bot only (a real-player test is still required); one hand-built deck recipe per archetype; 30-game pairs have ≈ ±5.7 pt error; "effect draws" is approximate (cards drained minus one per turn).

Reproduce: `analysis/synergy-sim/run-t123.sh`, `run-t2b.sh`, `inventory.ts`, `report.py`; env `TUNE`, `CDEF`, `CATK`, `N`; outputs in `analysis/synergy-sim/out/`.
