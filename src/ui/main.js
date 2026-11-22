// 試作画面（フェーズ4）：1人＋CPU。ルールの処理は src/core、ここは描くことと操作を渡すことだけ。
import {
  buildCatalog, createGame, applyAction, whoActs, pickOrder, autoPay, buyCost, buysOf, growCost, limitOf, manaTotal, scoreOf, GameError,
  MAX_BUYS, HAND_LIMIT,
} from '../core/game.js';
import { cpuAction, wantOf } from '../core/cpu.js';
import { ELEMENTS } from '../core/schema.js';
import { GOALS } from '../core/goals.js';
import { stageLines, costText, COLOR_JA, ROLE_JA, GROWTH_JA } from './describe.js';
import { GROWTH } from '../core/schema.js';

const app = document.getElementById('app');
const ME = 0;
let expansions = [];
let cat = null;
let st = null;
let ui = {};
let log = [];
let record = null;
let hover = null;
let error = '';
let cpuTimer = null;

const freshUi = () => ({ bundle: null, markets: [], anyPick: {}, swapCell: null, give: null, swap: null, pending: null, cell: null, convFrom: null, moveFrom: null, discard: {} });
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const nameOf = (p) => st.players[p].name;
const defById = (id) => cat.cards[id];

// ---- 読み込みと始め方 -------------------------------------------------------

async function loadExpansions() {
  const get = async (p) => (await fetch(p)).json();
  const ids = await get('expansions/index.json');
  return Promise.all(ids.map(async (id) => ({ meta: await get(`expansions/${id}/expansion.json`), cards: await get(`expansions/${id}/cards.json`) })));
}

function renderSetup() {
  const exps = expansions.map((e) => `<label class="check"><input type="checkbox" name="exp" value="${e.meta.id}" checked ${e.meta.id === 'base' ? 'disabled' : ''}> ${esc(e.meta.name)}（${e.cards.length}種類・版 ${e.meta.version}）</label>`).join('');
  app.innerHTML = `
  <main class="setup">
    <h1>Gateway Garden</h1>
    <p class="lead">世界をつなぐ庭。共通の場から魔素の束を拾い、別の世界から来た住人を3×3の庭に迎えて育てよう。</p>
    <form id="setup">
      <label>名前 <input name="name" value="あなた" maxlength="12"></label>
      <label>人数 <select name="players"><option>2</option><option selected>3</option><option>4</option></select>（あなた＋CPU）</label>
      <label>長さ <select name="rounds"><option value="8" selected>ふつう（8ラウンド）</option><option value="6">短め（6ラウンド）</option></select></label>
      <fieldset><legend>使う札</legend>${exps}</fieldset>
      <label>種（空なら毎回ちがう） <input name="seed" inputmode="numeric" placeholder="例：123"></label>
      <button class="primary" type="submit">はじめる</button>
    </form>
    <details class="rules"><summary>遊び方（短く）</summary>${rulesHtml()}</details>
  </main>`;
  document.getElementById('setup').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const f = new FormData(ev.target);
    const n = Number(f.get('players'));
    const seed = f.get('seed') ? Number(f.get('seed')) : Math.floor(Math.random() * 1e9);
    startGame({ name: f.get('name') || 'あなた', n, rounds: Number(f.get('rounds')), seed });
  });
}

function rulesHtml() {
  return `<ol>
    <li><b>拾うフェーズ（順番に）</b>：場の束を1つ拾う（3個の魔素が手元に入る）。そのあと、手持ちの魔素で場の札を2枚まで取れる（2枚目は値段に任1が足される）。「任」はどの色で払ってもよい。</li>
    <li><b>反応フェーズ（全員同時）</b>：取った札を庭に置く（2枚まで置かずに持っておける）。札と同じ色の魔素を乗せて段階を上げる（何回でも）。「このラウンドを終える」で、庭の札が左上から順に発動する。終えるまでは「1つ戻す」でやり直せる。</li>
    <li>反応フェーズで得た魔素は、その場で使える。持てる魔素は10個まで（ラウンドの終わりにあふれた分を捨てる）。育てる値段は強化で0個まで下がる。</li>
    <li>導きの札は、段階2から拾い方を曲げる（足す・入れ替える）。</li>
    <li>${'8'}ラウンド（短めは6）で終わり。札の段階の点、終わりの効果、目標札（一番乗り5点・あとから3点）の合計で比べる。</li>
  </ol>`;
}

