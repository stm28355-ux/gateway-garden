// ルールの心臓部。画面と通信から切り離した純粋な処理：applyAction(catalog, state, action) → 新しい状態。
// 状態は JSON にできる形だけで持つ（通信対戦でそのまま送れる）。乱数は st.rng（種つき）。
// ルールの番号（D1〜D18）はフェーズ1、効果の読み方1〜8はフェーズ2の決定（CONTRIBUTING.md）。
import { ELEMENTS, GROWTH } from './schema.js';
import { randInt, shuffle } from './rng.js';
import { CELLS, areaCells, adjacent, position } from './garden.js';
import { GOALS, goalPool, goalPointsOf, registerGoal } from './goals.js';

export const BASE_LIMIT = 10;  // D4
export const MARKET_SIZE = 6;  // D7
export const GOAL_COUNT = 3;   // D13
export const BUNDLE_SIZE = 3;  // D6
export const MAX_BUYS = 2;     // フェーズ4：1回の拾いで札は2枚まで。2枚目は値段に「任1」が足される
export const HAND_LIMIT = 2;   // フェーズ4：置かずに持っておける札は2枚まで（保持）

export class GameError extends Error {}
const fail = (msg) => { throw new GameError(msg); };

export const emptyMana = () => Object.fromEntries(ELEMENTS.map((c) => [c, 0]));
export const manaTotal = (m) => ELEMENTS.reduce((s, c) => s + m[c], 0);

// ---- 札の一覧 ----------------------------------------------------------

export function buildCatalog(expansions) {
  const cards = {};
  const deckIds = [];
  for (const { meta, cards: list } of expansions) {
    for (const g of meta.goals ?? []) registerGoal(meta.id, g); // 拡張のお題（その世界を入れたゲームだけに出る）
    for (const c of list) {
      cards[c.id] = { ...c, origin: meta.id };
      deckIds.push(c.id);
    }
  }
  return {
    cards, deckIds,
    versions: Object.fromEntries(expansions.map((e) => [e.meta.id, e.meta.version])),
  };
}

export const defOf = (cat, inst) => cat.cards[inst.id];
export const stageOf = (cat, inst) => defOf(cat, inst).stages[inst.stage - 1];
const effectsOf = (cat, inst) => stageOf(cat, inst).effects;

// ---- 範囲と条件 ----------------------------------------------------------

export function matches(cat, pl, srcCell, cell, filter) {
  const inst = pl.garden[cell];
  if (filter?.empty) return !inst;
  if (!inst) return false;
  if (!filter) return true;
  const d = defOf(cat, inst);
  const src = defOf(cat, pl.garden[srcCell]);
  if (filter.element !== undefined && (filter.element === 'self' ? src.element : filter.element) !== d.element) return false;
  if (filter.role !== undefined && filter.role !== d.role) return false;
  if (filter.minStage !== undefined && inst.stage < filter.minStage) return false;
  if (filter.origin === 'same' && d.origin !== src.origin) return false;
  if (filter.origin === 'other' && d.origin === src.origin) return false;
  if (filter.position !== undefined && position(cell) !== filter.position) return false;
  return true;
}

// 範囲のマス。連なり（connected）は、このカードから上下左右に、条件に合うカードでつながっている全部（自分は入らない）
export function cellsIn(cat, pl, src, area, filter) {
  if (area !== 'connected') return areaCells(area, src);
  const seen = new Set([src]);
  const out = [];
  const queue = [src];
  while (queue.length) {
    for (const n of adjacent(queue.shift())) {
      if (seen.has(n)) continue;
      seen.add(n);
      if (matches(cat, pl, src, n, filter)) { out.push(n); queue.push(n); }
    }
  }
  return out;
}

export const countIn = (cat, pl, srcCell, { area, filter }) =>
  cellsIn(cat, pl, srcCell, area, filter).filter((c) => matches(cat, pl, srcCell, c, filter)).length;

function condOk(cat, pl, cell, eff) {
  if (eff.at && position(cell) !== eff.at) return false;
  if (eff.if && countIn(cat, pl, cell, eff.if) < eff.if.atLeast) return false;
  return true;
}
const multOf = (cat, pl, cell, eff) => (eff.per ? countIn(cat, pl, cell, eff.per) : 1);

