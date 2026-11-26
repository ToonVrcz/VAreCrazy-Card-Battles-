#!/bin/bash
# Finer search around the best DEF-by-role region, FREE (Starter) cards only, Game Synergy B7 ON. Sim only.
cd "$(dirname "$0")"; N=${N:-30}; SYN=${SYN:-B7}
cfgs=(); for a in 10 11 12; do for b in 8 9 10; do cfgs+=("$a,$b"); done; done
run() { for c in "$@"; do TUNE=$c N=$N SYN=$SYN TIER=starter TAG=free-${SYN}-${c/,/_} npx tsx run.ts; done; }
run "${cfgs[@]:0:5}" > out/free1.log 2>&1 &
run "${cfgs[@]:5:4}" > out/free2.log 2>&1 &
wait
