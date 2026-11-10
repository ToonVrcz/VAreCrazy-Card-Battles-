DROP TABLE IF EXISTS admin_sessions;
ALTER TABLE admin_users DROP COLUMN IF EXISTS password_hash;
