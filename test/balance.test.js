// 調整の守り（工程8 Q7・R4）：種を決めた少数の自動対戦（CPU かしこい・基本セット・2〜4人戦を順に）で、大きな崩れだけを止める。
// 拡張の PR でもここが通らないと取り込めない。線はゆるめ：細かい強さは docs/sim の自動対戦で見る。
//   - 札の勝ちへの効き 0.5〜2.0（持たれた回数が少ない札は数えない）
//   - いちばん多い色ごとの1位の割合が、人数から見たふつうの 0.4〜1.8 倍
//   - お題は「五色の庭より取れないお題がない」（四つ角の守り 100% はよしとしたので上の線は作らない）
// 拡張だけで遊んでも山が尽きないことも見る（工程8：拡張だけの4人戦）。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildCatalog, scoreOf } from '../src/core/game.js';
import { playGame } from '../src/core/autoplay.js';

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const load = (id) => ({ meta: read(`../expansions/${id}/expansion.json`), cards: read(`../expansions/${id}/cards.json`) });
const GAMES = 180;

test('調整の守り：基本セットの札・色・お題に大きな崩れがない', () => {
  const cat = buildCatalog([load('base')]);
  const held = {};
  const won = {};
  const color = {};
  const goals = {};
  for (let g = 0; g < GAMES; g++) {
    const n = 2 + (g % 3);
    const { st } = playGame(cat, { players: n, seed: 7000 + g, cpu: 'smart' });
    const sc = st.players.map((_, p) => scoreOf(cat, st, p).total);
    const top = Math.max(...sc);
    st.players.forEach((pl, p) => {
      const win = sc[p] === top ? n : 0; // 人数で割り戻す（1.0 がふつう）
      const ids = new Set(pl.garden.filter(Boolean).map((x) => x.id));
      for (const id of ids) { held[id] = (held[id] ?? 0) + 1; won[id] = (won[id] ?? 0) + win; }
      const k = {};
      for (const x of pl.garden.filter(Boolean)) k[cat.cards[x.id].element] = (k[cat.cards[x.id].element] ?? 0) + 1;
      const best = Object.entries(k).sort((a, b) => b[1] - a[1]);
      if (best.length && (best.length === 1 || best[0][1] > best[1][1])) {
        color[best[0][0]] ??= { n: 0, win: 0 };
        color[best[0][0]].n++;
        color[best[0][0]].win += win;
      }
    });
    for (const gid of st.goals) {
      goals[gid] ??= { shown: 0, claimed: 0 };
      goals[gid].shown += st.players.length;
      goals[gid].claimed += st.claims[gid].length;
    }
  }
  const bad = [];
  for (const id of Object.keys(held)) {
    if (held[id] < 40) continue;
    const effect = won[id] / held[id];
    if (effect < 0.5 || effect > 2.0) bad.push(`札「${cat.cards[id].name}」の勝ちへの効き ${effect.toFixed(2)}`);
  }
  for (const [c, v] of Object.entries(color)) {
    if (v.n < 20) continue;
    const share = v.win / v.n;
    if (share < 0.4 || share > 1.8) bad.push(`色 ${c} の1位（ふつうの ${share.toFixed(2)} 倍）`);
  }
  const five = goals['five-colors'];
  if (five) {
    const floor = five.claimed / five.shown;
    for (const [gid, v] of Object.entries(goals)) if (gid !== 'five-colors' && v.claimed / v.shown < floor) bad.push(`お題 ${gid} が五色の庭より取れない`);
  }
  assert.deepEqual(bad, []);
});

test('拡張だけで遊んでも、4人戦で山が尽きない（1種類の枚数を増やす）', () => {
  for (const id of read('../expansions/index.json').filter((x) => x !== 'base')) {
    const cat = buildCatalog([load(id)]);
    for (let g = 0; g < 3; g++) {
      let gap = false;
      playGame(cat, { players: 4, seed: 300 + g, cpu: 'smart', onStep: (s) => { if (s.phase === 'pick' && s.market.some((x) => !x)) gap = true; } });
      assert.ok(!gap, `${id} だけの4人戦で場のカードが足りなくなった`);
    }
  }
});