// 常に効く効果の合計（discount・limit）
function alwaysSum(cat, pl, doName, targetCell) {
  let sum = 0;
  pl.garden.forEach((inst, j) => {
    if (!inst) return;
    for (const e of effectsOf(cat, inst)) {
      if (e.when !== 'always' || e.do !== doName || !condOk(cat, pl, j, e)) continue;
      if (targetCell !== undefined) {
        if (!cellsIn(cat, pl, j, e.area, e.filter).includes(targetCell) || !matches(cat, pl, j, targetCell, e.filter)) continue;
      }
      sum += e.amount * multOf(cat, pl, j, e);
    }
  });
  return sum;
}

export function growCost(cat, pl, cell) {
  const inst = pl.garden[cell];
  const base = GROWTH[defOf(cat, inst).growth][inst.stage - 1];
  return Math.max(0, base - alwaysSum(cat, pl, 'discount', cell)); // 読み方4（フェーズ4で変更）：0個まで下がる
}
export const limitOf = (cat, pl) => BASE_LIMIT + alwaysSum(cat, pl, 'limit');

// ---- 支払い ------------------------------------------------------------

export function canPay(cost, pay, mana) {
  let need = cost.any ?? 0;
  let paid = 0;
  for (const c of ELEMENTS) {
    const v = pay?.[c] ?? 0;
    if (!Number.isInteger(v) || v < 0 || v > mana[c]) return false;
    if ((cost[c] ?? 0) > v) return false;
    need += cost[c] ?? 0;
    paid += v;
  }
  return paid === need;
}

// 決まった色を先に払い、「任」は want（色ごとの欲しさ）が小さい色から払う。払えなければ null。
export function autoPay(cost, mana, want = emptyMana()) {
  const pay = emptyMana();
  for (const c of ELEMENTS) {
    if ((cost[c] ?? 0) > mana[c]) return null;
    pay[c] = cost[c] ?? 0;
  }
  for (let k = 0; k < (cost.any ?? 0); k++) {
    const opts = ELEMENTS.filter((c) => mana[c] - pay[c] > 0);
    if (!opts.length) return null;
    opts.sort((a, b) => (want[a] - want[b]) || ((mana[b] - pay[b]) - (mana[a] - pay[a])));
    pay[opts[0]]++;
  }
  return pay;
}

// ---- はじめる ------------------------------------------------------------

function randomBundle(st) {
  return Array.from({ length: BUNDLE_SIZE }, () => ELEMENTS[randInt(st, ELEMENTS.length)]);
}
const draw = (st) => st.deck.shift() ?? null;

export function pickOrder(st) {
  const n = st.players.length;
  return Array.from({ length: n }, (_, k) => (st.firstPlayer + k) % n);
}

// 1種類あたりの枚数：ふつうは2枚。山が60枚に届かない世界の組み合わせ（拡張だけで遊ぶときなど）は増やす（工程8：拡張だけの4人戦で山が尽きた）
export const copiesFor = (cat) => Math.max(2, Math.ceil(60 / cat.deckIds.length));

export function createGame(cat, { players, rounds = 8, seed = 1, copies = copiesFor(cat), firstPlayer = null }) {
  if (players.length < 2 || players.length > 4) fail('2〜4人で遊ぶ');
  const st = {
    rng: seed | 0, round: 1, rounds, phase: 'draft', turn: 0, firstPlayer: 0, uidNext: 1,
    versions: cat.versions,
    players: players.map((p, i) => ({
      index: i, name: p.name, cpu: p.cpu ?? null,
      mana: emptyMana(), garden: Array(9).fill(null), pending: [],
      status: 'waiting', queue: [], choice: null, used: [], chains: {}, chainNext: 0, groupNext: 0, history: [],
      bonus: 0, discarded: 0,
    })),
    deck: [], market: [], bundles: [], discardPile: [], goals: [], claims: {}, result: null,
  };
  for (const id of cat.deckIds) for (let k = 0; k < copies; k++) st.deck.push({ uid: st.uidNext++, id });
  shuffle(st, st.deck);
  st.market = Array.from({ length: MARKET_SIZE }, () => draw(st));
  st.bundles = Array.from({ length: players.length === 2 ? 4 : 5 }, () => randomBundle(st)); // D6
  st.goals = shuffle(st, goalPool(cat)).slice(0, GOAL_COUNT);
  for (const g of st.goals) st.claims[g] = [];
  // 最初の先番は種で決める（工程10 の前の確かめ：いつも同じ席が最後に招くのをやめる）。決めて試すときは firstPlayer を渡す
  st.firstPlayer = firstPlayer ?? randInt(st, players.length);
  st.draftOrder = [...pickOrder(st)].reverse(); // D1：手番の逆順
  return st;
}

