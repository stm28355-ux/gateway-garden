// 拡張 Celestial Alchemy で足した部品：溶解（remove）・複製（copy）・連なり（connected）・拡張のお題（expansion.json の goals）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applyMut, buildCatalog, countIn, createGame } from '../src/core/game.js';
import { GOALS, goalPool, shapePlacements } from '../src/core/goals.js';
import { validateExpansion } from '../src/core/schema.js';
import { playGame } from '../src/core/autoplay.js';
import { stageLines } from '../src/ui/describe.js';
import { byName } from './helpers.js';

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const base = { meta: read('../expansions/base/expansion.json'), cards: read('../expansions/base/cards.json') };

const card = (n, element, role, stages) => ({
  id: `parts-test-${n}`, name: `試し${n}`, element, role, cost: { [element]: 1 }, growth: 'flat',
  stages: stages.map((effects, i) => ({ points: i === 2 ? 1 : 0, effects })),
});
const L5 = [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]];
const testExp = {
  meta: { id: 'parts-test', name: '部品の試し', version: '0.1.0', authors: ['test'],
    goals: [{ id: 'l-mark', name: '器の刻印', text: 'L字の5マスを★★以上のカードで埋める', kind: 'shape', cells: L5, filter: { minStage: 2 } }] },
  cards: [
    card(1, 'red', 'convert', [[{ when: 'use', do: 'remove', area: 'adjacent', filter: { element: 'blue' }, amount: 1 }], [], []]),
    card(2, 'green', 'generate', [[{ when: 'use', do: 'copy' }], [], []]),
    card(3, 'yellow', 'score', [[{ when: 'end', do: 'score', amount: 1, per: { area: 'connected', filter: { element: 'yellow' } } }], [], []]),
    card(4, 'blue', 'generate', [[{ when: 'activate', do: 'copy' }], [{ when: 'activate', do: 'remove', area: 'self' }], []]),
  ],
};
const cat = buildCatalog([base, testExp]);

function reactState(cards, mana = {}) {
  const st = createGame(cat, { players: [{ name: 'A' }, { name: 'B' }], seed: 7, firstPlayer: 0 });
  st.phase = 'react';
  const pl = st.players[0];
  pl.status = 'acting';
  let uid = 1000;
  for (const [cell, id, stage = 1] of cards) pl.garden[cell] = { uid: uid++, id, stage };
  Object.assign(pl.mana, mana);
  return st;
}

test('書き方の確かめ：新しい部品と拡張のお題が通り、誤りは止める', () => {
  assert.deepEqual(validateExpansion('parts-test', testExp.meta, testExp.cards), []);
  const bad = validateExpansion('parts-test', { ...testExp.meta, goals: [{ id: 'X', kind: 'shape', cells: [[3, 0]] }] },
    [card(9, 'red', 'convert', [[{ when: 'use', do: 'remove' }], [], []])]);
  assert.ok(bad.some((e) => e.includes('remove には area が要る')));
  assert.ok(bad.some((e) => e.includes('id は英小文字')));
  assert.ok(bad.some((e) => e.includes('name（名前）と text')));
  assert.ok(bad.some((e) => e.includes('cells')));
});

test('溶解：範囲のカード1枚までを選んで取り除き、その★ごとにその色を得る。溶かさなくてもよい', () => {
  const blue = byName(cat, 'しずくクラゲ');
  const st = reactState([[4, 'parts-test-1'], [1, blue, 2], [3, blue]]);
  applyMut(cat, st, { type: 'use', player: 0, cell: 4 });
  const pl = st.players[0];
  assert.equal(pl.choice.kind, 'remove');
  assert.deepEqual(pl.choice.options, [1, 3]);
  applyMut(cat, st, { type: 'choose', player: 0, value: 1 });
  assert.equal(pl.garden[1], null);
  assert.equal(pl.mana.blue, 2); // ★★ × 1
  assert.ok(st.discardPile.some((x) => x.uid === 1001));

  const st2 = reactState([[4, 'parts-test-1'], [1, blue, 2]]);
  applyMut(cat, st2, { type: 'use', player: 0, cell: 4 });
  applyMut(cat, st2, { type: 'choose', player: 0, value: null });
  assert.ok(st2.players[0].garden[1]);
  assert.equal(st2.players[0].choice, null);
});

