-- Shop prices (buy a card into inventory). Points = earned in PvP; Vrcoin = Universe currency.
-- Neither is an in-game cost. Owner rules: Lv.40 = 500 points, Lv.70 = 100 Vrcoin.
ALTER TABLE cards ADD COLUMN shop_price_points int CHECK (shop_price_points >= 0);
ALTER TABLE cards ADD COLUMN shop_price_vrcoin int CHECK (shop_price_vrcoin >= 0);
