#!/bin/bash
# Refinement: three DEF tiers (a: ATK<=20, b: 21-30, c: >=31) around the best region of the first grid. Game Synergy B7 ON. Sim only.
cd "$(dirname "$0")"; N=${N:-30}; SYN=${SYN:-B7}
cfgs=(); for a in 8 10 12; do for b in 3 6; do for c in 0 4 8; do cfgs+=("$a,$b,$c"); done; done; done
run() { for c in "$@"; do TUNE=$c N=$N SYN=$SYN TAG=tune3-${SYN}-${c//,/_} npx tsx run.ts; done; }
run "${cfgs[@]:0:9}" > out/tune3a.log 2>&1 &
run "${cfgs[@]:9:9}" > out/tune3b.log 2>&1 &
wait
