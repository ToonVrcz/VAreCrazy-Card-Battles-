ALTER TABLE admin_users ADD COLUMN password_hash text;
CREATE TABLE admin_sessions (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
