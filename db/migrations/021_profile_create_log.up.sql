-- Guest-profile flood protection: one row per created profile with a hash of the creator's IP (never the raw IP).
-- Rows older than a day are pruned on each creation. Additive; code tolerates the table being absent (protection inactive).
CREATE TABLE profile_create_log (
  id bigserial PRIMARY KEY,
  ip_hash text NOT NULL,
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX profile_create_log_ip_at ON profile_create_log(ip_hash, at DESC);
