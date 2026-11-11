DELETE FROM card_frames WHERE scope LIKE 'level:%';
ALTER TABLE card_frames DROP CONSTRAINT card_frames_scope_check;
ALTER TABLE card_frames ADD CONSTRAINT card_frames_scope_check
  CHECK (scope ~ '^(type:(character|evolution|fusion|spell|trap|item)|card:[A-Za-z0-9_-]+)$');