test('複製：このカードの写し（同じカード・新しい番号）が手元に入る。自分を溶かすカードは開花で消える', () => {
  const st = reactState([[0, 'parts-test-2']]);
  applyMut(cat, st, { type: 'use', player: 0, cell: 0 });
  const pl = st.players[0];
  assert.equal(pl.pending.at(-1).id, 'parts-test-2');
  assert.notEqual(pl.pending.at(-1).uid, pl.garden[0].uid);

  const st2 = reactState([[0, 'parts-test-4', 2]]);
  applyMut(cat, st2, { type: 'done', player: 0 });
  const p2 = st2.players[0];
  if (p2.choice?.kind === 'remove') applyMut(cat, st2, { type: 'choose', player: 0, value: 0 });
  assert.equal(st2.players[0].garden[0], null);
});

test('連なり：上下左右に、条件に合うカードでつながっている全部（離れた所は入らない）', () => {
  const y = 'parts-test-3';
  const hachi = byName(cat, 'ひだまりハチ'); // 黄
  const st = reactState([[4, y], [5, hachi], [8, hachi], [0, hachi], [2, byName(cat, 'しずくクラゲ')]]);
  const pl = st.players[0];
  assert.equal(countIn(cat, pl, 4, { area: 'connected', filter: { element: 'yellow' } }), 2); // 5 と 8。0 はつながっていない
  pl.garden[1] = { uid: 2000, id: hachi, stage: 1 }; // 1 を置くと 0 もつながる
  assert.equal(countIn(cat, pl, 4, { area: 'connected', filter: { element: 'yellow' } }), 4);
});

test('拡張のお題：L字の形は回す・裏返す・ずらすで4か所。その世界を入れたゲームだけに出る', () => {
  assert.equal(shapePlacements(L5).length, 4);
  const id = 'parts-test:l-mark';
  assert.ok(GOALS[id]);
  assert.ok(goalPool(cat).includes(id));
  assert.ok(!goalPool(buildCatalog([base])).includes(id));
  const blue = byName(cat, 'しずくクラゲ');
  const g = Array(9).fill(null);
  for (const c of [2, 5, 8, 7, 6]) g[c] = { uid: c, id: blue, stage: 2 }; // 右下の角を曲がり角にした L
  assert.ok(GOALS[id].check(cat, g));
  g[6].stage = 1;
  assert.ok(!GOALS[id].check(cat, g));
  assert.ok(GOALS[id].progress(cat, g) > 0.8);
});

test('画面の言葉：溶解・複製・連なり', () => {
  const d = (id) => cat.cards[id];
  assert.deepEqual(stageLines(d('parts-test-1'), 0), ['手入れ：隣の青いカード1枚まで溶解（その★ごとに産出1）']);
  assert.deepEqual(stageLines(d('parts-test-2'), 0), ['手入れ：このカードを複製']);
  assert.deepEqual(stageLines(d('parts-test-3'), 0), ['実り：連なりの黄色いカードごとに1点']);
});

test('CPU：新しい部品のある拡張を混ぜても、2〜4人で最後まで遊べる', () => {
  for (const players of [2, 3, 4]) {
    for (const cpu of ['normal', 'smart']) {
      const { st } = playGame(cat, { players, seed: 50 + players, cpu });
      assert.equal(st.phase, 'end');
    }
  }
});

test('複製は1人1ラウンドに1枚まで（育てる魔素0で、複製→置く→育てるがくり返さない）', () => {
  const st = reactState([[0, 'parts-test-2'], [1, 'parts-test-2']]);
  applyMut(cat, st, { type: 'use', player: 0, cell: 0 });
  applyMut(cat, st, { type: 'use', player: 0, cell: 1 });
  assert.equal(st.players[0].pending.filter((x) => x.id === 'parts-test-2').length, 1);
});

test('自分を溶かす（area: self）は選ばずにすぐ。その前に書いた効果は動く', () => {
  const def = cat.cards['parts-test-4']; // ★★：開花で自分を溶解
  const st = reactState([[0, 'parts-test-4', 2]]);
  applyMut(cat, st, { type: 'done', player: 0 });
  assert.equal(st.players[0].garden[0], null);
  assert.equal(st.players[0].choice?.kind === 'remove', false);
  assert.ok(def);
  assert.deepEqual(stageLines(def, 1), ['開花：このカードを溶解']);
});