function startGame({ name, n, rounds, seed }) {
  cat = buildCatalog(expansions.filter((e) => e.meta.id === 'base' || document.querySelector(`input[value="${e.meta.id}"]`)?.checked));
  const players = [{ name }, ...Array.from({ length: n - 1 }, (_, i) => ({ name: `CPU${i + 1}`, cpu: 'normal' }))];
  st = createGame(cat, { players, rounds, seed });
  record = { game: 'gateway-garden', seed, rounds, players: players.map((p) => p.name), versions: cat.versions, start: Date.now(), actions: [], roundTimes: [] };
  log = [`ゲーム開始（種 ${seed}）。目標札：${st.goals.map((g) => GOALS[g].name).join('・')}`];
  ui = freshUi();
  render();
  schedule();
}

// ---- 操作を進める -----------------------------------------------------------

function describe(before, a) {
  const who = before.players[a.player].name;
  const card = (c) => `「${defById(c.id).name}」`;
  switch (a.type) {
    case 'draft': return `${who}：始まりの札${card(before.market[a.market])}を取った`;
    case 'pick': {
      const b = before.bundles[a.bundle].map((c) => COLOR_JA[c]).join('');
      const bends = a.bends?.length ? `（${a.bends.map((x) => (x.kind === 'swap' ? '入れ替え' : '足す')).join('・')}）` : '';
      const got = buysOf(a).map((x) => card(before.market[x.market])).join('と');
      return `${who}：束${a.bundle + 1}（${b}）を拾った${bends}${got ? `、${got}を取った` : ''}`;
    }
    case 'undo': return `${who}：1つ戻した`;
    case 'place': return `${who}：${card(before.players[a.player].pending[a.pending])}をマス${a.cell + 1}に置いた`;
    case 'grow': return `${who}：${card(before.players[a.player].garden[a.cell])}を段階${before.players[a.player].garden[a.cell].stage + 1}に育てた`;
    case 'use': return `${who}：${card(before.players[a.player].garden[a.cell])}を使った`;
    case 'done': return `${who}：このラウンドを終えた`;
    default: return null;
  }
}

function apply(a) {
  const before = st;
  st = applyAction(cat, st, a);
  record.actions.push({ t: Date.now() - record.start, a });
  const line = describe(before, a);
  if (line) log.push(line);
  if (st.round !== before.round || (st.phase === 'end' && before.phase !== 'end')) {
    record.roundTimes.push(Date.now() - record.start);
    for (const g of st.goals) {
      for (const c of st.claims[g]) {
        if (!before.claims[g].some((x) => x.player === c.player)) log.push(`${nameOf(c.player)}：目標札「${GOALS[g].name}」を満たした`);
      }
    }
    if (st.phase !== 'end') log.push(`―― ラウンド ${st.round} ――`);
  }
}

function act(a) {
  error = '';
  try {
    apply(a);
    if (a.player === ME && !['choose'].includes(a.type)) ui = freshUi();
    if (a.type === 'choose') { ui.convFrom = null; ui.moveFrom = null; ui.discard = {}; }
  } catch (e) {
    if (!(e instanceof GameError)) throw e;
    error = e.message;
  }
  render();
  schedule();
}

function schedule() {
  clearTimeout(cpuTimer);
  if (!st || st.phase === 'end') return;
  const cpus = whoActs(st).filter((p) => st.players[p].cpu);
  if (!cpus.length) return;
  if (st.phase === 'react') {
    cpuTimer = setTimeout(() => {
      for (const p of cpus) {
        for (let k = 0; k < 300 && st.phase === 'react' && st.players[p].status !== 'done'; k++) apply(cpuAction(cat, st, p));
      }
      render();
      schedule();
    }, 350);
  } else {
    cpuTimer = setTimeout(() => act(cpuAction(cat, st, cpus[0])), 700);
  }
}

