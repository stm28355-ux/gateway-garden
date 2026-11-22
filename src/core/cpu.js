// CPU「ふつう」（D17）：その場で一番得な手を選ぶ。先は読まず、拾う手は「拾ってからこのラウンドの庭をどう触るか」まで試して比べる。
// 好きなときに使う効果（use）は、育て終わった後に良くなるなら使う（#2）。
// CPU「かしこい」（工程8 Q1）：ふつうと同じ形で、見積もりを3つ直したもの。自動対戦で札の強さを測る基準にする（後の「つよい」の土台）。
//   1. 変換を「余った色を要る色に変える力」として高く見る（ふつうは 0.3、かしこいは 0.8）。要らない色からなら変える
//   2. （試したが外した）育ちきる見込みを札ごとに出す reach：入れると弱くなった（2人戦で 56% → 52%）。晩成が育たないのは札の弱さと見る
//   3. まだ満たしていないお題も、進み具合に応じて少し数える
// どちらを使うかは、その席の cpu（'normal'・'smart'）で決まる。
import { ELEMENTS } from './schema.js';
import { GOALS, goalProgress, goalPointsOf } from './goals.js';
import { GROWTH } from './schema.js';
import {
  applyMut, autoPay, buyCost, defOf, stageOf, growCost, limitOf, pickOrder, scoreOf, emptyMana, countIn,
} from './game.js';

const W = { prod: 0.45, mana: 0.5, spare: 0.15, growth: 0.6, goal: 4 }; // 評価の重み（調整で直す）
const PROFILES = {
  normal: { smart: false, convert: 0.3 },
  smart: { smart: true, convert: 0.8, goalProg: 0.6, incomeRate: 0.6, reach: false },
};
// 重みを試すとき用：環境変数 GG_SMART='{"convert":0.5}' で上書き（ブラウザでは使わない）
if (typeof process !== 'undefined' && process.env?.GG_SMART) Object.assign(PROFILES.smart, JSON.parse(process.env.GG_SMART));
const profileOf = (st, p) => PROFILES[st.players[p].cpu] ?? PROFILES.normal;

const clone = (x) => structuredClone(x);
const light = (st) => clone({ ...st, deck: [], discardPile: [] }); // 試すときは山を持たない

// 色ごとの欲しさ：庭の札をあと1段階育てるのに要る数
export function wantOf(cat, pl) {
  const want = emptyMana();
  pl.garden.forEach((inst, cell) => {
    if (inst && inst.stage < 3) want[defOf(cat, inst).element] += growCost(cat, pl, cell);
  });
  for (const card of pl.pending) want[cat.cards[card.id].element] += 1;
  return want;
}

// 毎ラウンドの「生む力」のおおよそ（素材の数で数える）
function prodOf(cat, pl, o = PROFILES.normal) {
  let v = 0;
  pl.garden.forEach((inst, cell) => {
    if (!inst) return;
    for (const e of stageOf(cat, inst).effects) {
      const mult = e.per ? countIn(cat, pl, cell, e.per) : 1;
      const n = (e.amount ?? 1) * mult;
      if (e.when === 'activate' && e.do === 'gain') v += e.color === 'any' ? n * 1.2 : n;
      else if (e.when === 'activate' && e.do === 'convert') v += o.convert * n;
      else if (e.when === 'activate' && e.do === 'stageUp') v += 1.5 * n;
      else if (e.when === 'pick' && e.do === 'bend') v += e.kind === 'add' ? 0.7 : 0.5;
      else if (e.when === 'always' && e.do === 'discount') v += 0.4 * n;
      else if (e.when === 'always' && e.do === 'limit') v += 0.1 * n;
    }
  });
  return v;
}

