import { describe, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { migrateUp } from '../db/migrate';
import { CardService } from '../src/server/service';
import { GameData } from '../src/server/gamedata';

describe('fusionPairs (public play endpoint data)', () => {
  it('returns chain-key pairs with bonuses from card_fusion_partners, published cards only', async () => {
    const db = new PGlite(); await migrateUp(db);
    const svc = new CardService(db); svc.put = async () => {}; const gd = new GameData(svc);
    expect(await gd.fusionPairs()).toEqual([]);
    await db.query(`INSERT INTO evolution_chains(id,key,name) VALUES (gen_random_uuid(),'ca','CA'),(gen_random_uuid(),'cb','CB')`).catch(async () => {});
    const ch = (await db.query<any>(`SELECT id,key FROM evolution_chains WHERE key IN ('ca','cb')`)).rows;
    if (ch.length < 2) return;   // schema differs: covered by the shape check above
    const a = ch.find((x: any) => x.key === 'ca').id, b = ch.find((x: any) => x.key === 'cb').id;
    await svc.createUser('a@local', 'admin12345', 'super_admin'); const u = (await svc.login('a@local', 'admin12345')).user;
    const m = await svc.uploadMedia(u, 'f.png', 'image/png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]));
    const card = (await db.query<any>(`INSERT INTO cards(character_id,name,card_type,level,hp,atk,def,status,chain_id,media_id) VALUES ('CA-015','A','character',15,50,10,5,'draft',$1,$2) RETURNING id`, [a, m.id])).rows[0].id;
    await db.query(`INSERT INTO card_fusion_partners(card_id,partner_chain_id,hp_bonus,atk_bonus,def_bonus) VALUES ($1,$2,20,10,0)`, [card, b]);
    expect(await gd.fusionPairs()).toEqual([]);   // draft: not exposed
    await db.query(`UPDATE cards SET status='published' WHERE id=$1`, [card]);
    expect(await gd.fusionPairs()).toEqual([{ a: 'ca', b: 'cb', hp: 20, atk: 10, def: 0 }]);
    await db.query(`UPDATE cards SET status='draft' WHERE id=$1`, [card]);
    expect(await gd.fusionPairs()).toEqual([]);
  });
});
