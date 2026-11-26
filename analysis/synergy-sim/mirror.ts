// Stage C: controlled Starter-vs-Advanced mirror. SAME seven chains on both sides; one side adds progression (Evolution card + Lv40/70 forms, optionally Signature). SIMULATION ONLY.
import { writeFileSync } from 'node:fs';
import { botPick } from '../../src/engine/bot.ts';
import { createGame, BASE, SIG, CHARS, PAIRS, STORY, type Game, type CardDef } from './lib.ts';
import { VARIANTS, makeAct } from './synergy.ts';
const SYN = VARIANTS[process.env.SYN ?? 'base'] ?? null, SETS = +(process.env.SETS ?? 12), N = +(process.env.N ?? 20);
const lcg = (s: number) => () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
const by = new Map([...BASE, ...SIG].map(c => [c.id, c])), L15 = (k: string) => CHARS.find(c => c.chain === k && c.level === 15)!;
const withForms = [...new Set(CHARS.filter(c => (c.level ?? 0) >= 40).map(c => c.chain!))];
const spells = BASE.filter(c => c.type === 'spell'), traps = BASE.filter(c => c.type === 'trap');
const res: any = { starterWins: { adv_evo: 0, adv_evo_sig: 0 }, games: { adv_evo: 0, adv_evo_sig: 0 }, turns: 0, sets: SETS, withForms: withForms.length };
for (let s = 0; s < SETS; s++) {
  const r = lcg(31 * s + 7), chains = [...withForms].sort(() => r() - .5).slice(0, 7), cnt: Record<string, number> = {};
  const add = (d: CardDef[], c: CardDef | undefined, k = 1) => { for (let i = 0; i < k; i++) { if (!c || (cnt[d.length ? 'x' : 'y'], false)) return; d.push(c); } };
  const spellPick: CardDef[] = []; for (let g = 0; spellPick.length < 19 && g < 400; g++) { const pool = g % 3 === 2 ? traps : spells, c = pool[Math.floor(r() * pool.length)]; if (spellPick.filter(x => x.id === c.id).length < 3) spellPick.push(c); }
  const core: CardDef[] = chains.flatMap(k => [L15(k), L15(k), L15(k)]);
  const starter = [...core, ...spellPick];
  const forms = CHARS.filter(c => (c.level ?? 0) > 15 && chains.includes(c.chain!)).sort((a, b) => a.level! - b.level!).slice(0, 15);
  const evo = by.get('EVO-001')!, sig = SIG.filter(c => c.type !== 'character' && chains.includes((c as any).support?.link)).slice(0, 6);
  const advEvo = [...core, ...spellPick.slice(0, 16), evo, evo, evo];                                        // swaps 3 spells for 3 Evolution cards
  const advSig = [...core, ...spellPick.slice(0, 16 - sig.length), ...sig, evo, evo, evo];                  // + Signature support linked to these chains
  for (const [tag, adv] of [['adv_evo', advEvo], ['adv_evo_sig', advSig]] as const) for (let n = 1; n <= N; n++) {
    const first = (n % 2) as 0 | 1, advSeat = (n % 2) as 0 | 1;                                              // advanced deck sits in seat advSeat; alternate first player too
    const decks: [CardDef[], CardDef[]] = advSeat === 0 ? [adv.slice(0, 40), starter.slice(0, 40)] : [starter.slice(0, 40), adv.slice(0, 40)];
    const extras: [CardDef[], CardDef[]] = advSeat === 0 ? [forms, []] : [[], forms];
    let g: Game = createGame(decks, 9000 + s * 100 + n, first, { storyLinks: STORY, fusionPairs: PAIRS as any, interactive: false, extras }); const act = makeAct(SYN); let st = 0;
    while (g.winner === null && st++ < 5000) g = act(g, botPick(g));
    res.games[tag]++; if (g.winner === (1 - advSeat)) res.starterWins[tag]++; res.turns += g.turn;
  }
}
res.starterWinPct = Object.fromEntries(Object.keys(res.games).map(k => [k, +(100 * res.starterWins[k] / res.games[k]).toFixed(1)])); res.avgTurns = +(res.turns / (res.games.adv_evo + res.games.adv_evo_sig)).toFixed(1);
writeFileSync(new URL(`./out/mirror-${process.env.SYN ?? 'base'}.json`, import.meta.url), JSON.stringify(res, null, 1)); console.log(JSON.stringify(res));
