import { CardService, AppError, can } from './service.ts';
import { GameData } from './gamedata.ts';

const need = (u: any, p: string) => { if (!can(u, p)) throw new AppError(403, 'ไม่มีสิทธิ์: ' + p); };
export interface Rq { method: string; path: string; query: URLSearchParams; headers: Record<string, string | undefined>; body: () => Promise<Uint8Array | Buffer> }
export interface Rs { status: number; data: unknown; type: string }

/** Transport-independent API router (used by the Node dev server and the Supabase Edge Function). */
export async function dispatch(svc: CardService, rq: Rq): Promise<Rs> {
  const path = rq.path, m = rq.method, url = { searchParams: rq.query };
  const req = { headers: rq.headers }, res = null as any;
  const body = (_: any) => rq.body().then(b => Buffer.from(b));
  const send = (_r: any, status: number, data: unknown, type = 'application/json'): Rs => ({ status, data, type });
  try {
    let a: RegExpMatchArray | null;
      const token = (req.headers.authorization ?? '').replace(/^Bearer /, '');
      if (path === '/api/login' && m === 'POST') {
        const b = JSON.parse((await body(req)).toString() || '{}');
        return send(res, 200, await svc.login(String(b.email ?? ''), String(b.password ?? '')));
      }
      const u = await svc.auth(token);
      if (path === '/api/me') return send(res, 200, u);
      if (path === '/api/logout' && m === 'POST') { await svc.logout(token); return send(res, 200, { ok: true }); }
      if (path === '/api/cards' && m === 'GET') return send(res, 200, await svc.listCards(u, { status: url.searchParams.get('status') || undefined, q: url.searchParams.get('q') || undefined }));
      if (path === '/api/cards' && m === 'POST') return send(res, 201, await svc.saveCard(u, JSON.parse((await body(req)).toString())));
      if ((a = path.match(/^\/api\/cards\/([\w-]+)$/))) {
        if (m === 'GET') return send(res, 200, await svc.getCard(u, a[1]));
        if (m === 'PUT') return send(res, 200, await svc.saveCard(u, JSON.parse((await body(req)).toString()), a[1]));
      }
      if ((a = path.match(/^\/api\/cards\/([\w-]+)\/status$/)) && m === 'POST')
        return send(res, 200, await svc.transition(u, a[1], JSON.parse((await body(req)).toString()).to));
      if (path === '/api/media' && m === 'POST') {
        const mode = req.headers['x-render-mode'] === 'full' ? 'full' : 'art_only';
        return send(res, 201, await svc.uploadMedia(u, String(req.headers['x-filename'] ?? 'file'), String(req.headers['content-type'] ?? ''), await body(req), mode));
      }
      if (path === '/api/export.json') return send(res, 200, await svc.exportJSON(u));
      if (path === '/api/export.csv') return send(res, 200, await svc.exportCSV(u), 'text/csv; charset=utf-8');
      if (path === '/api/import' && m === 'POST') {
        const text = (await body(req)).toString();
        const items = String(req.headers['content-type']).includes('csv') ? CardService.parseCSV(text) : JSON.parse(text);
        if (!Array.isArray(items)) throw new AppError(400, 'ต้องเป็นอาร์เรย์ของการ์ด');
        const dry = url.searchParams.get('dry') === '1', r: any = await svc.importCards(u, items, dry);
        if (r.ok && !dry) { const me = await new GameData(svc).applyImportMeta(u, items); if (me.length) r.meta_errors = me; }
        return send(res, 200, r);
      }
      if (path === '/api/users' && m === 'GET') return send(res, 200, await svc.listUsers(u));
      if (path === '/api/users' && m === 'POST') {
        const b = JSON.parse((await body(req)).toString());
        return send(res, 201, { id: await svc.adminCreateUser(u, b.email, b.password, b.role) });
      }
      if ((a = path.match(/^\/api\/users\/([\w-]+)$/)) && m === 'PUT') {
        await svc.updateUser(u, a[1], JSON.parse((await body(req)).toString())); return send(res, 200, { ok: true });
      }
      if ((a = path.match(/^\/api\/users\/([\w-]+)\/password$/)) && m === 'POST') {
        await svc.resetPassword(u, a[1], JSON.parse((await body(req)).toString()).password); return send(res, 200, { ok: true });
      }
      if (path === '/api/me/password' && m === 'POST') {
        const b = JSON.parse((await body(req)).toString());
        await svc.changeOwnPassword(u, b.old, b.new, token); return send(res, 200, { ok: true });
      }
      const g = new GameData(svc), jb = async () => JSON.parse((await body(req)).toString() || '{}');
      if (path === '/api/rules' && m === 'GET') return send(res, 200, await g.rules(u));
      if ((a = path.match(/^\/api\/rules\/([\w-]+)$/)) && m === 'PUT') { const b = await jb(); return send(res, 200, await g.setRule(u, a[1], b.value, b.status)); }
      if (path === '/api/affiliations' && m === 'GET') return send(res, 200, await g.affiliations(u));
      if (path === '/api/affiliations' && m === 'POST') return send(res, 200, await g.upsertAffiliation(u, await jb()));
      if (path === '/api/synergies' && m === 'POST') return send(res, 200, await g.upsertSynergy(u, await jb()));
      if ((a = path.match(/^\/api\/synergies\/([\w-]+)$/)) && m === 'DELETE') return send(res, 200, await g.deleteSynergy(u, a[1]));
      if (path === '/api/genders' && m === 'POST') return send(res, 200, await g.upsertGender(u, await jb()));
      if (path === '/api/genders') return send(res, 200, await g.taxValues(u, 'gender'));
      if ((a = path.match(/^\/api\/cards\/([\w-]+)\/meta$/))) return send(res, 200, m === 'PUT' ? await g.setCardMeta(u, a[1], await jb()) : await g.cardMeta(u, a[1]));
      if (path === '/api/stories' && m === 'GET') return send(res, 200, await g.stories(u));
      if (path === '/api/stories' && m === 'POST') return send(res, 200, await g.upsertStory(u, await jb()));
      if ((a = path.match(/^\/api\/stories\/([\w-]+)$/)) && m === 'DELETE') return send(res, 200, await g.deleteStory(u, a[1]));
      if (path === '/api/fusion' && m === 'GET') return send(res, 200, await g.fusionRecipes(u));
      if (path === '/api/fusion' && m === 'POST') return send(res, 200, await g.upsertRecipe(u, await jb()));
      if ((a = path.match(/^\/api\/fusion\/([\w-]+)$/)) && m === 'DELETE') return send(res, 200, await g.deleteRecipe(u, a[1]));
      if (path === '/api/fusion/check' && m === 'POST') { const b = await jb(); return send(res, 200, await g.validateFusion(b.recipe, b.materials ?? [])); }
      if (path === '/api/deck/check' && m === 'POST') { need(u, 'read'); return send(res, 200, await g.validateDeck((await jb()).cards ?? [])); }
      if (path === '/api/bonus' && m === 'POST') { const b = await jb(); return send(res, 200, { synergy: await g.synergyBonus(b.cards ?? []), story: await g.storyBonus(b.cards ?? []), story_links: await g.storyLinkBonus(b.cards ?? []) }); }
      if (path === '/api/chains') return send(res, 200, await g.chains(u));
      if (path === '/api/fusion/pair' && m === 'POST') { const b = await jb(); return send(res, 200, await g.fusionPair(!!b.spell, b.a, b.b, b.hand ?? [])); }
      if (path === '/api/audit') return send(res, 200, await svc.auditLog(u));
      return send(res, 404, { error: 'ไม่พบ endpoint' });
  } catch (e: any) {
    if (e instanceof AppError) return send(res, e.code, { error: e.message });
    if (e instanceof SyntaxError) return send(res, 400, { error: 'JSON ไม่ถูกต้อง' });
    console.error(e); return send(res, 500, { error: 'เกิดข้อผิดพลาดในเซิร์ฟเวอร์' });
  }
}