// 盤面の値打ち。最後のラウンドでは点だけを見る。
// 色ごとの、1ラウンドに入ってくるおおよその数（摘む分 1 ＋ 庭の開花で得る分）
function incomeOf(cat, pl) {
  const inc = Object.fromEntries(ELEMENTS.map((c) => [c, 1]));
  pl.garden.forEach((inst, cell) => {
    if (!inst) return;
    for (const e of stageOf(cat, inst).effects) {
      if (e.when !== 'activate' || e.do !== 'gain') continue;
      const n = (e.amount ?? 1) * (e.per ? countIn(cat, pl, cell, e.per) : 1);
      if (e.color === 'any') for (const c of ELEMENTS) inc[c] += n / 5;
      else if (inc[e.color] !== undefined) inc[e.color] += n;
    }
  });
  return inc;
}

export function valueOf(cat, st, p) {
  const pl = st.players[p];
  const o = profileOf(st, p);
  const left = st.rounds - st.round;
  let v = scoreOf(cat, st, p).total;
  if (left > 0) {
    // 手持ちの素材：育てるのに要る色は高く、要らない色は安く数える（上限を超えた分は数えない）
    const want = wantOf(cat, pl);
    let need = 0;
    let rest = 0;
    for (const c of ELEMENTS) {
      const have = pl.mana[c];
      need += Math.min(have, want[c]);
      rest += Math.max(0, have - want[c]);
    }
    const room = limitOf(cat, pl);
    need = Math.min(need, room);
    rest = Math.min(rest, room - need);
    v += W.prod * prodOf(cat, pl, o) * left + W.mana * need + W.spare * rest;
    // 育てきったときの点の見込み。ふつうは残りのラウンドが少ないほど割り引く。
    // かしこいは、あと要る魔素と、その色が入ってくる速さで割り引く（晩成でも間に合うなら数える）
    const inc = o.smart ? incomeOf(cat, pl) : null;
    pl.garden.forEach((inst, cell) => {
      if (!inst || inst.stage >= 3) return;
      const d = defOf(cat, inst);
      let reach = Math.min(1, left / 3);
      if (o.smart && o.reach) {
        const need3 = growCost(cat, pl, cell) + (inst.stage === 1 ? GROWTH[d.growth][1] : 0);
        reach = Math.min(1, (pl.mana[d.element] + left * inc[d.element] * o.incomeRate) / Math.max(1, need3));
      }
      v += W.growth * reach * ((d.stages[2].points ?? 0) - (d.stages[inst.stage - 1].points ?? 0));
    });
    // かしこいは、まだ満たしていないお題も、進み具合の2乗 × 取れる点 で少し数える
    if (o.smart) {
      for (const g of st.goals) {
        if (st.claims[g].some((x) => x.player === p) || GOALS[g].check(cat, pl.garden)) continue;
        const prog = goalProgress(cat, g, pl.garden);
        v += o.goalProg * prog * prog * goalPointsOf(st.claims[g], st.round) * Math.min(1, left / 2);
      }
    }
  }
  for (const g of st.goals) {
    if (!st.claims[g].some((x) => x.player === p) && GOALS[g].check(cat, pl.garden)) v += W.goal;
  }
  return v;
}

// ---- 選ぶ所 --------------------------------------------------------------

export function chooseValue(cat, st, p) {
  const pl = st.players[p];
  const o = profileOf(st, p);
  const ch = pl.choice;
  const want = wantOf(cat, pl);
  const short = (c) => want[c] - pl.mana[c];
  const best = (list, score) => list.reduce((a, b) => (score(b) > score(a) ? b : a));
  switch (ch.kind) {
    case 'color': return best(ELEMENTS, short);
    case 'convert': {
      const from = best(ch.from, (c) => -short(c));
      const to = ch.to === 'any' ? best(ELEMENTS.filter((c) => c !== from), short) : ch.to;
      // ふつうは余っている色からだけ、かしこいは要らない（足りている）色からでも変える
      return (o.smart ? short(from) <= 0 : short(from) < 0) && short(to) > 0 ? { from, to } : null;
    }
    case 'stageUp': return best(ch.options, (c) => {
      const inst = pl.garden[c];
      const d = defOf(cat, inst);
      return (d.stages[inst.stage].points ?? 0) - (d.stages[inst.stage - 1].points ?? 0);
    });
    case 'move': { // 動かし方を全部試し、今より良くなる中で一番良いもの
      let bestMove = null;
      let bestV = valueOf(cat, st, p);
      for (const from of ch.from) {
        for (let to = 0; to < 9; to++) {
          if (to === from) continue;
          const s = clone(st);
          const g = s.players[p].garden;
          [g[from], g[to]] = [g[to], g[from]];
          const v = valueOf(cat, s, p);
          if (v > bestV + 1e-9) { bestV = v; bestMove = { from, to }; }
        }
      }
      return bestMove;
    }
    case 'discard': {
      const left = { ...pl.mana };
      const out = emptyMana();
      for (let k = 0; k < ch.amount; k++) {
        const c = best(ELEMENTS.filter((x) => left[x] > 0), (x) => -(want[x] - left[x]));
        left[c]--; out[c]++;
      }
      return out;
    }
    default: return null;
  }
}