// ---- 描く部品 ---------------------------------------------------------------

const manaDot = (c, extra = '') => `<span class="dot ${c}" ${extra}></span>`;

function manaRow(m) {
  return ELEMENTS.map((c) => `<span class="mana-item">${manaDot(c)}<b>${m[c]}</b></span>`).join('');
}

function cardHtml(c, { stage = null, attrs = '', cls = '', showCost = false, cost = null } = {}) {
  const d = defById(c.id);
  const s = stage ?? 1;
  const pips = stage ? [1, 2, 3].map((k) => `<i class="${k <= stage ? 'on' : ''}"></i>`).join('') : '';
  const pts = d.stages[s - 1].points ?? 0;
  return `<div class="card ${d.element} ${cls}" data-card="${c.id}" data-stage="${s}" ${attrs}>
    <div class="card-top"><span class="name">${esc(d.name)}</span>${stage ? `<span class="pips">${pips}</span>` : ''}</div>
    <div class="card-mid">${ROLE_JA[d.role]}・${GROWTH_JA[d.growth]}${pts ? `・${pts}点` : ''}</div>
    <div class="card-text">${stageLines(d, s - 1).map(esc).join('<br>')}</div>
    ${showCost ? `<div class="card-cost">${costText(d.cost)}</div>` : ''}
    ${cost !== null ? `<div class="card-cost">育てる：${COLOR_JA[d.element]}${cost}</div>` : ''}
  </div>`;
}

function detailHtml() {
  if (!hover) return '<p class="muted">札にマウスを乗せると、ここに全部の段階が出ます。</p>';
  const d = defById(hover.id);
  const g = GROWTH[d.growth];
  return `<div class="detail ${d.element}">
    <h3>${esc(d.name)}</h3>
    <p>${COLOR_JA[d.element]}・${ROLE_JA[d.role]}・${GROWTH_JA[d.growth]}（育てる値段 ${g.join('・')}）・取る値段 ${costText(d.cost)}・出身 ${esc(d.origin)}</p>
    ${[0, 1, 2].map((i) => `<div class="stage ${hover.stage === i + 1 ? 'now' : ''}"><b>段階${i + 1}</b>（${d.stages[i].points ?? 0}点）<br>${stageLines(d, i).map(esc).join('<br>')}</div>`).join('')}
  </div>`;
}

function goalsHtml() {
  return st.goals.map((g) => {
    const claims = st.claims[g];
    const first = claims.length ? Math.min(...claims.map((x) => x.round)) : null;
    const who = claims.map((x) => `${esc(nameOf(x.player))}${x.round === first ? '（5点）' : '（3点）'}`).join('・');
    return `<div class="goal"><b>${GOALS[g].name}</b><span>${GOALS[g].text}</span><small>${who || 'まだ誰も'}</small></div>`;
  }).join('');
}

function myPickTurn() { return st.phase === 'pick' && pickOrder(st)[st.turn] === ME; }
function myDraftTurn() { return st.phase === 'draft' && st.draftOrder[st.turn] === ME; }

function bendCells(kind) {
  const pl = st.players[ME];
  return pl.garden.map((x, i) => (x && defById(x.id).stages[x.stage - 1].effects.some((e) => e.when === 'pick' && e.do === 'bend' && e.kind === kind) ? i : -1)).filter((i) => i >= 0);
}

function pickBase() {
  const bends = bendCells('add').map((cell) => ({ cell, kind: 'add' }));
  if (ui.swap) bends.unshift(ui.swap);
  return { type: 'pick', player: ME, bundle: ui.bundle, bends, buys: [] };
}

