// お題の重い版を試す（工程8 Q4・#5）。CPU「かしこい」どうしで遊んだ終わりの庭で、条件を満たしている人の割合を数える。
// CPU はこの重い版を狙わないので、実際に出したときより低めに出る（下限の目安）。
// 使い方：node tools/goal-variants.mjs [人数=3] [ゲーム数=300] [--exp auto-battler-1]
import { readFileSync } from 'node:fs';
import { buildCatalog } from '../src/core/game.js';
import { playGame } from '../src/core/autoplay.js';
import { LINES, adjacent } from '../src/core/garden.js';
import { GOALS } from '../src/core/goals.js';

const args = process.argv.slice(2);
const i = args.indexOf('--exp');
const exp = i >= 0 ? args.splice(i, 2)[1].split(',') : [];
const n = Number(args[0] ?? 3);
const games = Number(args[1] ?? 300);
const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const ids = ['base', ...exp];
const cat = buildCatalog(ids.map((id) => ({ meta: read(`../expansions/${id}/expansion.json`), cards: read(`../expansions/${id}/cards.json`) })));
const el = (x) => cat.cards[x.id].element;
const role = (x) => cat.cards[x.id].role;
const org = (x) => cat.cards[x.id].origin;
const now = (id) => (g) => GOALS[id].check(cat, g);
const count = (g, f) => g.filter((x) => x && f(x)).length;
const cross = (g) => {
  let k = 0;
  g.forEach((x, a) => { if (x) for (const b of adjacent(a)) if (b > a && g[b] && org(g[b]) !== org(x)) k++; });
  return k;
};

const V = {
  '虹の小道（今：違う色3枚で一列）': now('rainbow-line'),
  '虹の小道：違う色の★★以上3枚で一列': (g) => LINES.some((l) => l.every((c) => g[c]?.stage >= 2) && new Set(l.map((c) => el(g[c]))).size === 3),
  '虹の小道：違う色3枚の列が2本': (g) => LINES.filter((l) => l.every((c) => g[c]) && new Set(l.map((c) => el(g[c]))).size === 3).length >= 2,
  'そろいの花壇（今：同じ色3枚で一列）': now('same-line'),
  'そろいの花壇：同じ色の★★以上3枚で一列': (g) => LINES.some((l) => l.every((c) => g[c]?.stage >= 2) && new Set(l.map((c) => el(g[c]))).size === 1),
  '大きな木（今：★★★2枚）': now('big-tree'),
  '大きな木：★★★4枚': (g) => count(g, (x) => x.stage === 3) >= 4,
  '大きな木：★★★5枚': (g) => count(g, (x) => x.stage === 3) >= 5,
  '茂った庭（今：★★以上5枚）': now('lush'),
  '茂った庭：★★以上7枚': (g) => count(g, (x) => x.stage >= 2) >= 7,
  '茂った庭：★★以上8枚': (g) => count(g, (x) => x.stage >= 2) >= 8,
  '対の芽（今：同じ色の★★以上2枚が隣）': now('pair-sprouts'),
  '対の芽：同じ色の★★★2枚が隣': (g) => g.some((x, a) => x?.stage === 3 && adjacent(a).some((b) => g[b]?.stage === 3 && el(g[b]) === el(x))),
  '四つ角の守り（今：中央と4つの角）': now('four-corners'),
  '四つ角の守り：中央と4つの角が★★以上': (g) => [0, 2, 4, 6, 8].every((c) => g[c]?.stage >= 2),
  '四つ角の守り：中央と4つの角が★★★': (g) => [0, 2, 4, 6, 8].every((c) => g[c]?.stage === 3),
  '仲良しの輪（今：同じ役目3枚）': now('friends'),
  '仲良しの輪：同じ役目4枚': (g) => {
    const k = {};
    for (const x of g) if (x) k[role(x)] = (k[role(x)] ?? 0) + 1;
    return Object.values(k).some((v) => v >= 4);
  },
  '五色の庭（今）': now('five-colors'),
};
if (exp.length) {
  V['世界の交わり（今：3か所）'] = (g) => cross(g) >= 3;
  V['世界の交わり：5か所'] = (g) => cross(g) >= 5;
  V['世界の交わり：7か所'] = (g) => cross(g) >= 7;
}

const hit = Object.fromEntries(Object.keys(V).map((k) => [k, 0]));
let people = 0;
for (let g = 0; g < games; g++) {
  const { st } = playGame(cat, { players: n, seed: 5000 + g, cpu: 'smart' });
  for (const pl of st.players) {
    people++;
    for (const [k, f] of Object.entries(V)) if (f(pl.garden)) hit[k]++;
  }
}
console.log(`${ids.join('+')}・${n}人・${games}ゲーム（終わりの庭で満たしている人の割合）`);
for (const [k, v] of Object.entries(hit)) console.log(`${String(Math.round((100 * v) / people)).padStart(3)}%  ${k}`);
