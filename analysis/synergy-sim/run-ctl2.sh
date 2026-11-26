#!/bin/bash
cd "$(dirname "$0")"; N=${N:-30}
r() { env "$@" N=$N SYN=B7 TIER=starter TUNE=12,10 npx tsx run.ts; }
( r CTL=on CTL_V=2 TAG=ctl2-12_10; ) > out/ctl2.log 2>&1 &
( r CAP=none TAG=cap-none-12_10; r CAP=80 TAG=cap-80-12_10 ) > out/cap.log 2>&1 &
wait