// 取る札（2枚まで）と払い方。「任」の色は ui.anyPick[k] で選べる（なければ自動）
function pickPreview() {
  if (ui.bundle === null) return null;
  const base = pickBase();
  let after;
  try { after = applyAction(cat, st, base); } catch (e) { return { error: e.message }; }
  const left = { ...after.players[ME].mana };
  const buys = [];
  const lines = [];
  for (const [k, i] of ui.markets.entries()) {
    const card = st.market[i];
    const cost = buyCost(cat, card, k);
    const auto = autoPay(cost, left, wantOf(cat, st.players[ME]));
    if (!auto) return { mana: after.players[ME].mana, error: `「${defById(card.id).name}」は払えない（${k ? '2枚目は任1が足される' : '魔素が足りない'}）`, lines };
    let pay = auto;
    const anyN = cost.any ?? 0;
    if (anyN) {
      const pick = ui.anyPick[k];
      if (pick?.length === anyN) {
        pay = Object.fromEntries(ELEMENTS.map((c) => [c, (cost[c] ?? 0) + pick.filter((x) => x === c).length]));
      } else {
        ui.anyPick[k] = ELEMENTS.flatMap((c) => Array(auto[c] - (cost[c] ?? 0)).fill(c));
      }
    }
    for (const c of ELEMENTS) left[c] -= pay[c];
    buys.push({ market: i, pay });
    lines.push({ k, card, cost, anyN });
  }
  const action = { ...base, buys };
  try {
    return { action, mana: applyAction(cat, st, action).players[ME].mana, lines };
  } catch (e) {
    return { mana: after.players[ME].mana, error: e.message, lines };
  }
}

function bundlesHtml() {
  const mine = myPickTurn();
  return st.bundles.map((b, i) => {
    const sel = ui.bundle === i;
    const swapGive = ui.swap && ui.swap.other === i ? ui.swap.otherIdx : (ui.swap && ui.bundle === i ? ui.swap.give : -1);
    const dots = b.map((c, k) => manaDot(c, `data-act="dot" data-b="${i}" data-k="${k}" ${(sel && ui.give === k) || swapGive === k ? 'data-mark="1"' : ''}`)).join('');
    return `<div class="bundle ${sel ? 'sel' : ''} ${mine ? 'can' : ''}" data-act="bundle" data-b="${i}"><small>束${i + 1}</small>${dots}</div>`;
  }).join('');
}

function marketHtml() {
  const can = myPickTurn() || myDraftTurn();
  return st.market.map((c, i) => {
    if (!c) return '<div class="card empty">（なし）</div>';
    const order = ui.markets.indexOf(i);
    return cardHtml(c, { showCost: true, cls: `${can ? 'can' : ''} ${order >= 0 ? 'sel' : ''}`, attrs: `data-act="market" data-i="${i}"${order >= 0 ? ` data-order="${order + 1}"` : ''}` });
  }).join('');
}

function gardenHtml(p, mini = false) {
  const pl = st.players[p];
  const ch = p === ME ? pl.choice : null;
  return `<div class="garden ${mini ? 'mini' : ''}">${pl.garden.map((x, i) => {
    let cls = '';
    if (p === ME) {
      if (ch?.kind === 'stageUp' && ch.options.includes(i)) cls = 'target';
      if (ch?.kind === 'move' && (ui.moveFrom === null ? ch.from.includes(i) : i !== ui.moveFrom)) cls = 'target';
      if (ui.cell === i) cls += ' sel';
      if (ui.pending !== null && (!x || pl.garden.every(Boolean))) cls += ' target';
    }
    const attrs = p === ME ? `data-act="cell" data-cell="${i}"` : '';
    if (!x) return `<div class="cell empty ${cls}" ${attrs}><small>${i + 1}</small></div>`;
    const cost = p === ME && !mini && x.stage < 3 ? growCost(cat, pl, i) : null;
    return `<div class="cell ${cls}" ${attrs}>${mini ? `<div class="mini-card ${defById(x.id).element}" data-card="${x.id}" data-stage="${x.stage}">${esc(defById(x.id).name)}<b>${x.stage}</b></div>` : cardHtml(x, { stage: x.stage, cost })}</div>`;
  }).join('')}</div>`;
}

