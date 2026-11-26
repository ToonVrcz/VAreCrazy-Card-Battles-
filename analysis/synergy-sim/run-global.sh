#!/bin/bash
# Real-data-consistent DEF table (sim only): DEF 12/10 tier + Control chains +3 + Tank-only/shared chains +1 (skymoon stays +3), plus Aggro-only chain delta.
cd "$(dirname "$0")"
r() { env "$@" N=60 SYN=B7 TIER=starter TUNE=12,10 npx tsx run.ts; }
CTL="skymoon:3,zeesky:3,lucky:3,lordnam:3,chaem:3,pk:3,thomas:3"; TK="norman:1,oufilling:1,tee:1,thai32:1,lalaping:1,baby:1"; AG() { echo "dnman:$1,mon:$1,pikachu:$1,cutie:$1,melon:$1,linlada:$1"; }
( r DEFADD="$CTL,$TK" TAG=g1 ; r DEFADD="$CTL,$TK,$(AG 2)" TAG=g1-ag2 ) > out/g-a.log 2>&1 &
( r DEFADD="$CTL,$TK,$(AG 1)" TAG=g1-ag1 ; r DEFADD="$CTL,$TK,$(AG 3)" TAG=g1-ag3 ) > out/g-b.log 2>&1 &
wait