// ---- 拡張 Arc-en-ciel Creator で足した部品：進化・融合・斜め ----
const acExp = {
  meta: { id: 'parts-ac', name: '部品の試し2', version: '0.1.0', authors: ['test'] },
  cards: [
    card(1, 'white', 'generate', [[], [], [{ when: 'use', do: 'evolve', into: 'parts-ac-2', amount: 2 }]]),
    { ...card(2, 'white', 'score', [[], [], []]), evolveOnly: true },
    card(3, 'red', 'boost', [0, 1, 2].map(() => [{ when: 'use', do: 'fuse', area: 'adjacent' }])),
    card(4, 'blue', 'score', [[{ when: 'end', do: 'score', amount: 1, per: { area: 'diagonal' } }], [], []]),
  ].map((c) => ({ ...c, id: c.id.replace('parts-test', 'parts-ac') })),
};
const cat2 = buildCatalog([base, acExp]);
function reactState2(cards) {
  const st = createGame(cat2, { players: [{ name: 'A' }, { name: 'B' }], seed: 7, firstPlayer: 0 });
  st.phase = 'react';
  st.players[0].status = 'acting';
  let uid = 3000;
  for (const [cell, id, stage = 1] of cards) st.players[0].garden[cell] = { uid: uid++, id, stage };
  return st;
}

test('進化：決まったカードに替わり★1に戻る、点を得る。進化でだけ出るカードは山に入らない', () => {
  assert.deepEqual(validateExpansion('parts-ac', acExp.meta, acExp.cards), []);
  assert.ok(!cat2.deckIds.includes('parts-ac-2'));
  const st = reactState2([[4, 'parts-ac-1', 3]]);
  applyMut(cat2, st, { type: 'use', player: 0, cell: 4 });
  assert.equal(st.players[0].garden[4].id, 'parts-ac-2');
  assert.equal(st.players[0].garden[4].stage, 1);
  assert.equal(st.players[0].bonus, 2);
  assert.deepEqual(stageLines(cat2.cards['parts-ac-1'], 2), ['手入れ：「試し2」に進化、2点']);
  const bad = validateExpansion('parts-ac', acExp.meta, [card(5, 'white', 'generate', [[{ when: 'use', do: 'evolve', into: 'nowhere' }], [], []])].map((c) => ({ ...c, id: 'parts-ac-5' })));
  assert.ok(bad.some((e) => e.includes('進化先')));
});

test('融合：選んだカードを溶かし、その★の数だけこのカードを育てる。★★★を超える分は1つ1点。しなくてもよい', () => {
  const blue = byName(cat2, 'しずくクラゲ');
  const st = reactState2([[4, 'parts-ac-3'], [1, blue, 2], [3, blue, 3]]);
  applyMut(cat2, st, { type: 'use', player: 0, cell: 4 });
  assert.deepEqual(st.players[0].choice.options, [1, 3]);
  applyMut(cat2, st, { type: 'choose', player: 0, value: 1 });
  assert.equal(st.players[0].garden[1], null);
  assert.equal(st.players[0].garden[4].stage, 3);
  assert.equal(st.players[0].bonus, 0);
  // ★★★で融合すると、育ちきれない分が点になる
  const st3 = reactState2([[4, 'parts-ac-3', 3], [1, blue, 2]]);
  applyMut(cat2, st3, { type: 'use', player: 0, cell: 4 });
  applyMut(cat2, st3, { type: 'choose', player: 0, value: 1 });
  assert.equal(st3.players[0].bonus, 2);
  const st2 = reactState2([[4, 'parts-ac-3'], [1, blue, 2]]);
  applyMut(cat2, st2, { type: 'use', player: 0, cell: 4 });
  applyMut(cat2, st2, { type: 'choose', player: 0, value: null });
  assert.ok(st2.players[0].garden[1]);
  assert.equal(st2.players[0].garden[4].stage, 1);
  assert.deepEqual(stageLines(cat2.cards['parts-ac-3'], 0), ['手入れ：隣のカード1枚まで融合']);
});

test('斜め：斜めの4マス（角は1マス、辺は2マス）', () => {
  const blue = byName(cat2, 'しずくクラゲ');
  const st = reactState2([[4, 'parts-ac-4'], [0, blue], [2, blue], [6, blue], [8, blue], [1, blue]]);
  assert.equal(countIn(cat2, st.players[0], 4, { area: 'diagonal' }), 4);
  assert.equal(countIn(cat2, st.players[0], 0, { area: 'diagonal' }), 1); // 角（0）の斜めは中央（4）だけ
});
