#!/bin/bash
cd "$(dirname "$0")"; N=${N:-30}
r() { env "$@" N=$N SYN=B7 TIER=starter TUNE=12,10 npx tsx run.ts; }
( r CTL=on CTL_V=3 TAG=ctl3-12_10 ) > out/ctl3.log 2>&1 &
( r DECK=30 TAG=deck30-12_10 ) > out/deck30.log 2>&1 &
wait
