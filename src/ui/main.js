// 画面：1人で遊ぶ（CPU と）・部屋を作る・部屋に入る。ルールの処理は src/core、ゲームの相手は src/net/session.js。
// 描くのは「自分から見た盤面」（session.view()）だけ。1人でも通信でも同じ描き方。
import { buildCatalog, applyAction, pickOrder, autoPay, buyCost, growCost, limitOf, manaTotal, scoreOf, MAX_BUYS, HAND_LIMIT } from '../core/game.js';
import { wantOf } from '../core/cpu.js';
import { ELEMENTS, GROWTH } from '../core/schema.js';
import { GOALS } from '../core/goals.js';
import { stageLinesHtml, costText, COLOR_JA, ROLE_JA, GROWTH_JA, stars, glossaryHtml, setExplain, getExplain } from './describe.js';
import { GameHost, HostRoom, GuestClient } from '../net/session.js';
import { openTrystero } from '../net/trystero.js';
import { APP_VERSION } from '../version.js';
import { filterHtml, listHtml, allState, toggleFilter, leftCounts } from './cardlist.js';
import { installMemo } from './memo.js';

const memo = installMemo(); // 落書き（#6）。自分の画面だけに残る

let poolOpen = false; // ゲーム中の「札の一覧」（#8）
let poolState = null;

const app = document.getElementById('app');
let ME = 0;
let expansions = [];
let cat = null;
let st = null;        // 自分から見た盤面
let session = null;   // ゲームの相手（GameHost か GuestClient）
let room = null;      // 通信の部屋（HostRoom か GuestClient）
let screen = 'setup'; // setup → lobby → game
let mode = 'solo';    // solo・host・join
let busy = '';
let ui = {};
let hover = null;
let error = '';

const freshUi = () => ({ bundle: null, markets: [], anyPick: {}, swapCell: null, give: null, swap: null, pending: null, cell: null, convFrom: null, moveFrom: null, discard: {} });
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const nameOf = (p) => st.players[p].name;
const defById = (id) => cat.cards[id];
const params = new URLSearchParams(location.search);
const STRATEGY = params.get('net') ?? 'nostr'; // つながりにくいときは ?net=torrent や ?net=mqtt を試す

function stored(key, value) {
  try {
    if (value === undefined) return localStorage.getItem(key);
    localStorage.setItem(key, value);
  } catch { /* 保存できない環境でも遊べる */ }
  return null;
}
setExplain(stored('gg-explain') !== 'off'); // 「説明も書く」（はじめは入れておく）

