#!/bin/bash
# Control-vs-Tank fix candidates (sim only): DEF 12/10 + Control DEF +3, plus a small Tank Lv15 DEF/ATK delta (Tank deck only). N=60.
cd "$(dirname "$0")"
r() { env "$@" N=60 SYN=B7 TIER=starter TUNE=12,10 npx tsx run.ts; }
( r CDEF=3 TDEF=1 TAG=t4-A3-T1 ; r CDEF=3 TATK=2 TAG=t4-A3-TA2 ) > out/t4a.log 2>&1 &
( r CDEF=3 TDEF=2 TAG=t4-A3-T2 ; r CDEF=2 CATK=1 TDEF=1 TAG=t4-A2B1-T1 ) > out/t4b.log 2>&1 &
wait
