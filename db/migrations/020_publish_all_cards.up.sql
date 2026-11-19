-- F-04 (approved by Toon 2026-11-19): publish every card that is still Draft / In Review so the published-only card pool is playable.
-- Explicit ID list (59 cards) — nothing is selected by pattern. NOT applied to production until Toon says "Deploy".
-- Triggers do the rest: validate_card_publish (image/chain rules), version_no 0 -> 1, card_versions snapshot, updated_at.
-- Note: FOLLOW-YOU-040 has a 'combo' ability the engine does not run yet; direct SQL bypasses the service publish gate (the engine still shows it as not active).
UPDATE cards SET status = 'published'
 WHERE status IN ('draft', 'in_review')
   AND character_id IN (
    'DNMAN-015', 'FOLLOW-YOU-015', 'FOLLOW-YOU-040', 'FOLLOW-YOU-070', 'GOD-WA-015', 'I-M-GRAPE-015', 'JAOJAY-015',
    'LALAPING-015', 'LALAPING-040', 'LALAPING-070', 'LEON-S-KENNEDY-015', 'LINLADA-015', 'LORDNAM-015', 'LUCKY-015',
    'MELON-015', 'MIKI-015', 'MON-015', 'NONG-TAENGMO-015', 'NORMAN-015', 'NORMAN-040', 'OUFILLING-015',
    'PIKACHU-015', 'PK-015', 'PKXCY-015', 'SATOSHI-015', 'SATOSHI-040', 'SKYMOON-015', 'SMILE-015', 'SOMYES-015',
    'TAN-015', 'TEE-015', 'TEE-040', 'THAI26-015', 'THAI32-015', 'THOMAS-015', 'WENDYWENDIE-015', 'ZEESKY-015',
    'EVO-001', 'FUS-001', 'SPL-001', 'SPL-002', 'SPL-003', 'SPL-004', 'SPL-005', 'SPL-006', 'SPL-007', 'SPL-008',
    'SPL-009', 'SPL-010', 'TRP-001', 'TRP-002', 'TRP-003', 'TRP-004', 'TRP-005', 'TRP-006', 'TRP-007', 'TRP-008',
    'TRP-009', 'TRP-010'
   );
