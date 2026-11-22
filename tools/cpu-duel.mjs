// CPU の強さ比べ：「かしこい」と「ふつう」を同じ卓で戦わせ、1位の割合を見る（工程8 Q1）。
// 使い方：node tools/cpu-duel.mjs [ゲーム数=200] [人数=2] [--exp auto-battler-1]
import { readFileSync } from 'node:fs';
import { buildCatalog, scoreOf } from '../src/core/game.js';
import { playGame } from '../src/core/autoplay.js';

const args = process.argv.slice(2);
const i = args.indexOf('--exp');
const exp = i >= 0 ? args.splice(i, 2)[1].split(',') : [];
const games = Number(args[0] ?? 200);
const n = Number(args[1] ?? 2);
const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const cat = buildCatalog(['base', ...exp].map((id) => ({ meta: read(`../expansions/${id}/expansion.json`), cards: read(`../expansions/${id}/cards.json`) })));

const wins = { smart: 0, normal: 0 };
const pts = { smart: [], normal: [] };
for (let g = 0; g < games; g++) {
  // 席は交互に（半分の卓は「かしこい」が先番側）
  const seats = Array.from({ length: n }, (_, k) => ((k + g) % 2 ? 'normal' : 'smart'));
  const { st } = playGame(cat, { players: n, seed: 1000 + g, cpu: seats });
  const sc = st.players.map((_, p) => scoreOf(cat, st, p).total);
  const top = Math.max(...sc);
  sc.forEach((s, p) => { pts[seats[p]].push(s); if (s === top) wins[seats[p]] += 1 / sc.filter((x) => x === top).length; });
}
const avg = (xs) => (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1);
const share = (k) => Math.round((100 * wins[k]) / games);
console.log(`${n}人・${games}ゲーム（${['base', ...exp].join('+')}）`);
console.log(`かしこい：1位 ${share('smart')}%・平均 ${avg(pts.smart)}点`);
console.log(`ふつう　：1位 ${share('normal')}%・平均 ${avg(pts.normal)}点`);