// ---- 得点 ----------------------------------------------------------------

export function scoreOf(cat, st, p) {
  const pl = st.players[p];
  let stage = 0;
  let end = 0;
  let stage3 = 0;
  pl.garden.forEach((inst, cell) => {
    if (!inst) return;
    stage += stageOf(cat, inst).points ?? 0;
    if (inst.stage === 3) stage3++;
    for (const e of effectsOf(cat, inst)) {
      if (e.when !== 'end' || !condOk(cat, pl, cell, e)) continue;
      if (e.do === 'score') end += e.amount * multOf(cat, pl, cell, e);
      if (e.do === 'hoard') end += Math.floor(manaTotal(pl.mana) / e.every) * e.amount * multOf(cat, pl, cell, e);
    }
  });
  let goals = 0;
  for (const g of st.goals) {
    const list = st.claims[g];
    const mine = list.find((x) => x.player === p);
    if (!mine) continue;
    goals += goalPointsOf(list, mine.round);
  }
  return { stage, end, goals, bonus: pl.bonus, total: stage + end + goals + pl.bonus, stage3 };
}

function finish(cat, st) {
  const scores = st.players.map((_, p) => ({ player: p, ...scoreOf(cat, st, p) }));
  const better = (a, b) => (b.total - a.total) || (b.stage3 - a.stage3); // D18
  const sorted = [...scores].sort(better);
  for (const s of scores) s.rank = 1 + sorted.filter((o) => better(s, o) > 0).length;
  st.phase = 'end';
  st.result = scores;
}

// ---- 効果を動かす（順番待ちの列と、選ぶ所） -----------------------------

const cellOfUid = (pl, uid) => pl.garden.findIndex((x) => x?.uid === uid);

function addGain(pl, color, n) {
  pl.mana[color] += n; // フェーズ4で D3 を変えた：反応フェーズで得た魔素はその場で使える
}

function newChain(pl) {
  const id = ++pl.chainNext;
  pl.chains[id] = [];
  return id;
}

function effectTasks(cat, inst, when, chain) {
  return effectsOf(cat, inst).filter((e) => e.when === when).map((eff) => ({ t: 'eff', uid: inst.uid, eff, chain }));
}

function raiseStage(cat, pl, cell, chain) {
  const inst = pl.garden[cell];
  inst.stage++;
  pl.queue.unshift(...effectTasks(cat, inst, 'grow', chain)); // 読み方2・6
}

