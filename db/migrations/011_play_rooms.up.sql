-- Online 2-player rooms. Server-authoritative: the full game state lives here; players hold secret tokens.
CREATE TABLE play_rooms (
  code text PRIMARY KEY CHECK (code ~ '^[A-Z0-9]{5}$'),
  status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','playing','finished')),
  tokens jsonb NOT NULL,
  state jsonb,
  version int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE play_rooms ENABLE ROW LEVEL SECURITY;
