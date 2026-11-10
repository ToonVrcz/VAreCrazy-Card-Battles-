DROP TRIGGER IF EXISTS trg_snapshot ON cards;
DROP TRIGGER IF EXISTS trg_validate_publish ON cards;
DROP FUNCTION IF EXISTS snapshot_published();
DROP FUNCTION IF EXISTS validate_card_publish();
DROP TABLE IF EXISTS audit_log, card_versions, card_attribute_values, cards,
  evolution_chains, media_assets, attribute_definitions, taxonomy_values,
  taxonomies, admin_users, admin_roles CASCADE;
