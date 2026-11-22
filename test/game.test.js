import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction, applyMut, autoPay, canPay, createGame, emptyMana, growCost, limitOf, scoreOf, whoActs, GameError,
} from '../src/core/game.js';
import { GOALS } from '../src/core/goals.js';
import { playGame } from '../src/core/autoplay.js';
import { baseCatalog, byName } from './helpers.js';

const cat = baseCatalog();

// 反応フェーズの1人の庭を、決めた札で作って試す
function reactState(cards, mana = {}) {
  const st = createGame(cat, { players: [{ name: 'A' }, { name: 'B' }], seed: 7 });
  st.phase = 'react';
  const pl = st.players[0];
  pl.status = 'acting';
  let uid = 1000;
  for (const [cell, name, stage = 1] of cards) pl.garden[cell] = { uid: uid++, id: byName(cat, name), stage };
  Object.assign(pl.mana, mana);
  return st;
}

test('同じ種なら同じゲームになる', () => {
  const a = playGame(cat, { players: 3, seed: 42 });
  const b = playGame(cat, { players: 3, seed: 42 });
  assert.deepEqual(a.st.result, b.st.result);
  assert.equal(a.actions.length, b.actions.length);
});

test('CPU どうしで 2〜4人が最後まで遊べる', () => {
  for (const players of [2, 3, 4]) {
    const { st } = playGame(cat, { players, seed: players });
    assert.equal(st.phase, 'end');
    assert.equal(st.result.length, players);
    assert.ok(st.result.some((r) => r.rank === 1));
    for (const pl of st.players) assert.ok(pl.garden.filter(Boolean).length >= 4, '庭に札が並ぶ');
  }
});

test('始まりは手番の逆順に1枚ずつ取り、場は6枚・束は人数で4か5（D1・D6・D7）', () => {
  const st = createGame(cat, { players: [{ name: 'A' }, { name: 'B' }, { name: 'C' }], seed: 3 });
  assert.deepEqual(st.draftOrder, [2, 1, 0]);
  assert.equal(st.market.length, 6);
  assert.equal(st.bundles.length, 5);
  assert.equal(createGame(cat, { players: [{ name: 'A' }, { name: 'B' }] }).bundles.length, 4);
  assert.throws(() => applyAction(cat, st, { type: 'draft', player: 0, market: 0 }), GameError);
  const s2 = applyAction(cat, st, { type: 'draft', player: 2, market: 0 });
  assert.equal(s2.players[2].pending.length, 1);
  assert.ok(s2.market[0], '取ったらすぐ補充');
});

test('先番はラウンドごとに左へ回る（D2）', () => {
  const { st } = playGame(cat, { players: 3, seed: 5, rounds: 2 });
  assert.equal(st.firstPlayer, 1);
});

test('支払い：決まった色と「任」', () => {
  const mana = { ...emptyMana(), red: 2, blue: 1 };
  assert.ok(canPay({ red: 2 }, { red: 2 }, mana));
  assert.ok(!canPay({ red: 2 }, { red: 1, blue: 1 }, mana));
  assert.ok(canPay({ red: 1, any: 1 }, { red: 1, blue: 1 }, mana));
  assert.ok(!canPay({ red: 1 }, { red: 2 }, mana), '払いすぎ');
  assert.deepEqual(autoPay({ blue: 1, any: 1 }, mana), { ...emptyMana(), blue: 1, red: 1 });
  assert.equal(autoPay({ green: 1 }, mana), null);
});

test('育てる値段は上がり方どおり、強化で0個まで下がる（読み方4・フェーズ4）', () => {
  const st = reactState([[4, '芽吹きリス'], [1, '庭師モグラ'], [3, '応援ダヌキ', 2]]);
  const pl = st.players[0];
  // 晩成 3 から、モグラ（隣の緑-1）とタヌキ段階2（隣の札-1）で 1
  assert.equal(growCost(cat, pl, 4), 1);
  assert.equal(growCost(cat, pl, 1), 3, 'モグラ（マス1）はタヌキ（マス3）の隣ではないので晩成の3のまま');
  pl.garden[5] = { uid: 2000, id: byName(cat, '蜜運びアリ'), stage: 2 }; // マス4 の隣で、もう-1
  pl.garden[7] = { uid: 2001, id: byName(cat, '水やりカエル'), stage: 2 }; // さらに-1 しても 0 で止まる
  assert.equal(growCost(cat, pl, 4), 0);
  pl.mana.green = 0;
  const s = applyAction(cat, st, { type: 'grow', player: 0, cell: 4 });
  assert.equal(s.players[0].garden[4].stage, 2, '0個なら魔素なしで育てられる');
});

