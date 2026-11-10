// Supabase Edge Function entry (Deno). Bundled with esbuild -> single file.
import postgres from 'postgres';
import { CardService } from '../server/service.ts';
import { dispatch } from '../server/api.ts';

const env = (k: string) => (globalThis as any).Deno.env.get(k) as string;
const sql = postgres(env('SUPABASE_DB_URL'), { max: 3, prepare: false });
const wrap = (q: any): any => ({
  query: async (text: string, params: unknown[] = []) => {
    const r = await q.unsafe(text, params as any);
    return { rows: Array.from(r), affectedRows: (r as any).count };
  },
  transaction: (fn: (tx: any) => Promise<unknown>) => q.begin((t: any) => fn(wrap(t))),
});
const svc = new CardService(wrap(sql), '/tmp/storage');
const SB = env('SUPABASE_URL'), KEY = env('SUPABASE_SERVICE_ROLE_KEY');
svc.put = async (path, data, mime) => {
  const r = await fetch(`${SB}/storage/v1/object/card-media/${path}`, {
    method: 'POST', headers: { authorization: `Bearer ${KEY}`, 'content-type': mime, 'x-upsert': 'true' }, body: data });
  if (!r.ok) throw new Error('storage ' + r.status);
};
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization,content-type', 'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS' };

(globalThis as any).Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  const u = new URL(req.url);
  const path = u.pathname.replace(/^\/functions\/v1\/api/, '').replace(/^\/api(?=\/api)/, '') || '/';
  const h: Record<string, string> = {}; req.headers.forEach((v, k) => (h[k] = v));
  const out = await dispatch(svc, { method: req.method, path, query: u.searchParams, headers: h,
    body: async () => new Uint8Array(await req.arrayBuffer()) });
  const isJson = out.type === 'application/json';
  return new Response(isJson ? JSON.stringify(out.data) : (out.data as any), { status: out.status, headers: { ...cors, 'content-type': out.type } });
});
