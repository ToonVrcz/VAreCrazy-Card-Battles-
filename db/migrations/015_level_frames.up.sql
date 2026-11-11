-- Allow per-level frames for evolved character cards: scope "level:40" | "level:70" | "level:99".
ALTER TABLE card_frames DROP CONSTRAINT card_frames_scope_check;
ALTER TABLE card_frames ADD CONSTRAINT card_frames_scope_check
  CHECK (scope ~ '^(type:(character|evolution|fusion|spell|trap|item)|level:(40|70|99)|card:[A-Za-z0-9_-]+)$');
