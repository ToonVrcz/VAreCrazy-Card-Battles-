#!/bin/bash
# Reproduces every table in docs/balance/GAME_SYNERGY_SIMULATION_REPORT_2026-11-26.md (2 parallel queues; ~25 min on 2 cores).
cd "$(dirname "$0")"; N=${N:-30}
q1() { for s in base B3 B5 B7; do N=$N SYN=$s TIER=starter TAG=starter-story-$s npx tsx run.ts; done
       for s in base B3; do N=$N SYN=$s TIER=starter STORY=off TAG=starter-nostory-$s npx tsx run.ts; done
       for s in base B3; do N=$N SYN=$s TIER=adv TAG=adv-story-$s npx tsx run.ts; done; }
q2() { for s in B2 B4 B6; do N=$N SYN=$s TIER=starter TAG=starter-story-$s npx tsx run.ts; done
       for s in base B3; do N=$N SYN=$s TIER=starter FUSION=off TAG=starter-nofusion-$s npx tsx run.ts; done
       for s in base B3; do N=$N SYN=$s TIER=adv STORY=off TAG=adv-nostory-$s npx tsx run.ts; done; }
q1 > out/q1.log 2>&1 & q2 > out/q2.log 2>&1 & wait
# Optional follow-up with 3x the sample (N=90) for the three decisive configs: ./run-all.sh big
