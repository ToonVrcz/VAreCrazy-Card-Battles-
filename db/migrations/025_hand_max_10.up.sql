-- Hand limit 5 -> 10 (owner request). Guarded by the OLD value so an Admin edit is never overwritten.
-- NOT APPLIED to production (owner "Deploy" required). Engine constant RULES.handMax is changed in code.
UPDATE game_rules SET value='10' WHERE key='hand_max' AND value='5';