// 自分のすること（右下の欄）
function actionPanel() {
  const pl = st.players[ME];
  if (st.phase === 'end') return '';
  if (pl.choice) return `${choicePanel(pl)}${pl.history?.length ? '<p><button data-act="undo">1つ戻す</button></p>' : ''}`;
  if (myDraftTurn()) return '<p>始まりの札を、場から1枚選んでください（無料）。</p>';
  if (st.phase === 'draft') return `<p class="muted">${esc(nameOf(st.draftOrder[st.turn]))} が始まりの札を選んでいます…</p>`;
  const waiting = pl.pending.length
    ? `<p class="muted">手元の札（反応フェーズで置く）：${pl.pending.map((c) => `<span data-card="${c.id}" data-stage="1">「${esc(defById(c.id).name)}」</span>`).join('')}</p>` : '';
  if (st.phase === 'pick') {
    if (!myPickTurn()) return `<p class="muted">${esc(nameOf(pickOrder(st)[st.turn]))} が拾っています…（場を見て次の手を考えられます）</p>${waiting}`;
    const pv = pickPreview();
    const swaps = bendCells('swap');
    const swapUi = swaps.length && ui.bundle !== null
      ? `<p>入れ替え（${swaps.map((c) => esc(defById(pl.garden[c].id).name)).join('・')}）：${ui.swap ? `束${ui.bundle + 1}の${ui.swap.give + 1}番目 ⇔ 束${ui.swap.other + 1}の${ui.swap.otherIdx + 1}番目 <button data-act="swap-clear">やめる</button>` : (ui.swapCell === null ? `<button data-act="swap-start" data-cell="${swaps[0]}">使う</button>` : (ui.give === null ? '取る束の、替えたい魔素を押す' : '替える相手（別の束）の魔素を押す'))}</p>` : '';
    const adds = bendCells('add');
    const buyLines = (pv?.lines ?? []).map(({ k, card, cost, anyN }) => {
      const fixed = ELEMENTS.filter((c) => cost[c]).map((c) => `${COLOR_JA[c]}${cost[c]}`).join('・');
      const chips = anyN ? `　任の払い：${(ui.anyPick[k] ?? []).map((c, j) => `<button class="chip" data-act="anychip" data-k="${k}" data-j="${j}" title="押すと色が変わる">${manaDot(c)}</button>`).join('')}` : '';
      return `<p>${k + 1}枚目「${esc(defById(card.id).name)}」：${fixed || '―'}${anyN ? `${fixed ? '・' : ''}任${anyN}` : ''}${chips}</p>`;
    }).join('');
    return `<p><b>あなたの番</b>：束を1つ選び、取りたい札があれば場の札を2枚まで選んで「拾う」（2枚目は任1が足される）。</p>${waiting}
      ${adds.length ? `<p class="muted">足す（${adds.map((c) => esc(defById(pl.garden[c].id).name)).join('・')}）は自動で使います。</p>` : ''}
      ${swapUi}
      ${buyLines}
      ${pv?.mana ? `<p>拾って払った後：${manaRow(pv.mana)}</p>` : ''}
      ${pv?.error ? `<p class="error">${esc(pv.error)}</p>` : ''}
      <button class="primary" data-act="pick" ${pv?.action && !pv.error ? '' : 'disabled'}>拾う${ui.markets.length ? `（札${ui.markets.length}枚も取る）` : ''}</button>
      ${ui.markets.length ? '<button data-act="unbuy">札は取らない</button>' : ''}`;
  }
  if (st.phase === 'react') {
    if (pl.status === 'done') return '<p class="muted">このラウンドは終えました。ほかの人を待っています…</p>';
    const pend = pl.pending.map((c, i) => cardHtml(c, { cls: `can ${ui.pending === i ? 'sel' : ''}`, attrs: `data-act="pending" data-i="${i}"` })).join('');
    let sel = '';
    if (ui.cell !== null && pl.garden[ui.cell]) {
      const x = pl.garden[ui.cell];
      const d = defById(x.id);
      const cost = x.stage < 3 ? growCost(cat, pl, ui.cell) : null;
      const hasUse = d.stages[x.stage - 1].effects.some((e) => e.when === 'use');
      sel = `<p>「${esc(d.name)}」：
        ${cost !== null ? `<button class="primary" data-act="grow" ${pl.mana[d.element] >= cost ? '' : 'disabled'}>育てる（${COLOR_JA[d.element]}${cost}）</button>` : '段階3です'}
        ${hasUse ? `<button data-act="use" ${pl.used.includes(x.uid) ? 'disabled' : ''}>使う</button>` : ''}</p>`;
    }
    const over = pl.pending.length > HAND_LIMIT;
    return `${pend ? `<p><b>手元の札</b>：札を選んで、庭のマスを押すと置く${pl.garden.every(Boolean) ? '（庭が埋まっているので置き換え）' : ''}。置かずに${HAND_LIMIT}枚まで持っておける。</p><div class="row">${pend}</div>` : ''}
      <p>庭の札を押すと、育てる・使うができます。</p>${sel}
      <button class="primary" data-act="done" ${over ? 'disabled' : ''}>このラウンドを終える（発動）</button>
      <button data-act="undo" ${pl.history?.length ? '' : 'disabled'}>1つ戻す</button>
      ${over ? `<p class="error">手元の札が${HAND_LIMIT}枚を超えています。置いてから終えてください。</p>` : ''}`;
  }
  return '';
}

