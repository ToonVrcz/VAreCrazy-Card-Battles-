-- Phase 3 (Room System): a room now has a lobby phase (guest seated, not started yet), a name, a public/private flag,
-- its own turn length, a ready flag per seat and a list of spectator tokens. Existing rooms keep working (defaults below).
ALTER TABLE play_rooms DROP CONSTRAINT IF EXISTS play_rooms_status_check;
ALTER TABLE play_rooms ADD CONSTRAINT play_rooms_status_check CHECK (status IN ('waiting','lobby','playing','finished'));
ALTER TABLE play_rooms
  ADD COLUMN name text,
  ADD COLUMN is_public boolean NOT NULL DEFAULT false,
  ADD COLUMN turn_ms int CHECK (turn_ms IS NULL OR turn_ms BETWEEN 30000 AND 300000),   -- NULL = default (90 s)
  ADD COLUMN ready jsonb NOT NULL DEFAULT '[false,false]',
  ADD COLUMN spectators jsonb NOT NULL DEFAULT '[]';    -- spectator tokens (read-only); never sent to clients
CREATE INDEX play_rooms_public ON play_rooms(updated_at DESC) WHERE is_public;
