-- New effect trigger 'on_cast' (when a Spell card is used from hand)
ALTER TABLE card_effects DROP CONSTRAINT card_effects_trigger_check;
ALTER TABLE card_effects ADD CONSTRAINT card_effects_trigger_check CHECK (trigger IN
  ('on_summon','on_evolve','on_attack','on_destroyed','turn_start','turn_end','to_graveyard','passive','combo','on_cast'));
