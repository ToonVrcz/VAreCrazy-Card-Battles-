-- Shop + player profiles (guest profiles for now; to be linked to VAreCrazy Universe accounts later).
CREATE TABLE players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key_hash text NOT NULL UNIQUE,
  name text NOT NULL DEFAULT 'ผู้เล่น',
  points int NOT NULL DEFAULT 0 CHECK (points >= 0),
  vrcoin int NOT NULL DEFAULT 0 CHECK (vrcoin >= 0),
  pvp_matches int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE player_cards (
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  card_id text NOT NULL,
  qty int NOT NULL CHECK (qty BETWEEN 1 AND 99),
  PRIMARY KEY (player_id, card_id)
);
CREATE TABLE economy_ledger (
  id bigserial PRIMARY KEY,
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  kind text NOT NULL,
  points int NOT NULL DEFAULT 0,
  vrcoin int NOT NULL DEFAULT 0,
  ref text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX economy_ledger_player ON economy_ledger(player_id, id DESC);
-- Price per card level (admin-editable). Levels without a row are not for sale yet (e.g. Lv.99).
CREATE TABLE shop_prices (
  level int PRIMARY KEY,
  currency text NOT NULL CHECK (currency IN ('points','vrcoin')),
  price int NOT NULL CHECK (price >= 0)
);
INSERT INTO shop_prices(level, currency, price) VALUES (40, 'points', 500), (70, 'vrcoin', 100);
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE economy_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_prices ENABLE ROW LEVEL SECURITY;
-- Rooms remember who sits where (for rewards) and whether the match was already rewarded (kept in meta).
ALTER TABLE play_rooms ADD COLUMN profiles jsonb NOT NULL DEFAULT '[null,null]';