test('庭番カメ：段階1は隣の白、段階2は隣、段階3は同じ行と列', () => {
  const st = reactState([[0, '庭番カメ'], [1, '灯りうさぎ'], [3, '火の粉トカゲ'], [2, '芽吹きリス']]);
  const pl = st.players[0];
  assert.deepEqual([growCost(cat, pl, 1), growCost(cat, pl, 3), growCost(cat, pl, 2)], [0, 2, 3]);
  pl.garden[0].stage = 2;
  assert.deepEqual([growCost(cat, pl, 1), growCost(cat, pl, 3), growCost(cat, pl, 2)], [0, 1, 3]);
  pl.garden[0].stage = 3;
  assert.deepEqual([growCost(cat, pl, 1), growCost(cat, pl, 3), growCost(cat, pl, 2)], [0, 1, 2]);
});

test('育てると段階が上がり、払った魔素が減る', () => {
  const st = reactState([[0, '道しるべフクロウ']], { white: 2 }); // 平ら：段階1→2 は2個
  const s = applyAction(cat, st, { type: 'grow', player: 0, cell: 0 });
  assert.equal(s.players[0].garden[0].stage, 2);
  assert.equal(s.players[0].mana.white, 0);
  assert.throws(() => applyAction(cat, s, { type: 'grow', player: 0, cell: 0 }), /足りない/);
});

test('反応フェーズで得た魔素はその場で使える（フェーズ4で D3 を変更）', () => {
  const st = reactState([[0, '狼煙ギツネ']]);
  st.players[0].pending.push({ uid: 1, id: byName(cat, '狼煙ギツネ') });
  let s = applyAction(cat, st, { type: 'place', player: 0, pending: 0, cell: 4 });
  assert.equal(s.players[0].mana.red, 2);
  s = applyAction(cat, s, { type: 'grow', player: 0, cell: 4 }); // 早熟 1個
  assert.equal(s.players[0].mana.red, 1);
});

test('連鎖：段階が上がると隣を発動、同じ札は1回だけ（読み方6）', () => {
  // ハリネズミ段階1→2 で隣（灯りうさぎ2枚）が発動して白を生み、その白ですぐ育てられる
  const st = reactState([[4, '鈴のハリネズミ'], [1, '灯りうさぎ'], [3, '灯りうさぎ'], [5, '伝書バト', 2]], { white: 2 });
  let s = applyAction(cat, st, { type: 'grow', player: 0, cell: 4 });
  assert.equal(s.players[0].mana.white, 2);
  s = applyAction(cat, s, { type: 'grow', player: 0, cell: 1 });
  assert.equal(s.players[0].garden[1].stage, 2);
});

test('札は1回の拾いで2枚まで、2枚目は任1が足される（フェーズ4）', () => {
  const st = createGame(cat, { players: [{ name: 'A' }, { name: 'B' }], seed: 11 });
  st.phase = 'pick';
  st.bundles[0] = ['red', 'red', 'red'];
  st.market[0] = { uid: 501, id: byName(cat, '狼煙ギツネ') }; // 赤1
  st.market[1] = { uid: 502, id: byName(cat, '灯りうさぎ') }; // 白1 → 2枚目は 白1・任1
  Object.assign(st.players[0].mana, { white: 1 });
  const pay = (o) => ({ white: 0, red: 0, blue: 0, green: 0, yellow: 0, ...o });
  const ok = applyAction(cat, st, { type: 'pick', player: 0, bundle: 0, bends: [], buys: [
    { market: 0, pay: pay({ red: 1 }) }, { market: 1, pay: pay({ white: 1, red: 1 }) }] });
  assert.equal(ok.players[0].pending.length, 2);
  assert.equal(ok.players[0].mana.red, 1);
  assert.ok(ok.market[0] && ok.market[1], '両方補充');
  assert.throws(() => applyAction(cat, st, { type: 'pick', player: 0, bundle: 0, bends: [], buys: [
    { market: 0, pay: pay({ red: 1 }) }, { market: 1, pay: pay({ white: 1 }) }] }), /払う/);
});