function choicePanel(pl) {
  const ch = pl.choice;
  switch (ch.kind) {
    case 'color':
      return `<p><b>好きな色を1つ得る</b></p>${ELEMENTS.map((c) => `<button data-act="choose-color" data-c="${c}">${manaDot(c)}${COLOR_JA[c]}</button>`).join('')}`;
    case 'convert': {
      if (ui.convFrom === null) {
        return `<p><b>魔素の色を変える</b>：変える魔素を選ぶ（先は${ch.to === 'any' ? '好きな色' : COLOR_JA[ch.to]}）</p>
          ${ch.from.map((c) => `<button data-act="conv-from" data-c="${c}">${manaDot(c)}${COLOR_JA[c]}（${pl.mana[c]}）</button>`).join('')}
          <button data-act="conv-stop">変えない</button>`;
      }
      if (ch.to !== 'any') return '';
      return `<p>「${COLOR_JA[ui.convFrom]}」を何色に？</p>${ELEMENTS.filter((c) => c !== ui.convFrom).map((c) => `<button data-act="conv-to" data-c="${c}">${manaDot(c)}${COLOR_JA[c]}</button>`).join('')}`;
    }
    case 'stageUp':
      return '<p><b>段階を上げる札を選ぶ</b>：光っているマスを押す</p>';
    case 'move':
      return `<p><b>札を動かす</b>：${ui.moveFrom === null ? '動かす札を押す' : '動かす先のマスを押す（札があれば入れ替え）'}</p><button data-act="move-skip">動かさない</button>`;
    case 'discard': {
      const sum = ELEMENTS.reduce((s, c) => s + (ui.discard[c] ?? 0), 0);
      return `<p><b>持てる魔素は${limitOf(cat, pl)}個まで</b>：${ch.amount}個捨てる（あと${ch.amount - sum}個）</p>
        ${ELEMENTS.filter((c) => pl.mana[c]).map((c) => `<span class="disc">${manaDot(c)}${pl.mana[c] - (ui.discard[c] ?? 0)} <button data-act="disc" data-c="${c}" ${(ui.discard[c] ?? 0) >= pl.mana[c] || sum >= ch.amount ? 'disabled' : ''}>捨てる</button><button data-act="undisc" data-c="${c}" ${(ui.discard[c] ?? 0) ? '' : 'disabled'}>戻す</button></span>`).join('')}
        <button class="primary" data-act="disc-ok" ${sum === ch.amount ? '' : 'disabled'}>決める</button>`;
    }
    default: return '';
  }
}

function opponentsHtml() {
  return st.players.filter((p) => p.index !== ME).map((pl) => {
    const s = scoreOf(cat, st, pl.index);
    const status = st.phase === 'react' ? (pl.status === 'done' ? '終えた' : '考え中') : '';
    return `<div class="opp"><div class="opp-head"><b>${esc(pl.name)}</b><span>${s.total}点 ${status}</span></div>
      <div class="mana">${manaRow(pl.mana)}${pl.pending.length ? `<span class="muted">手元${pl.pending.length}枚</span>` : ''}</div>${gardenHtml(pl.index, true)}</div>`;
  }).join('');
}