function myToken() { // 抜けて戻ったとき、同じ席に戻るための印
  let t = stored('gg-token');
  if (!t) { t = Math.random().toString(36).slice(2) + Date.now().toString(36); stored('gg-token', t); }
  return t;
}
function randomCode() {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// ---- 読み込みと始め方 -------------------------------------------------------

async function loadExpansions() {
  const get = async (p) => (await fetch(p)).json();
  const ids = await get('expansions/index.json');
  return Promise.all(ids.map(async (id) => ({ meta: await get(`expansions/${id}/expansion.json`), cards: await get(`expansions/${id}/cards.json`) })));
}

const worldName = (id) => expansions.find((e) => e.meta.id === id)?.meta.name ?? id; // 画面では拡張を「世界」と呼ぶ
const makeCatalog = (ids) => buildCatalog(expansions.filter((e) => ids.includes(e.meta.id)));
const chosenExpansions = () => expansions.filter((e) => e.meta.id === 'base' || document.querySelector(`input[name="exp"][value="${e.meta.id}"]`)?.checked).map((e) => e.meta.id);

function renderSetup() {
  const exps = expansions.map((e) => `<label class="check"><input type="checkbox" name="exp" value="${e.meta.id}" checked ${e.meta.id === 'base' ? 'disabled' : ''}> ${esc(e.meta.name)}（${e.cards.length}種類・版 ${e.meta.version}）</label>`).join('');
  const name = esc(stored('gg-name') ?? 'あなた');
  const tab = (m, label) => `<button type="button" class="tab ${mode === m ? 'on' : ''}" data-mode="${m}">${label}</button>`;
  const rounds = '<label>長さ <select name="rounds"><option value="8" selected>ふつう（8ラウンド）</option><option value="6">短め（6ラウンド）</option></select></label>';
  let body = '';
  if (mode === 'solo') {
    body = `<label>人数 <select name="players"><option>2</option><option selected>3</option><option>4</option></select>（あなた＋CPU）</label>
      ${rounds}<fieldset><legend>使う世界</legend>${exps}</fieldset>
      <label>種（空なら毎回ちがう） <input name="seed" inputmode="numeric" placeholder="例：123"></label>
      <button class="primary" type="submit">はじめる</button>`;
  } else if (mode === 'host') {
    body = `<label>人数 <select name="players"><option>2</option><option selected>3</option><option>4</option></select>（人が足りない席は CPU）</label>
      ${rounds}<fieldset><legend>使う世界</legend>${exps}</fieldset>
      <label>合言葉 <input name="code" value="${randomCode()}" maxlength="24" required>（入る人に伝える）</label>
      <button class="primary" type="submit">部屋を作る</button>`;
  } else {
    body = `<label>合言葉 <input name="code" maxlength="24" required placeholder="部屋を作った人に聞く"></label>
      <button class="primary" type="submit">部屋に入る</button>`;
  }
  app.innerHTML = `
  <main class="setup">
    <h1>Gateway Garden</h1>
    <p class="lead">世界をつなぐ庭。共通の場から魔素の束を摘み、別の世界から来た住人を招いて、3×3の庭で育てよう。</p>
    <div class="tabs">${tab('solo', '1人で遊ぶ（CPU と）')}${tab('host', '部屋を作る（通信）')}${tab('join', '部屋に入る（通信）')}</div>
    <form id="setup">
      <label>名前 <input name="name" value="${name}" maxlength="12"></label>
      ${body}
      ${busy ? `<p class="muted">${esc(busy)}</p>` : ''}
    </form>
    ${mode !== 'solo' ? '<p class="muted">通信対戦はサーバーなしで、ブラウザ同士を直接つなぎます。同じ合言葉を入れた人が同じ部屋に入ります。</p>' : ''}
    <details class="rules"><summary>遊び方（短く）</summary>${rulesHtml()}</details>
    <p class="muted small">版 ${APP_VERSION}・<a href="cards.html">カードの一覧</a></p>
  </main>`;
  for (const b of app.querySelectorAll('[data-mode]')) b.addEventListener('click', () => { mode = b.dataset.mode; renderSetup(); });
  document.getElementById('setup').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const f = new FormData(ev.target);
    const nm = (f.get('name') || 'あなた').trim();
    stored('gg-name', nm);
    if (mode === 'solo') {
      const seed = f.get('seed') ? Number(f.get('seed')) : Math.floor(Math.random() * 1e9);
      startSolo({ name: nm, n: Number(f.get('players')), rounds: Number(f.get('rounds')), seed, ids: chosenExpansions() });
    } else if (mode === 'host') {
      openRoom({ name: nm, code: f.get('code').trim(), n: Number(f.get('players')), rounds: Number(f.get('rounds')), ids: chosenExpansions() });
    } else {
      joinRoom({ name: nm, code: f.get('code').trim() });
    }
  });
}