test('置かずに持てる札は2枚まで（保持）', () => {
  const st = reactState([]);
  const pl = st.players[0];
  for (const k of [1, 2, 3]) pl.pending.push({ uid: k, id: byName(cat, '灯りうさぎ') });
  assert.throws(() => applyAction(cat, st, { type: 'done', player: 0 }), /2枚まで/);
  let s = applyAction(cat, st, { type: 'place', player: 0, pending: 0, cell: 0 });
  s = applyAction(cat, s, { type: 'done', player: 0 });
  assert.equal(s.players[0].pending.length, 2, '持っておいた札は次のラウンドも手元に');
});

test('やり直し：反応フェーズの自分の操作を1つずつ戻せる。終えた後は戻せない', () => {
  const st = reactState([[0, '道しるべフクロウ']], { white: 2 });
  st.players[0].pending.push({ uid: 9, id: byName(cat, '狼煙ギツネ') });
  let s = applyAction(cat, st, { type: 'place', player: 0, pending: 0, cell: 4 });
  s = applyAction(cat, s, { type: 'grow', player: 0, cell: 0 });
  s = applyAction(cat, s, { type: 'undo', player: 0 });
  assert.equal(s.players[0].garden[0].stage, 1);
  assert.equal(s.players[0].mana.white, 2);
  s = applyAction(cat, s, { type: 'undo', player: 0 });
  assert.equal(s.players[0].garden[4], null);
  assert.equal(s.players[0].pending.length, 1);
  assert.throws(() => applyAction(cat, s, { type: 'undo', player: 0 }), /戻せる/);
  s = applyAction(cat, s, { type: 'place', player: 0, pending: 0, cell: 4 });
  s = applyAction(cat, s, { type: 'done', player: 0 });
  assert.throws(() => applyAction(cat, s, { type: 'undo', player: 0 }), /戻せる/);
});

test('段階+1 は1枚を選び、選んだ札の「その段階になったとき」も動く（読み方5・6）', () => {
  // ミミズを段階3へ → 隣の緑1枚を段階+1（候補が2枚なので選ぶ）
  const st = reactState([[4, '根っこのミミズ', 2], [1, '芽吹きリス'], [7, '発酵キノコ']], { green: 4 }); // 晩成：段階2→3 は4個
  let s = applyAction(cat, st, { type: 'grow', player: 0, cell: 4 });
  assert.equal(s.players[0].choice.kind, 'stageUp');
  assert.deepEqual(s.players[0].choice.options, [1, 7]);
  s = applyAction(cat, s, { type: 'choose', player: 0, value: 7 });
  assert.equal(s.players[0].garden[7].stage, 2);
});

test('好きな色を得る・色を変えるは選ぶ。変換は途中で止められる', () => {
  const st = reactState([[0, 'しずくクラゲ'], [1, '水車のビーバー', 2]], { red: 3 });
  let s = applyAction(cat, st, { type: 'done', player: 0 });
  assert.equal(s.players[0].choice.kind, 'color');
  s = applyAction(cat, s, { type: 'choose', player: 0, value: 'blue' });
  assert.equal(s.players[0].choice.kind, 'convert');
  s = applyAction(cat, s, { type: 'choose', player: 0, value: { from: 'red', to: 'green' } });
  s = applyAction(cat, s, { type: 'choose', player: 0, value: null });
  assert.equal(s.players[0].status, 'done');
  assert.deepEqual([s.players[0].mana.red, s.players[0].mana.green, s.players[0].mana.blue], [2, 1, 1]);
});

