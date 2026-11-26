#!/bin/bash
# TASKS 1-3 (sim only). Free Lv15 + SPL/TRP 001-010 + EVO-001/FUS-001 only. Game Synergy B7. 30 games per ordered pair.
cd "$(dirname "$0")"; N=${N:-30}
r() { env "$@" N=$N SYN=B7 TIER=starter npx tsx run.ts; }
( r TAG=t1-def0 ; r TUNE=12,10 TAG=t2-D ; r TUNE=12,10 CDEF=3 TAG=t2-A3 ; r TUNE=12,10 CDEF=6 TAG=t2-A6 ; r TUNE=12,10 CDEF=3 CATK=5 TAG=t2-C3_5 ; r TUNE=12,10 CDEF=6 CATK=10 TAG=t2-C6_10 ) > out/t123a.log 2>&1 &
( r TUNE=12,10 CATK=5 TAG=t2-B5 ; r TUNE=12,10 CATK=10 TAG=t2-B10 ; r TUNE=10,8 TAG=t3-10_8 ; r TUNE=11,9 TAG=t3-11_9 ; r TUNE=12,9 TAG=t3-12_9 ; r TUNE=13,11 TAG=t3-13_11 ) > out/t123b.log 2>&1 &
wait