function phaseName() {
  return { draft: '始まりの札', pick: '拾うフェーズ', react: '反応フェーズ', end: '終わり' }[st.phase];
}

function endHtml() {
  if (st.phase !== 'end') return '';
  const mins = ((record.roundTimes.at(-1) ?? 0) / 60000).toFixed(1);
  const rows = [...st.result].sort((a, b) => a.rank - b.rank).map((r) => `<tr><td>${r.rank}位</td><td>${esc(nameOf(r.player))}</td><td>${r.stage}</td><td>${r.end}</td><td>${r.goals}</td><td><b>${r.total}</b></td><td>${r.stage3}</td><td>${st.players[r.player].discarded}</td></tr>`).join('');
  return `<div class="overlay"><div class="end">
    <h2>結果</h2>
    <table><tr><th></th><th>名前</th><th>段階の点</th><th>終わりの効果</th><th>目標札</th><th>合計</th><th>段階3</th><th>捨てた魔素</th></tr>${rows}</table>
    <p>かかった時間：${mins} 分（${st.rounds}ラウンド）</p>
    <p class="muted">「記録をコピー」で、このゲームの操作と時間を文字にできます。チャットに貼ると、同じゲームをそのまま再現して調べられます。</p>
    <button data-act="copy">記録をコピー</button> <button class="primary" data-act="again">もう一度</button>
  </div></div>`;
}

function render() {
  if (!st) return renderSetup();
  const pl = st.players[ME];
  const me = scoreOf(cat, st, ME);
  app.innerHTML = `
  <header class="bar">
    <b>Gateway Garden</b>
    <span>ラウンド ${st.round} / ${st.rounds}・${phaseName()}</span>
    <span class="muted">先番：${esc(nameOf(st.firstPlayer))}</span>
    <span class="spacer"></span>
    <button data-act="copy">記録をコピー</button>
  </header>
  <section class="board">
    <div class="col-left">
      <h2>目標札</h2><div class="goals">${goalsHtml()}</div>
      <h2>束（拾う）</h2><div class="bundles">${bundlesHtml()}</div>
      <h2>場の札（取る）</h2><div class="market">${marketHtml()}</div>
    </div>
    <div class="col-mid">
      <div class="me-head"><h2>${esc(pl.name)} の庭</h2><span>${me.total}点（段階${me.stage}・終わり${me.end}・目標${me.goals}）</span></div>
      <div class="mana big">${manaRow(pl.mana)}<span class="muted">上限 ${limitOf(cat, pl)}・合計 ${manaTotal(pl.mana)}</span></div>
      ${gardenHtml(ME)}
      <div class="panel">${error ? `<p class="error">${esc(error)}</p>` : ''}${actionPanel()}</div>
    </div>
    <div class="col-right">
      <div class="detail-box">${detailHtml()}</div>
      <h2>ほかの人</h2><div class="opps">${opponentsHtml()}</div>
      <h2>できごと</h2><ol class="log" reversed>${log.slice(-14).reverse().map((l) => `<li>${esc(l)}</li>`).join('')}</ol>
    </div>
  </section>
  ${endHtml()}`;
}

// ---- 押したとき ---------------------------------------------------------------

app.addEventListener('mouseover', (ev) => {
  const el = ev.target.closest('[data-card]');
  if (!el || !st) return;
  const h = { id: el.dataset.card, stage: Number(el.dataset.stage) };
  if (hover?.id === h.id && hover.stage === h.stage) return;
  hover = h;
  const box = app.querySelector('.detail-box');
  if (box) box.innerHTML = detailHtml();
});

