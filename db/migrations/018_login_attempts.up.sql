-- Admin login throttling: failed attempts per (lower-cased) email. Rows older than a day are pruned on each failure.
CREATE TABLE admin_login_failures (
  id bigserial PRIMARY KEY,
  email text NOT NULL,
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_login_failures_email_at ON admin_login_failures(email, at DESC);
