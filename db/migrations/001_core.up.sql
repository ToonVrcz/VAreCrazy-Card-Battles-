-- Milestone 1: Card CMS core (portable Postgres -> Supabase)

CREATE TABLE admin_roles (
  key text PRIMARY KEY,
  label text NOT NULL
);
INSERT INTO admin_roles(key,label) VALUES
 ('super_admin','Super Admin'),('card_editor','Card Editor'),
 ('reviewer','Reviewer'),('publisher','Publisher'),('viewer','Viewer');

CREATE TABLE admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  role_key text NOT NULL REFERENCES admin_roles(key),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE taxonomies (
  key text PRIMARY KEY,            -- element, race, class, tag, rarity
  name text NOT NULL
);
CREATE TABLE taxonomy_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  taxonomy_key text NOT NULL REFERENCES taxonomies(key),
  key text NOT NULL,
  name text NOT NULL,
  UNIQUE (taxonomy_key, key)
);

-- Stat/attribute definitions: data-driven so new stats need no code change
CREATE TABLE attribute_definitions (
  key text PRIMARY KEY,            -- hp, atk, def, ...
  label text NOT NULL,
  icon text,                       -- heart, flame, shield
  show_on_card boolean NOT NULL DEFAULT true,
  show_delta boolean NOT NULL DEFAULT true,  -- floating +/- on board
  sort_order int NOT NULL DEFAULT 0
);
INSERT INTO attribute_definitions(key,label,icon,sort_order) VALUES
 ('hp','HP','heart',1),('atk','ATK','flame',2),('def','DEF','shield',3);

CREATE TABLE media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_path text NOT NULL UNIQUE,
  mime text NOT NULL,
  width int, height int,
  render_mode text NOT NULL DEFAULT 'art_only'
    CHECK (render_mode IN ('full','art_only')), -- full = stats baked in image
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE evolution_chains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  require_all_forms boolean NOT NULL DEFAULT false,
  required_levels int[] NOT NULL DEFAULT '{15,40,70,99}'
);

CREATE TABLE cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id text NOT NULL UNIQUE,
  name text NOT NULL,
  card_type text NOT NULL CHECK (card_type IN
    ('character','evolution','spell','trap','item')),
  level int CHECK (level BETWEEN 1 AND 99),
  chain_id uuid REFERENCES evolution_chains(id),
  evolves_from uuid REFERENCES cards(id),
  hp int CHECK (hp >= 0),
  atk int CHECK (atk >= 0),
  def int CHECK (def >= 0),
  has_combo boolean NOT NULL DEFAULT false,   -- combo = icon, not a type
  summon_cost jsonb NOT NULL DEFAULT '{}',    -- e.g. {"sacrifice":0} / {"points":N} / {"vrcoin":N}
  rules_text text,
  flavor_text text,
  element_id uuid REFERENCES taxonomy_values(id),
  race_id uuid REFERENCES taxonomy_values(id),
  class_id uuid REFERENCES taxonomy_values(id),
  media_id uuid REFERENCES media_assets(id),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN
    ('draft','in_review','approved','published','archived')),
  version_no int NOT NULL DEFAULT 0,
  created_by uuid REFERENCES admin_users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (chain_id, level),
  CHECK (card_type <> 'character' OR (level IS NOT NULL AND hp IS NOT NULL AND atk IS NOT NULL))
);

CREATE TABLE card_attribute_values (
  card_id uuid REFERENCES cards(id) ON DELETE CASCADE,
  attribute_key text REFERENCES attribute_definitions(key),
  value int NOT NULL,
  PRIMARY KEY (card_id, attribute_key)
);

CREATE TABLE card_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  version_no int NOT NULL,
  snapshot jsonb NOT NULL,
  published_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (card_id, version_no)
);

CREATE TABLE audit_log (
  id bigserial PRIMARY KEY,
  actor text,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id text,
  diff jsonb,
  at timestamptz NOT NULL DEFAULT now()
);

-- Data rules enforced at publish time (DB-level, cannot be bypassed by UI)
CREATE FUNCTION validate_card_publish() RETURNS trigger AS $$
DECLARE
  prev cards%ROWTYPE;
  ch evolution_chains%ROWTYPE;
  missing int[];
BEGIN
  IF NEW.status = 'published' AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM 'published') THEN
    IF NEW.card_type='character' AND NEW.media_id IS NULL THEN
      RAISE EXCEPTION 'PUBLISH_RULE: character % needs an image', NEW.character_id;
    END IF;
    IF NEW.evolves_from IS NOT NULL THEN
      SELECT * INTO prev FROM cards WHERE id = NEW.evolves_from;
      IF prev.chain_id IS DISTINCT FROM NEW.chain_id THEN
        RAISE EXCEPTION 'PUBLISH_RULE: % evolves from a card in another chain', NEW.character_id;
      END IF;
      IF prev.level >= NEW.level THEN
        RAISE EXCEPTION 'PUBLISH_RULE: level order invalid (% >= %) for %', prev.level, NEW.level, NEW.character_id;
      END IF;
    END IF;
    IF NEW.chain_id IS NOT NULL THEN
      SELECT * INTO ch FROM evolution_chains WHERE id = NEW.chain_id;
      IF ch.require_all_forms THEN
        SELECT array_agg(l) INTO missing FROM unnest(ch.required_levels) l
          WHERE NOT EXISTS (SELECT 1 FROM cards c WHERE c.chain_id=ch.id AND c.level=l
                            AND (c.id=NEW.id OR c.status IN ('approved','published')));
        IF missing IS NOT NULL THEN
          RAISE EXCEPTION 'PUBLISH_RULE: chain % missing forms at levels %', ch.key, missing;
        END IF;
      END IF;
    END IF;
    NEW.version_no := COALESCE(OLD.version_no,0) + 1;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_publish BEFORE INSERT OR UPDATE ON cards
  FOR EACH ROW EXECUTE FUNCTION validate_card_publish();

CREATE FUNCTION snapshot_published() RETURNS trigger AS $$
BEGIN
  IF NEW.status='published' AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM 'published') THEN
    INSERT INTO card_versions(card_id,version_no,snapshot)
    VALUES (NEW.id, NEW.version_no, to_jsonb(NEW));
  END IF;
  RETURN NULL;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_snapshot AFTER INSERT OR UPDATE ON cards
  FOR EACH ROW EXECUTE FUNCTION snapshot_published();