function runEffect(cat, st, pl, task) {
  const cell = cellOfUid(pl, task.uid);
  if (cell < 0) return;
  const inst = pl.garden[cell];
  const { eff } = task;
  if (!condOk(cat, pl, cell, eff)) return;
  const mult = multOf(cat, pl, cell, eff);
  if (mult === 0) return;
  const n = (eff.amount ?? 1) * mult;
  const repeat = (task1) => Array.from({ length: n }, () => ({ ...task1 }));
  // 画面の演出用（工程9 H2・H7）：この操作で動いた効果の順。操作のたびに空にする。ルールには使わない
  const fx = { uid: inst.uid, when: eff.when, do: eff.do, n };
  (pl.fx ??= []).push(fx);
  switch (eff.do) {
    case 'gain': {
      const color = eff.color === 'self' ? defOf(cat, inst).element : eff.color;
      fx.color = color;
      if (color === 'any') pl.queue.unshift(...repeat({ t: 'color', uid: inst.uid }));
      else addGain(pl, color, n);
      break;
    }
    case 'convert': {
      const group = ++pl.groupNext;
      pl.queue.unshift(...repeat({ t: 'convert', to: eff.to, group, uid: inst.uid }));
      break;
    }
    case 'stageUp':
      pl.queue.unshift(...repeat({ t: 'stageUp', uid: inst.uid, area: eff.area, filter: eff.filter, chain: task.chain }));
      break;
    case 'trigger': {
      const seen = (pl.chains[task.chain] ??= []);
      const tasks = [];
      for (const c of cellsIn(cat, pl, cell, eff.area, eff.filter)) {
        const target = pl.garden[c];
        if (!target || seen.includes(target.uid) || !matches(cat, pl, cell, c, eff.filter)) continue;
        seen.push(target.uid); // 読み方6：連鎖の中で同じ札は1回
        (fx.targets ??= []).push(target.uid);
        tasks.push(...effectTasks(cat, target, 'activate', task.chain));
      }
      pl.queue.unshift(...tasks);
      break;
    }
    case 'score':
      if (eff.when !== 'end') pl.bonus += n;
      break;
    case 'move':
      pl.queue.unshift({ t: 'move', uid: inst.uid, area: eff.area, filter: eff.filter });
      break;
    case 'remove': // 溶解：範囲のカード1枚まで（選ぶ）を取り除く。amount があれば、そのカードの★ごとに、そのカードの色を得る
      pl.queue.unshift({ t: 'remove', uid: inst.uid, area: eff.area, filter: eff.filter, amount: eff.amount ?? 0 });
      break;
    case 'copy': // 複製：範囲（なければこのカード）の1枚の写しを、手元のカードに加える
      pl.queue.unshift({ t: 'copy', uid: inst.uid, area: eff.area ?? 'self', filter: eff.filter });
      break;
    default: // discount・limit は常に、bend は拾うときに扱う
  }
}

function runTask(cat, st, pl, task) {
  if (task.t === 'eff') return runEffect(cat, st, pl, task);
  // 選ぶ所には、効果を出している札（source）を付ける。画面で光らせるため
  if (task.t === 'color') {
    pl.choice = { kind: 'color', options: [...ELEMENTS], source: task.uid };
    return;
  }
  if (task.t === 'convert') {
    const from = ELEMENTS.filter((c) => pl.mana[c] > 0 && (task.to === 'any' || c !== task.to));
    if (!from.length) return;
    pl.choice = { kind: 'convert', to: task.to, from, group: task.group, source: task.uid };
    return;
  }
  const src = cellOfUid(pl, task.uid);
  if (src < 0) return;
  if (task.t === 'remove' || task.t === 'copy') {
    const options = cellsIn(cat, pl, src, task.area, task.filter).filter((c) => pl.garden[c] && matches(cat, pl, src, c, task.filter));
    if (!options.length) return;
    if (task.t === 'copy' && options.length === 1) return copyCard(st, pl, options[0]);
    pl.choice = { kind: task.t, options, amount: task.amount, source: task.uid };
    return;
  }
  if (task.t === 'stageUp') {
    const options = cellsIn(cat, pl, src, task.area, task.filter)
      .filter((c) => pl.garden[c] && pl.garden[c].stage < 3 && matches(cat, pl, src, c, task.filter));
    if (!options.length) return;
    if (options.length === 1) return raiseStage(cat, pl, options[0], task.chain);
    pl.choice = { kind: 'stageUp', options, chain: task.chain, source: task.uid };
    return;
  }
  if (task.t === 'move') {
    const from = cellsIn(cat, pl, src, task.area, task.filter).filter((c) => pl.garden[c] && matches(cat, pl, src, c, task.filter));
    if (from.length) pl.choice = { kind: 'move', from, source: task.uid };
  }
}

// 溶解：庭から取り除いて捨て札へ（工程10の後、拡張 Celestial Alchemy で足した部品）
function removeCard(cat, st, pl, cell, amount) {
  const inst = pl.garden[cell];
  st.discardPile.push({ uid: inst.uid, id: inst.id });
  pl.garden[cell] = null;
  if (amount) addGain(pl, defOf(cat, inst).element, amount * inst.stage);
}