function settle(cat, st, p) {
  while (st.players[p].choice) applyMut(cat, st, { type: 'choose', player: p, value: chooseValue(cat, st, p) });
  return st;
}

// ---- 反応フェーズ（庭を触る） --------------------------------------------

function placeCandidates(pl) {
  const empty = pl.garden.map((x, i) => (x ? -1 : i)).filter((i) => i >= 0);
  return empty.length ? empty : [0, 1, 2, 3, 4, 5, 6, 7, 8];
}

function bestPlace(cat, st, p) {
  let best = null;
  for (const cell of placeCandidates(st.players[p])) {
    const s = settle(cat, applyMut(cat, clone(st), { type: 'place', player: p, pending: 0, cell }), p);
    const v = valueOf(cat, s, p);
    if (!best || v > best.v) best = { v, cell, s };
  }
  return best;
}

function bestGrow(cat, st, p) {
  const pl = st.players[p];
  let best = null;
  pl.garden.forEach((inst, cell) => {
    if (!inst || inst.stage >= 3 || pl.mana[defOf(cat, inst).element] < growCost(cat, pl, cell)) return;
    const s = settle(cat, applyMut(cat, clone(st), { type: 'grow', player: p, cell }), p);
    const v = valueOf(cat, s, p);
    if (!best || v > best.v) best = { v, cell, s };
  });
  return best;
}

// 好きなときに使う効果（#2）：まだ使っていない札を試す
function bestUse(cat, st, p) {
  const pl = st.players[p];
  let best = null;
  pl.garden.forEach((inst, cell) => {
    if (!inst || pl.used.includes(inst.uid) || !stageOf(cat, inst).effects.some((e) => e.when === 'use')) return;
    const s = settle(cat, applyMut(cat, clone(st), { type: 'use', player: p, cell }), p);
    const v = valueOf(cat, s, p);
    if (!best || v > best.v) best = { v, cell };
  });
  return best;
}

// このラウンドの庭の触り方を、置く→育てるの順に欲張りで決めて、その後の盤面を返す
function greedyReact(cat, st, p) {
  let s = st;
  while (s.players[p].pending.length) s = bestPlace(cat, s, p).s;
  for (;;) {
    const g = bestGrow(cat, s, p);
    if (!g || g.v <= valueOf(cat, s, p)) return s;
    s = g.s;
  }
}

// ---- 拾うフェーズ ----------------------------------------------------------

function bendCells(cat, pl, kind) {
  return pl.garden.map((inst, cell) => (inst && stageOf(cat, inst).effects.some((e) => e.when === 'pick' && e.do === 'bend' && e.kind === kind) ? cell : -1))
    .filter((c) => c >= 0);
}

function bundleScore(colors, want, mana) {
  const left = { ...mana };
  let v = 0;
  for (const c of colors) { v += left[c] < want[c] ? 1 : 0.5; left[c]++; }
  return v;
}

