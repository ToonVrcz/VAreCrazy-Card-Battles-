CREATE TABLE card_frames (
  scope text PRIMARY KEY CHECK (scope ~ '^(type:(character|evolution|fusion|spell|trap|item)|card:[A-Za-z0-9_-]+)$'),
  media_id uuid NOT NULL REFERENCES media_assets(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);
