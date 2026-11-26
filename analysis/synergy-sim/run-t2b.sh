#!/bin/bash
# Task 2 refinement around the Control sweet spot (sim only). Base: DEF 12/10 tier lever + Game Synergy B7.
cd "$(dirname "$0")"; N=${N:-30}
r() { env "$@" N=$N SYN=B7 TIER=starter TUNE=12,10 npx tsx run.ts; }
( r CDEF=2 TAG=t2-A2 ; r CDEF=4 TAG=t2-A4 ; r CATK=2 TAG=t2-B2 ) > out/t2b-a.log 2>&1 &
( r CATK=3 TAG=t2-B3 ; r CDEF=2 CATK=2 TAG=t2-C2_2 ; r CDEF=3 N=60 TAG=t2-A3-n60 ) > out/t2b-b.log 2>&1 &
wait
