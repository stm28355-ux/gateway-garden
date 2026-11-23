// 拡張ごとの確かめ：基本セットと混ぜて CPU どうしで最後まで遊べるか。拡張を足したら自動でここも通る。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildCatalog, createGame } from '../src/core/game.js';
import { GOALS, goalPool } from '../src/core/goals.js';
import { playGame } from '../src/core/autoplay.js';
import { baseCatalog } from './helpers.js';

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const ids = read('../expansions/index.json').filter((id) => id !== 'base');
const load = (id) => ({ meta: read(`../expansions/${id}/expansion.json`), cards: read(`../expansions/${id}/cards.json`) });

for (const id of ids) {
  test(`拡張 ${id}：基本セットと混ぜて 2〜4人で最後まで遊べる`, () => {
    const cat = buildCatalog([load('base'), load(id)]);
    for (const players of [2, 3, 4]) {
      const { st } = playGame(cat, { players, seed: 100 + players });
      assert.equal(st.phase, 'end');
    }
    const used = new Set();
    for (let seed = 1; seed <= 20; seed++) {
      const { st } = playGame(cat, { players: 3, seed });
      for (const pl of st.players) for (const x of pl.garden) if (x) used.add(x.id);
    }
    const unused = cat.deckIds.filter((c) => c.startsWith(id) && !used.has(c));
    assert.ok(unused.length <= 2, `CPU が20ゲームで一度も使わない札が多い：${unused.map((c) => cat.cards[c].name).join('・')}`);
  });
}

test('目標札「世界の交わり」は拡張を混ぜたときだけ出る', () => {
  assert.ok(!goalPool(baseCatalog()).includes('world-cross'));
  if (!ids.length) return;
  const cat = buildCatalog([load('base'), load(ids[0])]);
  assert.ok(goalPool(cat).includes('world-cross'));
  const st = createGame(cat, { players: [{ name: 'A' }, { name: 'B' }], seed: 1, firstPlayer: 0 });
  const ext = cat.deckIds.find((c) => c.startsWith(ids[0]));
  const base = cat.deckIds.filter((c) => c.startsWith('base'));
  const g = st.players[0].garden;
  g[4] = { uid: 1, id: ext, stage: 1 };
  g[1] = { uid: 2, id: base[0], stage: 1 };
  g[3] = { uid: 3, id: base[1], stage: 1 };
  g[5] = { uid: 4, id: base[2], stage: 1 };
  g[7] = { uid: 5, id: base[3], stage: 1 };
  g[0] = { uid: 6, id: ext, stage: 1 }; // 左上の拡張が、上と左の基本の札と隣り合う
  assert.ok(!GOALS['world-cross'].check(cat, g), '6か所ではまだ（工程8 R2：7か所から）');
  g[8] = { uid: 7, id: ext, stage: 1 }; // 右下の拡張が、右と下の基本の札と隣り合う
  assert.ok(GOALS['world-cross'].check(cat, g), '8か所で満たす');
});