function rulesHtml() {
  return `<ol>
    <li><b>採集フェーズ（順番に）</b>：場の束を1つ摘む（3個の魔素が手元に入る）。そのあと、手持ちの魔素で場のカードを2枚まで招ける（2枚目は値段に好きな色1が足される）。「好きな色」はどの色で払ってもよい。</li>
    <li><b>手入れフェーズ（全員同時）</b>：招いたカード（住人）を庭に置く（2枚まで置かずに持っておける）。カードと同じ色の魔素を乗せて★を育てる（何回でも）。「このラウンドを終える」で、庭のカードが左上から順に開花する。終えるまでは「1つ戻す」でやり直せる。ほかの人がしたことは、ラウンドが終わるまで見えない。</li>
    <li>手入れフェーズで得た魔素は、その場で使える。持てる魔素は10個まで（ラウンドの終わりにあふれた分を捨てる）。育てる魔素は強化で0個まで下がる。</li>
    <li>導きのカードは、★★から摘み方を曲げる（足す・入れ替える）。</li>
    <li>8ラウンド（短めは6）で終わり。カードの★の点、実り、お題カード（一番乗り5点・あとから3点）の合計で比べる。</li><li>キーワード：${glossaryHtml()}</li>
  </ol>`;
}

function attach(sess) {
  memo.clear(); // 新しいゲームは白い紙から
  session = sess;
  screen = 'game';
  ui = freshUi();
  render();
}

function startSolo({ name, n, rounds, seed, ids }) {
  cat = makeCatalog(ids);
  const players = [{ name }, ...Array.from({ length: n - 1 }, (_, i) => ({ name: `CPU${i + 1}`, cpu: 'normal' }))];
  const game = new GameHost(cat, { players, rounds, seed });
  game.onChange(render);
  attach(game);
  game.changed();
}

async function openRoom({ name, code, n, rounds, ids }) {
  busy = 'つないでいます…';
  renderSetup();
  try {
    const net = await openTrystero(code, { strategy: STRATEGY });
    const versions = Object.fromEntries(expansions.filter((e) => ids.includes(e.meta.id)).map((e) => [e.meta.id, e.meta.version]));
    room = new HostRoom(net, { name, count: n, rounds, expansions: ids, versions, makeCatalog });
    room.code = code;
    room.onChange(render);
    busy = '';
    screen = 'lobby';
    render();
  } catch (e) {
    busy = `つなげませんでした（${e.message}）`;
    renderSetup();
  }
}

async function joinRoom({ name, code }) {
  busy = 'つないでいます…';
  renderSetup();
  try {
    const net = await openTrystero(code, { strategy: STRATEGY });
    const guest = new GuestClient(net, { name, token: myToken() });
    guest.code = code;
    room = guest;
    guest.onChange(() => {
      const info = guest.lobbyInfo;
      if (info && !guest.problem) {
        const bad = info.expansions.filter((id) => expansions.find((e) => e.meta.id === id)?.meta.version !== info.versions[id]);
        if (bad.length) guest.problem = `カードの版がホストと違います（${bad.join('・')}）。ページを読み込み直してください。`;
        else if (!cat || cat.forRoom !== code) { cat = makeCatalog(info.expansions); cat.forRoom = code; }
      }
      if (guest.st && screen !== 'game' && !guest.problem) attach(guest);
      else render();
    });
    busy = '';
    screen = 'lobby';
    render();
  } catch (e) {
    busy = `つなげませんでした（${e.message}）`;
    renderSetup();
  }
}

function renderLobby() {
  const info = room instanceof HostRoom ? room.lobby() : room.lobbyInfo;
  const isHost = room instanceof HostRoom;
  const seats = info ? Array.from({ length: info.count }, (_, i) => info.seats[i]?.name ?? null) : [];
  app.innerHTML = `
  <main class="setup">
    <h1>部屋：<span class="code">${esc(room.code)}</span></h1>
    ${room.problem ? `<p class="error">${esc(room.problem)}</p>` : ''}
    ${info ? `<p>${info.count}人・${info.rounds}ラウンド・世界：${info.expansions.map(worldName).join('・')}</p>
      <ol class="seats">${seats.map((s, i) => `<li>${s ? esc(s) : '<span class="muted">（空き → 始めると CPU）</span>'}${i === 0 ? '（ホスト）' : ''}</li>`).join('')}</ol>`
    : '<p class="muted">ホストを探しています…（ホストが部屋を作っていないと見つかりません）</p>'}
    ${isHost ? `<p class="muted">入る人に合言葉「${esc(room.code)}」を伝えてください。全員そろったら始めます。</p>
      <button class="primary" data-act="lobby-start">はじめる</button>`
    : (info ? '<p class="muted">ホストが始めるのを待っています…</p>' : '')}
    <p><button data-act="lobby-leave">やめる</button></p>
  </main>`;
}

