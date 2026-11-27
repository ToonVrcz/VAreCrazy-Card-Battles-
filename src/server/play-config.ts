import { resolveConfig, CONFIG_RULE_KEYS, type GameConfig } from '../engine/config.ts';
type Q = { query<T = any>(sql: string, params?: unknown[]): Promise<{ rows: T[] }> };
/** The per-game rules snapshot: game_rules + Game Synergy tiers + which card belongs to which game group.
 *  A Lv.40/70/99 character with no group rows of its own inherits the groups of its chain's Lv.15 card (editing its own groups in the CMS overrides that). */
export async function loadPlayConfig(db: Q): Promise<GameConfig> {
  const rules = (await db.query(`SELECT key,value FROM game_rules WHERE key = ANY($1)`, [[...CONFIG_RULE_KEYS]])).rows;
  const synergies = (await db.query(`SELECT v.key aff, s.min_members "min", s.stat, s.amount, s.max_stacks stacks FROM affiliation_synergies s JOIN taxonomy_values v ON v.id=s.affiliation_id ORDER BY v.key, s.min_members`)).rows;
  const members = (await db.query(
    `SELECT c.character_id card, v.key aff FROM cards c JOIN card_affiliations ca ON ca.card_id=c.id JOIN taxonomy_values v ON v.id=ca.value_id
      WHERE c.status<>'archived' AND c.card_type='character'
     UNION
     SELECT c.character_id, v.key FROM cards c JOIN cards b ON b.chain_id=c.chain_id AND b.level=15 AND b.status<>'archived'
       JOIN card_affiliations ca ON ca.card_id=b.id JOIN taxonomy_values v ON v.id=ca.value_id
      WHERE c.status<>'archived' AND c.card_type='character' AND c.level>15 AND NOT EXISTS (SELECT 1 FROM card_affiliations x WHERE x.card_id=c.id)`)).rows;
  return resolveConfig(rules, { synergies, members });
}