// 複製：同じカード（山にあるのと同じ id）の新しい1枚を、手元のカードに加える
function copyCard(st, pl, cell) {
  pl.pending.push({ uid: st.uidNext++, id: pl.garden[cell].id });
}

function drain(cat, st, pl) {
  while (!pl.choice && pl.queue.length) runTask(cat, st, pl, pl.queue.shift());
}

function resolveChoice(cat, st, pl, value) {
  const ch = pl.choice;
  switch (ch.kind) {
    case 'color':
      if (!ELEMENTS.includes(value)) fail('色を選ぶ');
      addGain(pl, value, 1);
      break;
    case 'convert':
      if (value === null) { pl.queue = pl.queue.filter((t) => t.group !== ch.group); break; } // 「まで」なので止めてよい
      if (!ch.from.includes(value?.from)) fail('変える魔素を選ぶ');
      if (ch.to === 'any' ? !ELEMENTS.includes(value.to) || value.to === value.from : value.to !== ch.to) fail('変える先の色が正しくない');
      pl.mana[value.from]--;
      pl.mana[value.to]++;
      break;
    case 'stageUp':
      if (!ch.options.includes(value)) fail('★を育てるカードを選ぶ');
      pl.choice = null;
      raiseStage(cat, pl, value, ch.chain);
      return;
    case 'remove': // 「まで」なので溶かさなくてもよい
      if (value !== null) {
        if (!ch.options.includes(value)) fail('溶かすカードを選ぶ');
        removeCard(cat, st, pl, value, ch.amount);
      }
      break;
    case 'copy':
      if (!ch.options.includes(value)) fail('複製するカードを選ぶ');
      copyCard(st, pl, value);
      break;
    case 'move':
      if (value !== null) {
        if (!ch.from.includes(value?.from) || !CELLS.includes(value.to) || value.to === value.from) fail('動かすカードと先のマスを選ぶ');
        const g = pl.garden;
        [g[value.from], g[value.to]] = [g[value.to], g[value.from]]; // 空きなら移動、札があれば入れ替え
      }
      break;
    case 'discard': {
      let sum = 0;
      for (const c of ELEMENTS) {
        const v = value?.[c] ?? 0;
        if (!Number.isInteger(v) || v < 0 || v > pl.mana[c]) fail('捨てる魔素が正しくない');
        sum += v;
      }
      if (sum !== ch.amount) fail(`魔素を ${ch.amount} 個捨てる`);
      for (const c of ELEMENTS) pl.mana[c] -= value[c] ?? 0;
      pl.discarded += sum;
      break;
    }
    default: fail('知らない選び方');
  }
  pl.choice = null;
}

// ---- ラウンドの進み ------------------------------------------------------

function startReact(st) {
  st.phase = 'react';
  for (const pl of st.players) { pl.status = 'acting'; pl.used = []; pl.history = []; }
}

function checkGoals(cat, st, p) {
  for (const g of st.goals) {
    if (st.claims[g].some((x) => x.player === p)) continue;
    if (GOALS[g].check(cat, st.players[p].garden)) st.claims[g].push({ player: p, round: st.round });
  }
}

function endRound(cat, st) {
  if (st.round >= st.rounds) return finish(cat, st);
  st.round++;
  st.firstPlayer = (st.firstPlayer + 1) % st.players.length; // D2
  st.phase = 'pick';
  st.turn = 0;
  for (const pl of st.players) pl.status = 'waiting';
}

function autoDiscard(pl, n) {
  for (let k = 0; k < n; k++) {
    const c = ELEMENTS.reduce((a, b) => (pl.mana[b] > pl.mana[a] ? b : a));
    pl.mana[c]--;
  }
  pl.discarded += n;
}

function progress(cat, st, p) {
  const pl = st.players[p];
  if (pl.choice || pl.queue.length) return;
  pl.chains = {};
  if (pl.status !== 'activating') return;
  const over = manaTotal(pl.mana) - limitOf(cat, pl);
  if (over > 0) {
    if (st.round < st.rounds) { pl.choice = { kind: 'discard', amount: over }; return; } // D4
    autoDiscard(pl, over); // 最後のラウンドは色が点に関わらないので、選ばずに捨てる（貯め点は数だけを見る）
  }
  checkGoals(cat, st, p);
  pl.status = 'done';
  pl.history = [];
  if (st.players.every((q) => q.status === 'done')) endRound(cat, st);
}