// ---- 操作を進める -----------------------------------------------------------

function act(a) {
  error = session.act(a) ?? '';
  if (!error && a.player === ME && a.type !== 'choose') ui = freshUi();
  if (a.type === 'choose') { ui.convFrom = null; ui.moveFrom = null; ui.discard = {}; }
  render();
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
    <div class="card-text">${stageLinesHtml(d, s - 1).join('<br>')}</div>
    ${showCost ? `<div class="card-cost">${costText(d.cost)}</div>` : ''}
    ${cost !== null ? `<div class="card-cost">育てる：${COLOR_JA[d.element]}${cost}</div>` : ''}
  </div>`;
}

function detailHtml() {
  if (!hover) return '<p class="muted">カードにマウスを乗せると、ここに★ごとの効果が出ます。</p>';
  const d = defById(hover.id);
  const g = GROWTH[d.growth];
  return `<div class="detail ${d.element}">
    <h3>${esc(d.name)}</h3>
    <p>${COLOR_JA[d.element]}・${ROLE_JA[d.role]}・${GROWTH_JA[d.growth]}（育てる魔素 ${g.join('・')}）・招く魔素 ${costText(d.cost)}・世界 ${esc(worldName(d.origin))}</p>
    ${[0, 1, 2].map((i) => `<div class="stage ${hover.stage === i + 1 ? 'now' : ''}"><b>${stars(i + 1)}</b>（${d.stages[i].points ?? 0}点）<br>${stageLinesHtml(d, i).join('<br>')}</div>`).join('')}
  </div>`;
}

function goalsHtml() { // 反応フェーズ中の取り方は、view がすでに「始まった時＋自分の分」にしてある
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
    if (!auto) return { mana: after.players[ME].mana, error: `「${defById(card.id).name}」は払えない（${k ? '2枚目は好きな色1が足される' : '魔素が足りない'}）`, lines };
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
      if (ch?.source && x?.uid === ch.source) cls += ' source';
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
  if (pl.choice) {
    const src = pl.garden.find((x) => x && x.uid === pl.choice.source);
    const from = src ? `<p class="source-note">「${esc(defById(src.id).name)}」（マス${pl.garden.indexOf(src) + 1}・光っているカード）の効果</p>` : '';
    return `${from}${choicePanel(pl)}${pl.history?.length ? '<p><button data-act="undo">1つ戻す</button></p>' : ''}`;
  }
  if (myDraftTurn()) return '<p>始まりのカードを、場から1枚招いてください（無料）。</p>';
  if (st.phase === 'draft') return `<p class="muted">${esc(nameOf(st.draftOrder[st.turn]))} が始まりのカードを選んでいます…</p>`;
  const waiting = pl.pending.length
    ? `<p class="muted">手元のカード（手入れフェーズで置く）：${pl.pending.map((c) => `<span data-card="${c.id}" data-stage="1">「${esc(defById(c.id).name)}」</span>`).join('')}</p>` : '';
  if (st.phase === 'pick') {
    if (!myPickTurn()) return `<p class="muted">${esc(nameOf(pickOrder(st)[st.turn]))} が摘んでいます…（場を見て次の手を考えられます）</p>${waiting}`;
    const pv = pickPreview();
    const swaps = bendCells('swap');
    const swapUi = swaps.length && ui.bundle !== null
      ? `<p>入れ替え（${swaps.map((c) => esc(defById(pl.garden[c].id).name)).join('・')}）：${ui.swap ? `束${ui.bundle + 1}の${ui.swap.give + 1}番目 ⇔ 束${ui.swap.other + 1}の${ui.swap.otherIdx + 1}番目 <button data-act="swap-clear">やめる</button>` : (ui.swapCell === null ? `<button data-act="swap-start" data-cell="${swaps[0]}">使う</button>` : (ui.give === null ? '摘む束の、替えたい魔素を押す' : '替える相手（別の束）の魔素を押す'))}</p>` : '';
    const adds = bendCells('add');
    const buyLines = (pv?.lines ?? []).map(({ k, card, cost, anyN }) => {
      const fixed = ELEMENTS.filter((c) => cost[c]).map((c) => `${COLOR_JA[c]}${cost[c]}`).join('・');
      const chips = anyN ? `　好きな色の払い：${(ui.anyPick[k] ?? []).map((c, j) => `<button class="chip" data-act="anychip" data-k="${k}" data-j="${j}" title="押すと色が変わる">${manaDot(c)}</button>`).join('')}` : '';
      return `<p>${k + 1}枚目「${esc(defById(card.id).name)}」：${fixed || '―'}${anyN ? `${fixed ? '・' : ''}好きな色${anyN}` : ''}${chips}</p>`;
    }).join('');
    return `<p><b>あなたの番</b>：束を1つ選んで摘む。招きたいカードがあれば、場のカードを2枚まで選ぶ（2枚目は好きな色1が足される）。</p>${waiting}
      ${adds.length ? `<p class="muted">足す（${adds.map((c) => esc(defById(pl.garden[c].id).name)).join('・')}）は自動で使います。</p>` : ''}
      ${swapUi}
      ${buyLines}
      ${pv?.mana ? `<p>摘んで払った後：${manaRow(pv.mana)}</p>` : ''}
      ${pv?.error ? `<p class="error">${esc(pv.error)}</p>` : ''}
      <button class="primary" data-act="pick" ${pv?.action && !pv.error ? '' : 'disabled'}>摘む${ui.markets.length ? `（カード${ui.markets.length}枚も招く）` : ''}</button>
      ${ui.markets.length ? '<button data-act="unbuy">カードは招かない</button>' : ''}`;
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
        ${cost !== null ? `<button class="primary" data-act="grow" ${pl.mana[d.element] >= cost ? '' : 'disabled'}>育てる（${COLOR_JA[d.element]}${cost}）</button>` : '★★★です'}
        ${hasUse ? `<button data-act="use" ${pl.used.includes(x.uid) ? 'disabled' : ''}>手入れ</button>` : ''}</p>`;
    }
    const over = pl.pending.length > HAND_LIMIT;
    return `${pend ? `<p><b>手元のカード</b>：カードを選んで、庭のマスを押すと置く${pl.garden.every(Boolean) ? '（庭が埋まっているので置き換え）' : ''}。置かずに${HAND_LIMIT}枚まで持っておける。</p><div class="row">${pend}</div>` : ''}
      <p>庭のカードを押すと、育てる・手入れができます。</p>${sel}
      <button class="primary" data-act="done" ${over ? 'disabled' : ''}>このラウンドを終える（開花）</button>
      <button data-act="undo" ${pl.history?.length ? '' : 'disabled'}>1つ戻す</button>
      ${over ? `<p class="error">手元のカードが${HAND_LIMIT}枚を超えています。置いてから終えてください。</p>` : ''}`;
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
      return '<p><b>★を育てるカードを選ぶ</b>：光っているマスを押す</p>';
    case 'move':
      return `<p><b>カードを動かす</b>：${ui.moveFrom === null ? '動かすカードを押す' : '動かす先のマスを押す（カードがあれば入れ替え）'}</p><button data-act="move-skip">動かさない</button>`;
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
  return st.players.filter((p) => p.index !== ME).map((pl) => { // 反応フェーズ中は、view が始まった時のまま見せる
    const s = scoreOf(cat, st, pl.index);
    const status = st.phase === 'react' ? (pl.status === 'done' ? '終えた' : '考え中') : '';
    const who = pl.away ? '（抜けた・CPU が代わり）' : (pl.cpu ? '（CPU）' : '');
    return `<div class="opp"><div class="opp-head"><b>${esc(pl.name)}</b><small class="muted">${who}</small><span>${s.total}点 ${status}</span></div>
      <div class="mana">${manaRow(pl.mana)}${pl.pending.length ? `<span class="muted">手元${pl.pending.length}枚</span>` : ''}</div>${gardenHtml(pl.index, true)}</div>`;
  }).join('');
}

