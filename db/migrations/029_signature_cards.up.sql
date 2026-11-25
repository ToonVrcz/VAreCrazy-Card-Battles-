-- Signature Spell/Trap cards: `cards.support` holds the engine config (data-driven). Schema only, ADDITIVE. The 39 draft cards are loaded from db/seed/signature-cards.sql at deploy time.
-- NOT APPLIED to production (owner "Deploy" required).
ALTER TABLE cards ADD COLUMN IF NOT EXISTS support jsonb;
ALTER TABLE cards ADD CONSTRAINT cards_support_chk CHECK (support IS NULL OR (jsonb_typeof(support)='object' AND card_type IN ('spell','trap')));