// ---- 操作 ----------------------------------------------------------------

function takeFromMarket(st, i) {
  const card = st.market[i];
  if (!card) fail('その場所にカードがない');
  st.market[i] = draw(st);
  return card;
}

export const buysOf = (a) => a.buys ?? (a.buy ? [a.buy] : []);

// k 枚目（0 から）の値段。2枚目は「任」が1つ増える
export function buyCost(cat, card, k) {
  const cost = { ...cat.cards[card.id].cost };
  if (k > 0) cost.any = (cost.any ?? 0) + k;
  return cost;
}

function doPick(cat, st, a) {
  if (st.phase !== 'pick') fail('採集フェーズではない');
  const p = pickOrder(st)[st.turn];
  if (a.player !== p) fail('摘む番ではない');
  const pl = st.players[p];
  if (!st.bundles[a.bundle]) fail('その束はない');
  const taken = [...st.bundles[a.bundle]];
  const usedCells = new Set();
  const adds = [];
  for (const bend of a.bends ?? []) {
    const inst = pl.garden[bend.cell];
    if (!inst) fail('そのマスにカードがない');
    if (usedCells.has(bend.cell)) fail('同じカードは1回の摘みで1回だけ'); // D12
    const eff = effectsOf(cat, inst).find((e) => e.when === 'pick' && e.do === 'bend' && e.kind === bend.kind && condOk(cat, pl, bend.cell, e));
    if (!eff) fail('そのカードはこの曲げ方を使えない');
    usedCells.add(bend.cell);
    if (bend.kind === 'swap') {
      const other = st.bundles[bend.other];
      const ok = (k) => Number.isInteger(k) && k >= 0 && k < BUNDLE_SIZE;
      if (bend.other === a.bundle || !other || !ok(bend.give) || !ok(bend.otherIdx)) fail('入れ替えの指定が正しくない');
      [taken[bend.give], other[bend.otherIdx]] = [other[bend.otherIdx], taken[bend.give]];
    } else if (bend.kind === 'add') {
      adds.push({ cell: bend.cell, eff });
    } else {
      fail(`曲げ方「${bend.kind}」はまだ作っていない`);
    }
  }
  for (const c of taken) pl.mana[c]++;
  for (const { cell, eff } of adds) { // 入れ替えの後の束で見る
    const color = defOf(cat, pl.garden[cell]).element;
    if (taken.includes(color)) pl.mana[color] += multOf(cat, pl, cell, eff);
  }
  st.bundles[a.bundle] = randomBundle(st);
  const buys = buysOf(a);
  if (buys.length > MAX_BUYS) fail(`カードは1回に${MAX_BUYS}枚まで`);
  if (new Set(buys.map((b) => b.market)).size !== buys.length) fail('同じカードは2回招けない');
  buys.forEach((b, k) => { // 場所は拾う前の場で数え、取ってから補充する
    const card = st.market[b.market];
    if (!card) fail('その場所にカードがない');
    const cost = buyCost(cat, card, k);
    if (!canPay(cost, b.pay, pl.mana)) fail('払う魔素が正しくない');
    for (const c of ELEMENTS) pl.mana[c] -= b.pay[c] ?? 0;
    pl.pending.push(card);
  });
  for (const b of buys) st.market[b.market] = draw(st);
  st.turn++;
  if (st.turn === st.players.length) startReact(st);
}

function needActing(st, p) {
  if (st.phase !== 'react') fail('手入れフェーズではない');
  const pl = st.players[p];
  if (!pl || pl.status !== 'acting') fail('いまは庭を触れない');
  if (pl.choice) fail('先に選ぶ');
  return pl;
}

// やり直し（フェーズ4）：反応フェーズは自分の庭だけを触るので、自分の分だけ前に戻せる。
// 人の操作だけを積む（CPU は試すときに何度も動かすので積まない）。
const UNDOABLE = ['place', 'grow', 'use', 'choose', 'done'];

function snapshot(st, p) {
  const pl = st.players[p];
  const { history, ...rest } = pl;
  history.push({ pl: structuredClone(rest), discardLen: st.discardPile.length });
}

