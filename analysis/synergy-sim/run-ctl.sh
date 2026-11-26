#!/bin/bash
# (1) game-length lever: starting LP with DEF-by-role 12/10; (2) Control kit (CTL=on). Free cards only, Game Synergy B7 ON. Sim only.
cd "$(dirname "$0")"; N=${N:-30}
r() { env "$@" N=$N SYN=B7 TIER=starter npx tsx run.ts; }
( for lp in 80 60 50; do r TUNE=12,10 LP=$lp TAG=len-12_10-lp$lp; done ) > out/len.log 2>&1 &
( r CTL=on TAG=ctl-notune-lp100; r CTL=on TUNE=12,10 TAG=ctl-12_10-lp100; r CTL=on TUNE=12,10 LP=80 TAG=ctl-12_10-lp80 ) > out/ctl.log 2>&1 &
wait