// 拾う順（このラウンド）と、次のラウンドの先番
function orderHtml() {
  if (st.phase === 'end') return '';
  const order = st.phase === 'draft' ? st.draftOrder : pickOrder(st);
  const now = st.phase === 'draft' || st.phase === 'pick' ? order[st.turn] : -1;
  const names = order.map((p) => `<span class="${p === now ? 'now' : ''} ${p === ME ? 'me' : ''}">${esc(nameOf(p))}</span>`).join(' → ');
  const label = st.phase === 'draft' ? '始まりのカードを招く順' : '摘む順';
  const next = st.round < st.rounds ? `<span class="muted">次のラウンドの先番：<b>${esc(nameOf((st.firstPlayer + 1) % st.players.length))}</b></span>` : '<span class="muted">最後のラウンド</span>';
  return `<span class="order">${label}：${names}</span>${next}`;
}

function phaseName() {
  return { draft: '始まりのカード', pick: '採集フェーズ', react: '手入れフェーズ', end: '終わり' }[st.phase];
}

function endHtml() {
  if (st.phase !== 'end') return '';
  const mins = ((session.elapsed() ?? 0) / 60000).toFixed(1);
  const rows = [...st.result].sort((a, b) => a.rank - b.rank).map((r) => `<tr><td>${r.rank}位</td><td>${esc(nameOf(r.player))}</td><td>${r.stage}</td><td>${r.end}</td><td>${r.goals}</td><td><b>${r.total}</b></td><td>${r.stage3}</td><td>${st.players[r.player].discarded}</td></tr>`).join('');
  return `<div class="overlay"><div class="end">
    <h2>結果</h2>
    <table><tr><th></th><th>名前</th><th>★の点</th><th>実り</th><th>お題カード</th><th>合計</th><th>★★★</th><th>捨てた魔素</th></tr>${rows}</table>
    <p>かかった時間：${mins} 分（${st.rounds}ラウンド）</p>
    ${session.record ? '<p class="muted">「記録をコピー」で、このゲームの操作と時間を文字にできます。チャットに貼ると、同じゲームをそのまま再現して調べられます。</p><button data-act="copy">記録をコピー</button>' : '<p class="muted">記録は部屋を作った人がコピーできます。</p>'}
    <button class="primary" data-act="again">最初の画面へ</button>
  </div></div>`;
}