app.addEventListener('click', async (ev) => {
  const el = ev.target.closest('[data-act]');
  if (!el || !st) return;
  const d = el.dataset;
  const pl = st.players[ME];
  const n = (k) => Number(d[k]);
  switch (d.act) {
    case 'copy':
      await navigator.clipboard.writeText(JSON.stringify(record));
      el.textContent = 'コピーしました';
      return;
    case 'again': st = null; render(); return;
    case 'market':
      if (myDraftTurn()) return act({ type: 'draft', player: ME, market: n('i') });
      if (myPickTurn()) {
        const i = n('i');
        ui.markets = ui.markets.includes(i) ? ui.markets.filter((x) => x !== i) : [...ui.markets, i].slice(-MAX_BUYS);
        ui.anyPick = {};
      }
      break;
    case 'unbuy': ui.markets = []; ui.anyPick = {}; break;
    case 'anychip': { // 「任」の払いの色を、払える次の色へ
      const list = ui.anyPick[n('k')];
      const start = list[n('j')];
      for (let step = 1; step <= ELEMENTS.length; step++) {
        list[n('j')] = ELEMENTS[(ELEMENTS.indexOf(start) + step) % ELEMENTS.length];
        const pv = pickPreview();
        if (pv?.action && !pv.error) break;
      }
      break;
    }
    case 'undo': return act({ type: 'undo', player: ME });
    case 'bundle':
      if (!myPickTurn() || ui.swapCell !== null) break;
      ui.bundle = n('b'); ui.swap = null; ui.give = null; ui.anyPick = {};
      break;
    case 'dot':
      if (!myPickTurn()) break;
      if (ui.swapCell !== null && ui.bundle !== null) {
        ev.stopPropagation();
        if (ui.give === null && n('b') === ui.bundle) ui.give = n('k');
        else if (ui.give !== null && n('b') !== ui.bundle) {
          ui.swap = { cell: ui.swapCell, kind: 'swap', give: ui.give, other: n('b'), otherIdx: n('k') };
          ui.swapCell = null; ui.give = null;
        }
        break;
      }
      ui.bundle = n('b'); ui.swap = null; ui.anyPick = {};
      break;
    case 'swap-start': ui.swapCell = n('cell'); ui.swap = null; ui.give = null; break;
    case 'swap-clear': ui.swap = null; ui.swapCell = null; ui.give = null; break;
    case 'pick': {
      const pv = pickPreview();
      if (pv?.action) return act(pv.action);
      break;
    }
    case 'pending': ui.pending = ui.pending === n('i') ? null : n('i'); ui.cell = null; break;
    case 'cell': {
      const i = n('cell');
      const ch = pl.choice;
      if (ch?.kind === 'stageUp') return act({ type: 'choose', player: ME, value: i });
      if (ch?.kind === 'move') {
        if (ui.moveFrom === null) { if (ch.from.includes(i)) ui.moveFrom = i; break; }
        return act({ type: 'choose', player: ME, value: { from: ui.moveFrom, to: i } });
      }
      if (st.phase !== 'react') break;
      if (ui.pending !== null) return act({ type: 'place', player: ME, pending: ui.pending, cell: i });
      ui.cell = pl.garden[i] ? i : null;
      break;
    }
    case 'grow': return act({ type: 'grow', player: ME, cell: ui.cell });
    case 'use': return act({ type: 'use', player: ME, cell: ui.cell });
    case 'done': return act({ type: 'done', player: ME });
    case 'choose-color': return act({ type: 'choose', player: ME, value: d.c });
    case 'conv-stop': return act({ type: 'choose', player: ME, value: null });
    case 'conv-from':
      if (pl.choice.to !== 'any') return act({ type: 'choose', player: ME, value: { from: d.c, to: pl.choice.to } });
      ui.convFrom = d.c;
      break;
    case 'conv-to': return act({ type: 'choose', player: ME, value: { from: ui.convFrom, to: d.c } });
    case 'move-skip': return act({ type: 'choose', player: ME, value: null });
    case 'disc': ui.discard[d.c] = (ui.discard[d.c] ?? 0) + 1; break;
    case 'undisc': ui.discard[d.c] -= 1; break;
    case 'disc-ok': return act({ type: 'choose', player: ME, value: { ...ui.discard } });
    default: return;
  }
  error = '';
  render();
});

// ---- はじめ -----------------------------------------------------------------

expansions = await loadExpansions();
cat = buildCatalog(expansions);
render();
