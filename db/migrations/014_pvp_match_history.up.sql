-- PvP anti-farming, PHASE 1: persistent match history + per-player statistics (DATA COLLECTION ONLY).
-- Nothing here changes who gets rewarded or how much: rewards are still paid by the existing rules in src/server/economy.ts.
-- Pair limit, Match Quality thresholds and reward denial are NOT active; the quality_* columns are reserved for a later phase.
-- Retention: rows are kept (>= 90 days is required). There is intentionally no automatic deletion; pruning needs a separate decision.
CREATE TABLE pvp_matches (
  id uuid PRIMARY KEY,                                   -- generated when the match starts (play_rooms.meta.matchId) so a match can be recorded only once
  room_code text NOT NULL,                               -- informational: room codes are reused after rooms are purged, so NOT unique
  started_at timestamptz,                                -- NULL for rooms that started before this migration
  ended_at timestamptz NOT NULL DEFAULT now(),
  player0_id uuid REFERENCES players(id) ON DELETE SET NULL,   -- seat 0 = room creator; NULL = guest seat (or profile removed later)
  player1_id uuid REFERENCES players(id) ON DELETE SET NULL,   -- seat 1 = joiner
  seat0_profile boolean NOT NULL,                        -- seat had a valid profile when the match was settled (survives profile removal)
  seat1_profile boolean NOT NULL,
  both_profiles boolean GENERATED ALWAYS AS (seat0_profile AND seat1_profile) STORED,
  winner_seat smallint NOT NULL CHECK (winner_seat IN (0, 1)),
  end_reason text NOT NULL CHECK (end_reason IN ('normal', 'surrender', 'timeout', 'disconnect')),
  forfeit_seat smallint CHECK (forfeit_seat IN (0, 1)),  -- the seat that surrendered / timed out / disconnected; NULL for a normal win
  turns int NOT NULL CHECK (turns >= 0),                 -- Game.turn at the end (counts both players' turns)
  stats_version smallint,                                -- NULL = room predates statistics (per-player stats are then NULL too)
  rewards_paid boolean NOT NULL DEFAULT false,           -- informational: the CURRENT rules paid this match
  quality_score numeric,                                 -- reserved for a later phase (not computed yet)
  quality_passed boolean,                                -- reserved
  quality_rules jsonb,                                   -- reserved: snapshot of the thresholds used
  evaluated_at timestamptz                               -- reserved
);
CREATE INDEX pvp_matches_ended ON pvp_matches(ended_at DESC);
CREATE INDEX pvp_matches_room ON pvp_matches(room_code);
CREATE INDEX pvp_matches_p0 ON pvp_matches(player0_id, ended_at DESC);
CREATE INDEX pvp_matches_p1 ON pvp_matches(player1_id, ended_at DESC);

CREATE TABLE pvp_match_players (
  match_id uuid NOT NULL REFERENCES pvp_matches(id) ON DELETE CASCADE,
  seat smallint NOT NULL CHECK (seat IN (0, 1)),
  player_id uuid REFERENCES players(id) ON DELETE SET NULL,
  has_profile boolean NOT NULL,
  is_winner boolean NOT NULL,
  stats jsonb,                                           -- PlayerStats of this seat (src/engine/game.ts); NULL when the room predates statistics
  participation_score numeric,                           -- reserved for a later phase (not computed yet)
  reward_points int NOT NULL DEFAULT 0,                  -- informational: what the CURRENT rules actually paid this seat
  reward_vrcoin int NOT NULL DEFAULT 0,
  PRIMARY KEY (match_id, seat)
);
CREATE INDEX pvp_match_players_player ON pvp_match_players(player_id);
ALTER TABLE pvp_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE pvp_match_players ENABLE ROW LEVEL SECURITY;
