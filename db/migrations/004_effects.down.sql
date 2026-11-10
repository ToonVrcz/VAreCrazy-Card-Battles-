CREATE OR REPLACE FUNCTION snapshot_published() RETURNS trigger AS $$
BEGIN
  IF NEW.status='published' AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM 'published') THEN
    INSERT INTO card_versions(card_id,version_no,snapshot)
    VALUES (NEW.id, NEW.version_no, to_jsonb(NEW));
  END IF;
  RETURN NULL;
END $$ LANGUAGE plpgsql;
DROP TABLE IF EXISTS card_effects;
