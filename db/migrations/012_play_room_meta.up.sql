-- Online rooms: chosen decks (card id lists, null = random) and turn timer / presence bookkeeping.
ALTER TABLE play_rooms ADD COLUMN decks jsonb NOT NULL DEFAULT '[null,null]';
ALTER TABLE play_rooms ADD COLUMN meta jsonb NOT NULL DEFAULT '{}';
