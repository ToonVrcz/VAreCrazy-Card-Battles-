-- Lv15 DEF rebalance (owner-approved in principle 2026-11-26; simulation result, see docs/balance/DECKOUT_CONTROL_DEF_SIMULATION_2026-11-26.md).
-- Only DEF of the 39 free Lv15 characters changes. HP, ATK, Lv40/70/99, Signature cards and all effects are NOT touched.
-- DEF = old + tier bonus (ATK<=20: +12, 21..30: +10, >30: 0) + chain delta (Control +3, Tank/shared +1, Aggro +2).
-- Every statement is guarded by the OLD value, so anything edited in Admin since is never overwritten.
-- NOT APPLIED to production. Apply only when the owner says "Deploy".
UPDATE cards SET def=15 WHERE character_id='1GOKU-015' AND def=3;   -- ATK 20: tier +12, chain +0
UPDATE cards SET def=18 WHERE character_id='BABY-015' AND def=5;   -- ATK 10: tier +12, chain +1
UPDATE cards SET def=12 WHERE character_id='BACKJI-015' AND def=2;   -- ATK 24: tier +10, chain +0
UPDATE cards SET def=14 WHERE character_id='BADGUY-015' AND def=2;   -- ATK 15: tier +12, chain +0
UPDATE cards SET def=11 WHERE character_id='BAM-015' AND def=1;   -- ATK 25: tier +10, chain +0
UPDATE cards SET def=11 WHERE character_id='BAMMIE-015' AND def=1;   -- ATK 25: tier +10, chain +0
UPDATE cards SET def=11 WHERE character_id='BOBO-015' AND def=1;   -- ATK 30: tier +10, chain +0
UPDATE cards SET def=15 WHERE character_id='CHAEM-015' AND def=2;   -- ATK 24: tier +10, chain +3
UPDATE cards SET def=2 WHERE character_id='CUTIE-015' AND def=0;   -- ATK 35: tier +0, chain +2
UPDATE cards SET def=3 WHERE character_id='DNMAN-015' AND def=1;   -- ATK 40: tier +0, chain +2
UPDATE cards SET def=14 WHERE character_id='FOLLOW-YOU-015' AND def=2;   -- ATK 20: tier +12, chain +0
UPDATE cards SET def=11 WHERE character_id='GOD-WA-015' AND def=1;   -- ATK 30: tier +10, chain +0
UPDATE cards SET def=12 WHERE character_id='I-M-GRAPE-015' AND def=2;   -- ATK 21: tier +10, chain +0
UPDATE cards SET def=0 WHERE character_id='JAOJAY-015' AND def=0;   -- ATK 40: tier +0, chain +0
UPDATE cards SET def=17 WHERE character_id='LALAPING-015' AND def=4;   -- ATK 20: tier +12, chain +1
UPDATE cards SET def=13 WHERE character_id='LEON-S-KENNEDY-015' AND def=3;   -- ATK 25: tier +10, chain +0
UPDATE cards SET def=3 WHERE character_id='LINLADA-015' AND def=1;   -- ATK 35: tier +0, chain +2
UPDATE cards SET def=15 WHERE character_id='LORDNAM-015' AND def=2;   -- ATK 25: tier +10, chain +3
UPDATE cards SET def=16 WHERE character_id='LUCKY-015' AND def=3;   -- ATK 24: tier +10, chain +3
UPDATE cards SET def=3 WHERE character_id='MELON-015' AND def=1;   -- ATK 35: tier +0, chain +2
UPDATE cards SET def=12 WHERE character_id='MIKI-015' AND def=2;   -- ATK 24: tier +10, chain +0
UPDATE cards SET def=2 WHERE character_id='MON-015' AND def=0;   -- ATK 40: tier +0, chain +2
UPDATE cards SET def=11 WHERE character_id='NONG-TAENGMO-015' AND def=1;   -- ATK 30: tier +10, chain +0
UPDATE cards SET def=17 WHERE character_id='NORMAN-015' AND def=4;   -- ATK 18: tier +12, chain +1
UPDATE cards SET def=17 WHERE character_id='OUFILLING-015' AND def=4;   -- ATK 20: tier +12, chain +1
UPDATE cards SET def=2 WHERE character_id='PIKACHU-015' AND def=0;   -- ATK 40: tier +0, chain +2
UPDATE cards SET def=15 WHERE character_id='PK-015' AND def=2;   -- ATK 25: tier +10, chain +3
UPDATE cards SET def=12 WHERE character_id='PKXCY-015' AND def=2;   -- ATK 24: tier +10, chain +0
UPDATE cards SET def=17 WHERE character_id='SATOSHI-015' AND def=5;   -- ATK 20: tier +12, chain +0
UPDATE cards SET def=18 WHERE character_id='SKYMOON-015' AND def=3;   -- ATK 18: tier +12, chain +3
UPDATE cards SET def=1 WHERE character_id='SMILE-015' AND def=1;   -- ATK 35: tier +0, chain +0
UPDATE cards SET def=12 WHERE character_id='SOMYES-015' AND def=2;   -- ATK 25: tier +10, chain +0
UPDATE cards SET def=15 WHERE character_id='TAN-015' AND def=3;   -- ATK 20: tier +12, chain +0
UPDATE cards SET def=17 WHERE character_id='TEE-015' AND def=4;   -- ATK 18: tier +12, chain +1
UPDATE cards SET def=12 WHERE character_id='THAI26-015' AND def=2;   -- ATK 24: tier +10, chain +0
UPDATE cards SET def=17 WHERE character_id='THAI32-015' AND def=4;   -- ATK 18: tier +12, chain +1
UPDATE cards SET def=15 WHERE character_id='THOMAS-015' AND def=2;   -- ATK 25: tier +10, chain +3
UPDATE cards SET def=16 WHERE character_id='WENDYWENDIE-015' AND def=4;   -- ATK 10: tier +12, chain +0
UPDATE cards SET def=16 WHERE character_id='ZEESKY-015' AND def=3;   -- ATK 23: tier +10, chain +3
