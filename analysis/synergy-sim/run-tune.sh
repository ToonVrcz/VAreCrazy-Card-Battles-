#!/bin/bash
# Grid over the role-DEF lever (a = ATK<=20 tier, b = ATK 21-30 tier) with Game Synergy B7 ON. Sim only.
cd "$(dirname "$0")"; N=${N:-30}; SYN=${SYN:-B7}
cfgs=(); for a in 0 4 8 12; do for b in 0 3 6 9; do cfgs+=("$a,$b"); done; done
run() { for c in "$@"; do TUNE=$c N=$N SYN=$SYN TAG=tune-${SYN}-${c/,/_} npx tsx run.ts; done; }
run "${cfgs[@]:0:8}" > out/tune1.log 2>&1 &
run "${cfgs[@]:8:8}" > out/tune2.log 2>&1 &
wait
