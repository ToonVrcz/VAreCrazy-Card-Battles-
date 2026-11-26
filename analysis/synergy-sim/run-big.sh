#!/bin/bash
# N=90 follow-up (2700 games per config) for base / B2 (uncapped) / B3 (capped): Starter, Story on.
cd "$(dirname "$0")"
( N=90 SYN=base TAG=big-base npx tsx run.ts > out/big1.log 2>&1; N=90 SYN=B3 TAG=big-B3 npx tsx run.ts >> out/big1.log 2>&1 ) &
( N=90 SYN=B2 TAG=big-B2 npx tsx run.ts > out/big2.log 2>&1 ) & wait
