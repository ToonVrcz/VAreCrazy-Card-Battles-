import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'node:fs';

// F-06 regression: every absolute script the pages load must be routed to a file that exists (outputDirectory is "." so public/ is not the web root).
const cfg = JSON.parse(readFileSync('vercel.json', 'utf8')) as { rewrites: { source: string; destination: string }[] };
const rules = new Map(cfg.rewrites.map(r => [r.source, r.destination]));

describe('vercel.json routing (F-06)', () => {
  it('has no duplicate rewrite sources', () => { expect(cfg.rewrites.length).toBe(rules.size); });
  it('/admin-tools.js is rewritten to the generated bundle', () => { expect(rules.get('/admin-tools.js')).toBe('/public/admin-tools.js'); });
  it('every rewrite to /public/* points at an existing file', () => {
    for (const d of rules.values()) if (d.startsWith('/public/')) expect(existsSync(d.slice(1)), d).toBe(true);
  });
  it('every local <script src="/..."> in the pages is routed', () => {
    for (const f of readdirSync('public').filter(n => n.endsWith('.html'))) {
      const html = readFileSync(`public/${f}`, 'utf8');
      for (const m of html.matchAll(/<script[^>]+src="(\/[^"?#]+)"/g)) expect(rules.has(m[1]), `${f} loads ${m[1]} but vercel.json has no rewrite`).toBe(true);
    }
  });
  it('no rewrite shadows another (a path rule must not also match a more specific literal)', () => {
    const wild = cfg.rewrites.filter(r => r.source.includes(':'));
    for (const lit of cfg.rewrites.filter(r => !r.source.includes(':')))
      for (const w of wild) expect(lit.source.startsWith(w.source.split(':')[0]) && w.source.split(':')[0] !== '/', `${lit.source} vs ${w.source}`).toBe(false);
  });
});