test('黄の「貯めて点」：終わりに残った素材の数で点（#1 の直し）', () => {
  const st = reactState([[0, 'ひだまりハチ', 3], [1, '両替カラス', 2]], { red: 7, blue: 2 });
  // ハチ：9個÷2＝4点、カラス段階2：9個÷4＝2点
  assert.equal(scoreOf(cat, st, 0).end, 4 + 2);
  assert.equal(limitOf(cat, st.players[0]), 10);
});

test('選ぶ所には効果を出している札が付く。最後のラウンドは選ばずに捨てる', () => {
  const st = reactState([[3, 'しずくクラゲ']]);
  const s = applyAction(cat, st, { type: 'done', player: 0 });
  assert.equal(s.players[0].choice.source, s.players[0].garden[3].uid);
  const last = reactState([[0, '灯りうさぎ']], { red: 12 });
  last.round = last.rounds;
  const e = applyAction(cat, last, { type: 'done', player: 0 });
  assert.equal(e.players[0].choice, null);
  assert.equal(e.players[0].discarded, 3); // 12＋白1 → 10
  assert.equal(e.players[0].status, 'done');
});

test('上限を超えたら反応フェーズの終わりに選んで捨てる（D4）', () => {
  const st2 = reactState([[0, '灯りうさぎ']], { red: 10 });
  let s = applyAction(cat, st2, { type: 'done', player: 0 });
  assert.deepEqual(s.players[0].choice, { kind: 'discard', amount: 1 });
  assert.throws(() => applyAction(cat, s, { type: 'choose', player: 0, value: { red: 2 } }), /1 個/);
  s = applyAction(cat, s, { type: 'choose', player: 0, value: { white: 1 } });
  assert.equal(s.players[0].discarded, 1);
  assert.equal(s.players[0].status, 'done');
});

test('拾う：入れ替えてから取り、足すは入れ替えた後の束で見る（D12）', () => {
  const st = createGame(cat, { players: [{ name: 'A' }, { name: 'B' }], seed: 9 });
  st.phase = 'pick';
  const pl = st.players[0];
  pl.garden[0] = { uid: 900, id: byName(cat, '道しるべフクロウ'), stage: 2 };
  pl.garden[1] = { uid: 901, id: byName(cat, '狼煙ギツネ'), stage: 2 };
  st.bundles = [['white', 'white', 'white'], ['red', 'blue', 'green'], ['yellow', 'yellow', 'yellow'], ['blue', 'blue', 'blue']];
  const s = applyAction(cat, st, {
    type: 'pick', player: 0, bundle: 0, buy: null,
    bends: [{ cell: 0, kind: 'swap', give: 0, other: 1, otherIdx: 0 }, { cell: 1, kind: 'add' }],
  });
  assert.deepEqual([s.players[0].mana.white, s.players[0].mana.red], [2, 2]); // 赤を入れ替えて取り、ギツネで赤+1
  assert.deepEqual(s.bundles[1], ['white', 'blue', 'green']);
  assert.throws(() => applyAction(cat, st, { type: 'pick', player: 0, bundle: 0, bends: [{ cell: 1, kind: 'swap', give: 0, other: 1, otherIdx: 0 }] }), /使えない/);
});

test('9マスが埋まるまで置き換えはできない（D15）', () => {
  const names = ['灯りうさぎ', '火の粉トカゲ', 'しずくクラゲ', '芽吹きリス', 'ひだまりハチ', '鏡のネコ', 'るつぼガニ', '発酵キノコ'];
  const st = reactState(names.map((n, i) => [i, n]));
  st.players[0].pending.push({ uid: 5, id: byName(cat, '長老の木') });
  assert.throws(() => applyAction(cat, st, { type: 'place', player: 0, pending: 0, cell: 0 }), /空きマス/);
  let s = applyAction(cat, st, { type: 'place', player: 0, pending: 0, cell: 8 });
  s.players[0].pending.push({ uid: 6, id: byName(cat, '旗持ちイヌ') });
  s = applyAction(cat, s, { type: 'place', player: 0, pending: 0, cell: 0 });
  assert.equal(s.discardPile.length, 1);
});