function render() {
  if (screen === 'setup') return renderSetup();
  if (screen === 'lobby') return renderLobby();
  st = session.view();
  ME = session.me;
  if (!st) return renderLobby();
  const pl = st.players[ME];
  const me = scoreOf(cat, st, ME);
  const lost = session.problem ? `<p class="error banner">${esc(session.problem)}</p>` : '';
  const shownError = error || session.error || '';
  app.innerHTML = `
  <header class="bar">
    <b>Gateway Garden</b>
    ${room ? `<span class="muted">部屋 ${esc(room.code)}</span>` : ''}
    <span>ラウンド ${st.round} / ${st.rounds}・${phaseName()}</span>
    ${orderHtml()}
    <span class="spacer"></span>
    <button data-act="explain" title="キーワードの後ろに説明を書くか">説明：${getExplain() ? 'あり' : 'なし'}</button>
    <button data-act="memo">メモ（落書き）</button>
    <button data-act="pool">カードの一覧</button>
    ${session.record ? '<button data-act="copy">記録をコピー</button>' : ''}
  </header>
  ${lost}
  <section class="board">
    <div class="col-left">
      <h2>お題カード</h2><div class="goals">${goalsHtml()}</div>
      <h2>束（摘む）</h2><div class="bundles">${bundlesHtml()}</div>
      <h2>場のカード（招く）</h2><div class="market">${marketHtml()}</div>
    </div>
    <div class="col-mid">
      <div class="me-head"><h2>${esc(pl.name)} の庭</h2><span>${me.total}点（★${me.stage}・実り${me.end}・お題${me.goals}）</span></div>
      <div class="mana big">${manaRow(pl.mana)}<span class="muted">上限 ${limitOf(cat, pl)}・合計 ${manaTotal(pl.mana)}</span></div>
      ${gardenHtml(ME)}
      <div class="panel">${shownError ? `<p class="error">${esc(shownError)}</p>` : ''}${actionPanel()}</div>
    </div>
    <div class="col-right">
      <div class="detail-box">${detailHtml()}</div>
      <h2>ほかの人</h2><div class="opps">${opponentsHtml()}</div>
      <h2>できごと</h2><ol class="log" reversed>${session.log().slice(-14).reverse().map((l) => `<li>${esc(l)}</li>`).join('')}</ol>
    </div>
  </section>
  ${endHtml()}
  ${poolOpen ? poolHtml() : ''}`;
}