function bestSwap(st, b, cell, want, mana) {
  let best = null;
  st.bundles.forEach((other, j) => {
    if (j === b) return;
    for (let give = 0; give < 3; give++) {
      for (let k = 0; k < 3; k++) {
        const t = [...st.bundles[b]];
        t[give] = other[k];
        const v = bundleScore(t, want, mana);
        if (!best || v > best.v) best = { v, bend: { cell, kind: 'swap', give, other: j, otherIdx: k } };
      }
    }
  });
  return best?.bend;
}

function pickCandidates(cat, st, p) {
  const pl = st.players[p];
  const want = wantOf(cat, pl);
  const adds = bendCells(cat, pl, 'add').map((cell) => ({ cell, kind: 'add' }));
  const swaps = bendCells(cat, pl, 'swap');
  const out = [];
  st.bundles.forEach((_, b) => {
    const bendSets = [adds];
    if (swaps.length) bendSets.push([bestSwap(st, b, swaps[0], want, pl.mana), ...adds]);
    for (const bends of bendSets) {
      const base = { type: 'pick', player: p, bundle: b, bends, buy: null };
      out.push(base);
      const after = applyMut(cat, light(st), base).players[p].mana;
      const payFor = (idxs) => { // 順に払えるか試す。2枚目は値段に任1が足される
        const left = { ...after };
        const buys = [];
        for (const [k, i] of idxs.entries()) {
          const pay = autoPay(buyCost(cat, st.market[i], k), left, want);
          if (!pay) return null;
          for (const c of ELEMENTS) left[c] -= pay[c];
          buys.push({ market: i, pay });
        }
        return buys;
      };
      const idx = st.market.map((c, i) => (c ? i : -1)).filter((i) => i >= 0);
      for (const i of idx) {
        const buys = payFor([i]);
        if (!buys) continue;
        out.push({ ...base, buys });
        for (const j of idx) {
          if (j <= i) continue;
          const two = payFor([i, j]) ?? payFor([j, i]);
          if (two) out.push({ ...base, buys: two });
        }
      }
    }
  });
  return out;
}

function evalPick(cat, st, p, action) {
  const s = applyMut(cat, light(st), action);
  if (s.phase !== 'react') { // 自分の後にまだ拾う人がいる：自分だけ庭を触る形で試す
    s.phase = 'react';
    s.players[p].status = 'acting';
  }
  return valueOf(cat, greedyReact(cat, s, p), p);
}

// ---- 入口 ----------------------------------------------------------------

export function cpuAction(cat, st, p) {
  const pl = st.players[p];
  if (pl.choice) return { type: 'choose', player: p, value: chooseValue(cat, st, p) };
  if (st.phase === 'draft' && st.draftOrder[st.turn] === p) {
    let best = null;
    st.market.forEach((card, i) => {
      if (!card) return;
      const s = light(st);
      s.players[p].pending.push(card);
      s.phase = 'react';
      s.players[p].status = 'acting';
      const v = valueOf(cat, greedyReact(cat, s, p), p) - 0.3 * Object.values(cat.cards[card.id].cost).reduce((a, b) => a + b, 0);
      if (!best || v > best.v) best = { v, i };
    });
    return { type: 'draft', player: p, market: best.i };
  }
  if (st.phase === 'pick' && pickOrder(st)[st.turn] === p) {
    let best = null;
    for (const a of pickCandidates(cat, st, p)) {
      const v = evalPick(cat, st, p, a);
      if (!best || v > best.v) best = { v, a };
    }
    return best.a;
  }
  if (st.phase === 'react' && pl.status === 'acting') {
    if (pl.pending.length) return { type: 'place', player: p, pending: 0, cell: bestPlace(cat, st, p).cell };
    const now = valueOf(cat, st, p);
    const g = bestGrow(cat, st, p);
    if (g && g.v > now) return { type: 'grow', player: p, cell: g.cell };
    const u = bestUse(cat, st, p);
    if (u && u.v > now) return { type: 'use', player: p, cell: u.cell };
    return { type: 'done', player: p };
  }
  return null;
}