test('得点：段階の点・終わりの効果・目標札（一番乗り5点・後から3点）', () => {
  const st = reactState([[4, '星読みヤギ', 3], [0, '灯りうさぎ', 3], [1, '旗持ちイヌ', 3], [2, '火の粉トカゲ']]);
  st.goals = ['big-tree', 'four-corners', 'lush'];
  st.claims = { 'big-tree': [{ player: 1, round: 1 }, { player: 0, round: 2 }], 'four-corners': [], lush: [] };
  const sc = scoreOf(cat, st, 0);
  assert.equal(sc.stage, 2 + 2 + 1); // ヤギ2・うさぎ2・イヌ1（トカゲ段階1は0）
  assert.equal(sc.end, 3 + 3 + 2); // ヤギ：中央3＋段階3が3枚（ヤギ・うさぎ・イヌ）、イヌ：隣の赤（トカゲ）1枚×2
  assert.equal(sc.goals, 3);
  assert.ok(GOALS['big-tree'].check(cat, st.players[0].garden));
});

test('好きなときに使う効果：1ラウンド1回、札を動かす（#2）', () => {
  const mover = { id: 'test-move', name: '動かす札', element: 'white', role: 'boost', growth: 'flat', cost: { white: 1 }, origin: 'test',
    stages: [{ effects: [{ when: 'use', do: 'move', area: 'garden' }] }, { effects: [] }, { points: 1, effects: [] }] };
  const c2 = { ...cat, cards: { ...cat.cards, 'test-move': mover } };
  const st = reactState([[1, '灯りうさぎ']]);
  st.players[0].garden[0] = { uid: 77, id: 'test-move', stage: 1 };
  let s = applyAction(c2, st, { type: 'use', player: 0, cell: 0 });
  assert.equal(s.players[0].choice.kind, 'move');
  s = applyAction(c2, s, { type: 'choose', player: 0, value: { from: 1, to: 8 } });
  assert.equal(s.players[0].garden[1], null);
  assert.equal(s.players[0].garden[8].stage, 1);
  assert.throws(() => applyAction(c2, s, { type: 'use', player: 0, cell: 0 }), /もう使った/);
});

test('CPU は「使う」で札を動かして得になるなら使う（#2）', async () => {
  const { cpuAction } = await import('../src/core/cpu.js');
  const mover = { id: 'test-move', name: '動かす札', element: 'white', role: 'boost', growth: 'flat', cost: { white: 1 }, origin: 'test',
    stages: [{ effects: [{ when: 'use', do: 'move', area: 'garden' }] }, { effects: [] }, { points: 1, effects: [] }] };
  const c2 = { ...cat, cards: { ...cat.cards, 'test-move': mover } };
  // 星読みヤギ（中央なら3点）が角にいる。最後のラウンドなので点だけを見る
  const st = reactState([[0, '星読みヤギ', 2]]);
  st.round = st.rounds;
  st.players[0].garden[8] = { uid: 78, id: 'test-move', stage: 1 };
  const a = cpuAction(c2, st, 0);
  assert.deepEqual(a, { type: 'use', player: 0, cell: 8 });
  const s = applyAction(c2, st, a);
  assert.deepEqual(cpuAction(c2, s, 0).value, { from: 0, to: 4 });
});

test('whoActs：拾うのは1人ずつ、反応は全員同時', () => {
  const st = createGame(cat, { players: [{ name: 'A' }, { name: 'B' }, { name: 'C' }], seed: 1 });
  assert.deepEqual(whoActs(st), [2]);
  const s = applyMut(cat, st, { type: 'draft', player: 2, market: 0 });
  applyMut(cat, s, { type: 'draft', player: 1, market: 0 });
  applyMut(cat, s, { type: 'draft', player: 0, market: 0 });
  assert.deepEqual(whoActs(s), [0]);
  for (const p of [0, 1, 2]) applyMut(cat, s, { type: 'pick', player: p, bundle: 0, bends: [], buy: null });
  assert.deepEqual(whoActs(s), [0, 1, 2]);
});