// このゲームで使っている札の一覧。「あと何枚」は、場・全員の庭と手元・捨て札に見えている分を引いた数
function poolHtml() {
  const origins = Object.keys(cat.versions).map((id) => ({ id, name: expansions.find((e) => e.meta.id === id)?.meta.name ?? id }));
  poolState ??= allState(origins);
  const originNames = Object.fromEntries(origins.map((o) => [o.id, o.name]));
  const cards = cat.deckIds.map((id) => cat.cards[id]);
  return `<div class="overlay"><div class="pool">
    <div class="pool-head"><h2>このゲームのカード（各種類2枚）</h2><button data-act="pool-close">閉じる</button></div>
    ${filterHtml(origins, poolState)}
    ${listHtml(cards, poolState, { originNames, left: leftCounts(cat, st), copies: 2 })}
  </div></div>`;
}

app.addEventListener('change', (ev) => {
  if (poolOpen && ev.target.dataset.filter) { toggleFilter(poolState, ev.target); render(); }
});

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

function backToSetup() {
  room?.net?.leave?.();
  clearTimeout(session?.timer);
  session = null;
  room = null;
  st = null;
  screen = 'setup';
  render();
}

app.addEventListener('click', async (ev) => {
  const el = ev.target.closest('[data-act]');
  if (!el) return;
  const d = el.dataset;
  if (d.act === 'lobby-leave' || d.act === 'again') return backToSetup();
  if (d.act === 'lobby-start') {
    cat = room.makeCatalog(room.settings.expansions);
    const game = room.start(Math.floor(Math.random() * 1e9));
    game.onChange(render);
    attach(game);
    return;
  }
  if (!st || screen !== 'game') return;
  const pl = st.players[ME];
  const n = (k) => Number(d[k]);
  switch (d.act) {
    case 'memo': memo.toggle(); return;
    case 'explain': setExplain(!getExplain()); stored('gg-explain', getExplain() ? 'on' : 'off'); break;
    case 'pool': poolOpen = true; break;
    case 'pool-close': poolOpen = false; break;
    case 'copy':
      try { await navigator.clipboard.writeText(JSON.stringify(session.record)); el.textContent = 'コピーしました'; } catch { el.textContent = 'コピーできませんでした'; }
      return;
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