export function applyMut(cat, st, a) {
  const p = a.player;
  const me = st.players[p];
  if (me && st.phase === 'react' && a.type !== 'undo') me.fx = [];
  if (st.phase === 'react' && me && !me.cpu && UNDOABLE.includes(a.type) && ['acting', 'activating'].includes(me.status)) snapshot(st, p);
  switch (a.type) {
    case 'undo': {
      if (st.phase !== 'react' || !me?.history?.length || !['acting', 'activating'].includes(me.status)) fail('戻せる操作がない');
      const snap = me.history.pop();
      st.players[p] = { ...snap.pl, history: me.history };
      st.discardPile.length = snap.discardLen;
      return st;
    }
    case 'draft': {
      if (st.phase !== 'draft') fail('始まりのカードを招く時ではない');
      if (st.draftOrder[st.turn] !== p) fail('招く番ではない');
      st.players[p].pending.push(takeFromMarket(st, a.market));
      st.turn++;
      if (st.turn === st.players.length) { st.phase = 'pick'; st.turn = 0; }
      return st;
    }
    case 'pick':
      doPick(cat, st, a);
      return st;
    case 'place': {
      const pl = needActing(st, p);
      const card = pl.pending[a.pending];
      if (!card) fail('置くカードがない');
      if (!CELLS.includes(a.cell)) fail('そのマスはない');
      if (pl.garden[a.cell]) {
        if (pl.garden.some((x) => !x)) fail('空きマスがあるうちは置き換えられない'); // D15
        st.discardPile.push({ uid: pl.garden[a.cell].uid, id: pl.garden[a.cell].id });
      }
      pl.pending.splice(a.pending, 1);
      const inst = { ...card, stage: 1 };
      pl.garden[a.cell] = inst;
      pl.queue.push(...effectTasks(cat, inst, 'place', newChain(pl)));
      break;
    }
    case 'grow': {
      const pl = needActing(st, p);
      const inst = pl.garden[a.cell];
      if (!inst) fail('そのマスにカードがない');
      if (inst.stage >= 3) fail('もう★★★');
      const cost = growCost(cat, pl, a.cell);
      const color = defOf(cat, inst).element;
      if (pl.mana[color] < cost) fail('魔素が足りない');
      pl.mana[color] -= cost;
      raiseStage(cat, pl, a.cell, newChain(pl));
      break;
    }
    case 'use': {
      const pl = needActing(st, p);
      const inst = pl.garden[a.cell];
      if (!inst) fail('そのマスにカードがない');
      if (pl.used.includes(inst.uid)) fail('このラウンドはもう使った');
      const tasks = effectTasks(cat, inst, 'use', newChain(pl));
      if (!tasks.length) fail('このカードに使う効果はない');
      pl.used.push(inst.uid);
      pl.queue.push(...tasks);
      break;
    }
    case 'done': {
      const pl = needActing(st, p);
      if (pl.pending.length > HAND_LIMIT) fail(`置かずに持っておけるカードは${HAND_LIMIT}枚まで`);
      pl.status = 'activating';
      const chain = newChain(pl);
      for (const inst of pl.garden) { // 読み方7：左上から右下へ
        if (!inst) continue;
        pl.chains[chain].push(inst.uid);
        pl.queue.push(...effectTasks(cat, inst, 'activate', chain));
      }
      break;
    }
    case 'choose': {
      const pl = st.players[p];
      if (!pl?.choice) fail('選ぶものがない');
      resolveChoice(cat, st, pl, a.value);
      break;
    }
    default:
      fail(`知らない操作 ${a.type}`);
  }
  drain(cat, st, st.players[p]);
  progress(cat, st, p);
  return st;
}

export function applyAction(cat, state, action) {
  return applyMut(cat, structuredClone(state), action);
}

// 今、誰が何をできるか（画面と CPU と通信の進行役が使う）
export function whoActs(st) {
  if (st.phase === 'draft') return [st.draftOrder[st.turn]];
  if (st.phase === 'pick') return [pickOrder(st)[st.turn]];
  if (st.phase === 'react') return st.players.filter((pl) => pl.status !== 'done').map((pl) => pl.index);
  return [];
}
