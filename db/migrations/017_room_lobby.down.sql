DROP INDEX IF EXISTS play_rooms_public;
DELETE FROM play_rooms WHERE status = 'lobby';
ALTER TABLE play_rooms DROP COLUMN IF EXISTS spectators, DROP COLUMN IF EXISTS ready, DROP COLUMN IF EXISTS turn_ms, DROP COLUMN IF EXISTS is_public, DROP COLUMN IF EXISTS name;
ALTER TABLE play_rooms DROP CONSTRAINT IF EXISTS play_rooms_status_check;
ALTER TABLE play_rooms ADD CONSTRAINT play_rooms_status_check CHECK (status IN ('waiting','playing','finished'));
