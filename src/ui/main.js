// 画面：1人で遊ぶ（CPU と）・部屋を作る・部屋に入る。ルールの処理は src/core、ゲームの相手は src/net/session.js。
// 描くのは「自分から見た盤面」（session.view()）だけ。1人でも通信でも同じ描き方。
import { buildCatalog, copiesFor, applyAction, pickOrder, autoPay, buyCost, growCost, limitOf, manaTotal, scoreOf, MAX_BUYS, HAND_LIMIT } from '../core/game.js';
import { wantOf } from '../core/cpu.js';
import { ELEMENTS, GROWTH } from '../core/schema.js';
import { GOALS, GOAL_POINTS } from '../core/goals.js';
import { stageLinesHtml, costText, COLOR_JA, ROLE_JA, GROWTH_JA, stars, setExplain } from './describe.js';
import { GameHost, HostRoom, GuestClient } from '../net/session.js';
import { openTrystero } from '../net/trystero.js';
import { turnServers } from '../net/turn.js';
import { APP_VERSION } from '../version.js';
import { filterHtml, listHtml, allState, toggleFilter, leftCounts } from './cardlist.js';
import { installMemo } from './memo.js';
import { gemSvg } from './gems.js';
import { cardArt } from '../art/index.js';
import { goalArt } from '../art/goals.js';
import { installScene } from '../art/scene.js';
import { rulesHtml } from './rules.js';
import { capture as fxCapture, play as fxPlay, isCalm, setCalm } from './fx.js';

const memo = installMemo(); // 落書き（#6）。自分の画面だけに残る

let logOpen = false;  // 右のふちの「できごと」
let rulesOpen = false; // 右のふちの「遊び方」（対戦中もルールと流れの図を見られる）
let oppOpen = null;   // 上の帯で押した相手（詳しく見る）
let poolOpen = false; // ゲーム中の「札の一覧」（#8）
let poolState = null;

const app = document.getElementById('app');
installScene(); // 挿絵（夜空の島）の絵を CSS の変数に入れる
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

const freshUi = () => ({ bundle: null, markets: [], anyPick: {}, swapCell: null, give: null, swap: null, pending: null, pendingOff: false, cell: null, convFrom: null, moveFrom: null, discard: {} });
let lastCellTap = { cell: null, at: 0 }; // 同じマスを素早く2回押したら育てる
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
setExplain(false); // 説明はマウスを置いたときに出す。ゲーム画面の「説明：あり／なし」は工程7の判定 Z1 でなくした

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
// カードの上では世界を2文字くらいの略で出す（工程9 D5。全文はカードの説明に出す）
const worldShort = (id) => expansions.find((e) => e.meta.id === id)?.meta.short ?? worldName(id).slice(0, 2);
const makeCatalog = (ids) => buildCatalog(expansions.filter((e) => ids.includes(e.meta.id)));
// 使う世界（基本セットも外せる。少なくとも1つ。工程8：拡張だけで遊べるように）
const chosenExpansions = () => expansions.filter((e) => document.querySelector(`input[name="exp"][value="${e.meta.id}"]`)?.checked).map((e) => e.meta.id);

function renderSetup() {
  const exps = expansions.map((e) => `<label class="check"><input type="checkbox" name="exp" value="${e.meta.id}" checked> ${esc(e.meta.name)}（${e.cards.length}種類・版 ${e.meta.version}）</label>`).join('');
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
    // 人数・長さ・世界は、つないだ後に部屋の中で選ぶ（#9）
    body = `<label>合言葉 <input name="code" value="${randomCode()}" maxlength="24" required>（入る人に伝える）</label>
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
    <details class="rules"><summary>遊び方（ゲームの流れの図とルール）</summary>${rulesHtml()}</details>
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
      const ids = chosenExpansions();
      if (!ids.length) { busy = '使う世界を1つ以上選んでください。'; renderSetup(); return; }
      busy = '';
      startSolo({ name: nm, n: Number(f.get('players')), rounds: Number(f.get('rounds')), seed, ids });
    } else if (mode === 'host') {
      openRoom({ name: nm, code: f.get('code').trim() });
    } else {
      joinRoom({ name: nm, code: f.get('code').trim() });
    }
  });
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

const versionsOf = (ids) => Object.fromEntries(expansions.filter((e) => ids.includes(e.meta.id)).map((e) => [e.meta.id, e.meta.version]));

async function openRoom({ name, code, n = 3, rounds = 8, ids = expansions.map((e) => e.meta.id) }) {
  busy = 'つないでいます…';
  renderSetup();
  try {
    const net = await openTrystero(code, { strategy: STRATEGY, turnConfig: await turnServers() });
    room = new HostRoom(net, { name, count: n, rounds, expansions: ids, versions: versionsOf(ids), makeCatalog });
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
    const net = await openTrystero(code, { strategy: STRATEGY, turnConfig: await turnServers() });
    const guest = new GuestClient(net, { name, token: myToken() });
    guest.code = code;
    guest.since = Date.now();
    setTimeout(() => { if (room === guest && screen === 'lobby' && !guest.lobbyInfo) render(); }, SLOW_MS + 100);
    room = guest;
    guest.onChange(() => {
      const info = guest.lobbyInfo;
      if (info && !guest.problem) {
        const bad = info.expansions.filter((id) => expansions.find((e) => e.meta.id === id)?.meta.version !== info.versions[id]);
        if (bad.length) guest.problem = `カードの版がホストと違います（${bad.join('・')}）。ページを読み込み直してください。`;
        else {
          const key = `${code}:${info.expansions.join(',')}`; // 部屋の中で世界が変わったら作り直す
          if (!cat || cat.forRoom !== key) { cat = makeCatalog(info.expansions); cat.forRoom = key; }
        }
      }
      if (guest.st && screen !== 'game' && !guest.problem) attach(guest);
      else if (!guest.st && screen === 'game') { screen = 'lobby'; render(); } // ホストが部屋に戻した（#9）
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

// ホストが見つからないまま、これだけたったら「直接つながらない回線かも」と出す（#11：つながるまで1分ほどかかることがあるので2分）
const SLOW_MS = 120000;

// ホストだけが部屋の中でゲームセットを選ぶ（#9）。入った人には上の1行（人数・ラウンド・世界）で見える
function roomSettingsHtml(info) {
  const opt = (v, cur, label = v) => `<option value="${v}" ${Number(cur) === v ? 'selected' : ''}>${label}</option>`;
  const counts = [2, 3, 4].filter((n) => n >= info.seats.length);
  return `<form class="room-settings" onsubmit="return false">
    <label>人数 <select data-room="count">${counts.map((n) => opt(n, info.count)).join('')}</select>（人が足りない席は CPU）</label>
    <label>長さ <select data-room="rounds">${opt(8, info.rounds, 'ふつう（8ラウンド）')}${opt(6, info.rounds, '短め（6ラウンド）')}</select></label>
    <fieldset><legend>使う世界</legend>${expansions.map((e) => `<label class="check"><input type="checkbox" data-room="exp" value="${e.meta.id}" ${info.expansions.includes(e.meta.id) ? 'checked' : ''} ${info.expansions.length === 1 && info.expansions[0] === e.meta.id ? 'disabled' : ''}> ${esc(e.meta.name)}（${e.cards.length}種類）</label>`).join('')}</fieldset>
  </form>`;
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
    : `<p class="muted">ホストを探しています…（ホストが部屋を作っていないと見つかりません。ふつう1分くらい、回線によっては2分近くかかります）</p>
      ${room.since && Date.now() - room.since > SLOW_MS ? '<p class="error">まだ見つかりません。ホストとあなたのどちらかが、直接つながらない回線（越えにくい NAT）にいるのかもしれません。<a href="net-check.html" target="_blank">通信の確かめ</a>を2人とも開いて、結果を見比べてください。</p>' : ''}`}
    ${isHost ? `${roomSettingsHtml(info)}<p class="muted">入る人に合言葉「${esc(room.code)}」を伝えてください。全員そろったら始めます。終わったらこの部屋に戻り、つないだまま次のゲームを始められます。</p>
      <button class="primary" data-act="lobby-start">はじめる</button>`
    : (info ? '<p class="muted">ホストが始めるのを待っています…</p>' : '')}
    <p><button data-act="lobby-leave">やめる</button></p>
    <details class="rules"><summary>遊び方（ゲームの流れの図とルール）</summary>${rulesHtml()}</details>
  </main>`;
}

// ---- 操作を進める -----------------------------------------------------------

function act(a) {
  error = session.act(a) ?? '';
  if (!error && a.player === ME && a.type !== 'choose') {
    // 育てた・手入れしたカードは選んだままにする（ui.md の 1：続けて育てるのが1手）
    const keep = a.type === 'grow' || a.type === 'use' ? ui.cell : null;
    ui = freshUi();
    ui.cell = keep;
  }
  if (a.type === 'choose') { ui.convFrom = null; ui.moveFrom = null; ui.discard = {}; }
  render();
}
// ---- 描く部品 ---------------------------------------------------------------

const manaDot = (c, extra = '', size = 18) => `<span class="dot ${c}" ${extra}>${gemSvg(c, size)}</span>`;

function manaRow(m) {
  return ELEMENTS.map((c) => `<span class="mana-item">${manaDot(c)}<b>${m[c]}</b></span>`).join('');
}

// 値段を宝石で（決まった色の数だけ並べ、好きな色は虹の丸）
const costGems = (cost) => Object.entries(cost).flatMap(([c, n]) => Array(n).fill(c)).map((c) => manaDot(c, '', 14)).join('');

// 住人の絵（src/art/index.js が世界ごとに選ぶ）。まだ絵のない世界のカードは、世界の名前を出す
function artHtml(d, size) {
  return cardArt(d, size) ?? `<span class="noart">${esc(worldName(d.origin))}</span>`;
}

const nameCls = (name) => (name.length >= 8 ? 'longer' : name.length >= 7 ? 'long' : '');

function cardHtml(c, { stage = null, attrs = '', cls = '', showCost = false, cost = null } = {}) {
  const d = defById(c.id);
  const s = stage ?? 1;
  const pts = d.stages[s - 1].points ?? 0;
  const lines = stageLinesHtml(d, s - 1);
  const plain = lines.join('').replace(/<[^>]+>/g, '');
  return `<div class="card ${d.element} ${cls}" data-card="${c.id}" data-stage="${s}" ${attrs}>
    <div class="card-top"><span class="name ${nameCls(d.name)}">${esc(d.name)}</span>${stage ? `<span class="pips">${stars(stage)}</span>` : ''}</div>
    <div class="card-art">${artHtml(d, 48)}</div>
    <div class="card-mid">${ROLE_JA[d.role]}・${GROWTH_JA[d.growth]}${pts ? `・${pts}点` : ''}<span class="world-tag" title="${esc(worldName(d.origin))}">${esc(worldShort(d.origin))}</span></div>
    <div class="card-text ${plain.length > 28 ? 'long' : ''}">${lines.join('<br>')}</div>
    ${showCost ? `<div class="card-cost">${costGems(d.cost)}</div>` : ''}
    ${cost !== null ? `<div class="card-cost">育てる ${manaDot(d.element, '', 14)}${cost}</div>` : ''}
  </div>`;
}

function detailHtml() {
  if (!hover) return '<p class="muted">カードにマウスを乗せると、ここに★ごとの効果が出ます。</p>';
  const d = defById(hover.id);
  const g = GROWTH[d.growth];
  return `<div class="detail ${d.element}">
    <h3>${artHtml(d, 40)}${esc(d.name)}</h3>
    <p>${COLOR_JA[d.element]}・${ROLE_JA[d.role]}・${GROWTH_JA[d.growth]}（育てる魔素 ${g.join('・')}）・招く魔素 ${costText(d.cost)}・世界 ${esc(worldName(d.origin))}</p>
    ${[0, 1, 2].map((i) => `<div class="stage ${hover.stage === i + 1 ? 'now' : ''}"><b>${stars(i + 1)}</b>（${d.stages[i].points ?? 0}点）<br>${stageLinesHtml(d, i).join('<br>')}</div>`).join('')}
  </div>`;
}

// お題は立て札（工程9 G5）。順位の枠を先に縦に並べ、点を書いておく。満たした人の名前が枠に入る。
// 同じラウンドに満たした人は同じ順位。今満たすと入る枠を光らせる
function goalsHtml() { // 反応フェーズ中の取り方は、view がすでに「始まった時＋自分の分」にしてある
  return st.goals.map((g) => {
    const claims = st.claims[g];
    const rounds = [...new Set(claims.map((x) => x.round))].sort((a, b) => a - b);
    const nowRank = rounds.includes(st.round) ? rounds.indexOf(st.round) : rounds.filter((r) => r < st.round).length;
    const slots = GOAL_POINTS.filter((pt) => pt > 0).map((pt, i) => {
      const who = claims.filter((x) => rounds.indexOf(x.round) === i).map((x) => `<span class="${x.player === ME ? 'me' : ''}">${esc(nameOf(x.player))}</span>`).join('');
      return `<li class="${who ? 'taken' : ''} ${i === nowRank && st.phase !== 'end' ? 'next' : ''}"><b>${i + 1}位</b><em>${pt}点</em><span class="slot-who">${who}</span></li>`;
    }).join('');
    return `<div class="goal"><div class="goal-art">${goalArt(g, 40)}</div><div><b>${GOALS[g].name}</b><span>${GOALS[g].text}</span></div><ol class="goal-slots">${slots}</ol></div>`;
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
    return `<div class="bundle ${sel ? 'sel' : ''} ${mine ? 'can' : ''}" data-act="bundle" data-b="${i}">${dots}</div>`;
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
    return `<div class="cell ${cls}" ${attrs}>${p === ME && !mini && ui.cell === i ? cellBar(pl, i) : ''}${mini ? `<div class="mini-card ${defById(x.id).element}" data-card="${x.id}" data-stage="${x.stage}" title="${esc(defById(x.id).name)}">${artHtml(defById(x.id), 28)}<b>${stars(x.stage)}</b></div>` : cardHtml(x, { stage: x.stage, cost })}</div>`;
  }).join('')}</div>`;
}

// 選んだ庭のカードの下の方に、育てる・手入れのボタンを重ねて出す（工程9 D2。前は約560px 先の「あなたのすること」）
function cellBar(pl, i) {
  if (st.phase !== 'react' || pl.status !== 'acting' || pl.choice) return '';
  const x = pl.garden[i];
  const d = defById(x.id);
  const cost = x.stage < 3 ? growCost(cat, pl, i) : null;
  const hasUse = d.stages[x.stage - 1].effects.some((e) => e.when === 'use');
  if (cost === null && !hasUse) return '';
  return `<div class="cell-bar">
    ${cost !== null ? `<button class="primary" data-act="grow" ${pl.mana[d.element] >= cost ? '' : 'disabled title="魔素が足りない"'}>育てる ${manaDot(d.element, '', 14)}${cost}</button>` : ''}
    ${hasUse ? `<button data-act="use" ${pl.used.includes(x.uid) ? 'disabled title="このラウンドはもう使った"' : ''}>手入れ</button>` : ''}
  </div>`;
}

// 自分のすること
function actionPanel() {
  const pl = st.players[ME];
  if (st.phase === 'end') return '';
  if (pl.choice) {
    const src = pl.garden.find((x) => x && x.uid === pl.choice.source);
    const from = src ? `<p class="source-note">「${esc(defById(src.id).name)}」（マス${pl.garden.indexOf(src) + 1}・光っているカード）の効果</p>` : '';
    return `<div class="panel-body">${from}${choicePanel(pl)}</div>${pl.history?.length ? '<div class="panel-foot"><button data-act="undo">1つ戻す</button></div>' : ''}`;
  }
  if (myDraftTurn()) return '<p>始まりのカードを、場から1枚招いてください（無料）。上の「場のカード」を押します。</p>';
  if (st.phase === 'draft') return `<p class="muted">${esc(nameOf(st.draftOrder[st.turn]))} が始まりのカードを選んでいます…</p>`;
  const waiting = pl.pending.length
    ? `<p class="muted">手元のカード（手入れフェーズで置く）</p><div class="row">${pl.pending.map((c) => cardHtml(c)).join('')}</div>` : '';
  if (st.phase === 'pick') {
    if (!myPickTurn()) return `<p class="muted">${esc(nameOf(pickOrder(st)[st.turn]))} が摘んでいます…（場を見て次の手を考えられます）</p>${waiting}`;
    return pickPanel(waiting);
  }
  return reactPanel(pl);
}

// 入れ替えの導きは、束の欄の中で使う（工程9 D4：束のそば）
function swapHtml() {
  if (!myPickTurn()) return '';
  const pl = st.players[ME];
  const swaps = bendCells('swap');
  if (!swaps.length) return '';
  const names = swaps.map((c) => esc(defById(pl.garden[c].id).name)).join('・');
  let body;
  if (ui.bundle === null) body = '<span class="muted">束を選ぶと使える</span>';
  else if (ui.swap) body = '印の2つを入れ替える <button data-act="swap-clear">やめる</button>';
  else if (ui.swapCell === null) body = `<button data-act="swap-start" data-cell="${swaps[0]}">入れ替える</button>`;
  else body = ui.give === null ? '選んだ束の、替えたい魔素を押す' : '替える相手（別の束）の魔素を押す';
  return `<div class="swap-box"><small>入れ替え（${names}）</small><div>${body}</div></div>`;
}

// 採集フェーズの自分の番：払いと摘むボタン（工程9 D4：「あなたのすること」に戻し、ボタンは欄の下に固定）
function pickPanel(waiting) {
  const pl = st.players[ME];
  {
    const pv = pickPreview();
    const adds = bendCells('add');
    const buyLines = (pv?.lines ?? []).map(({ k, card, cost, anyN }) => {
      const fixed = ELEMENTS.filter((c) => cost[c]).map((c) => `${COLOR_JA[c]}${cost[c]}`).join('・');
      const chips = anyN ? `　好きな色の払い：${(ui.anyPick[k] ?? []).map((c, j) => `<button class="chip" data-act="anychip" data-k="${k}" data-j="${j}" title="押すと色が変わる">${manaDot(c)}</button>`).join('')}` : '';
      return `<p>${k + 1}枚目「${esc(defById(card.id).name)}」：${fixed || '―'}${anyN ? `${fixed ? '・' : ''}好きな色${anyN}` : ''}${chips}</p>`;
    }).join('');
    return `<div class="panel-body"><p><b>あなたの番</b>：上の束を1つ選ぶ。招くなら場のカードを2枚まで（2枚目は好きな色1が足される）。</p>${waiting}
      ${adds.length ? `<p class="muted">足す（${adds.map((c) => esc(defById(pl.garden[c].id).name)).join('・')}）は自動で使います。</p>` : ''}
      ${buyLines}
      ${pv?.mana ? `<p>摘んで払った後：${manaRow(pv.mana)}</p>` : ''}
      ${pv?.error ? `<p class="error">${esc(pv.error)}</p>` : ''}</div>
      <div class="panel-foot"><button class="primary" data-act="pick" ${pv?.action && !pv.error ? '' : 'disabled title="束を選ぶと押せる"'}>摘む${ui.markets.length ? `（カード${ui.markets.length}枚も招く）` : ''}</button>
      ${ui.markets.length ? '<button data-act="unbuy">カードは招かない</button>' : ''}</div>`;
  }
}

// 手入れフェーズの「あなたのすること」。終える・戻すボタンは欄の下に固定（ui.md の 5：押す場所が動かない）
function reactPanel(pl) {
  if (st.phase === 'react') {
    if (pl.status === 'done') return '<p class="muted">このラウンドは終えました。ほかの人を待っています…</p>';
    const pend = pl.pending.map((c, i) => cardHtml(c, { cls: `can ${ui.pending === i ? 'sel' : ''}`, attrs: `data-act="pending" data-i="${i}" draggable="true" data-drag="${i}"` })).join('');
    const sel = ui.cell !== null && pl.garden[ui.cell] && !cellBar(pl, ui.cell) ? `<p class="muted">「${esc(defById(pl.garden[ui.cell].id).name)}」は★★★です。</p>` : '';
    const over = pl.pending.length > HAND_LIMIT;
    return `<div class="panel-body">${pend ? `<p><b>手元のカード</b>：庭の${pl.garden.every(Boolean) ? 'マスへ（庭が埋まっているので置き換え）' : '空いたマスへ'}ドラッグして置く（押して選び、マスを押しても置ける）。置かずに${HAND_LIMIT}枚まで持っておける。</p><div class="row">${pend}</div>` : ''}
      <p>庭のカードを押すと、カードの下に育てる・手入れのボタンが出ます（同じカードを素早く2回押しても育つ）。</p>${sel}
      ${over ? `<p class="error">手元のカードが${HAND_LIMIT}枚を超えています。置いてから終えてください。</p>` : ''}</div>
      <div class="panel-foot"><button class="primary" data-act="done" ${over ? 'disabled' : ''}>このラウンドを終える（開花）</button>
      <button data-act="undo" ${pl.history?.length ? '' : 'disabled'}>1つ戻す</button></div>`;
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

// 上の帯の相手（奥に座っている人）。工程7の判定 Z1：タブのような1行（名前の隣に魔素）、押すと庭を詳しく見られる。
// 手入れフェーズ中は、フェーズが始まった時のまま
function opponentBoxes() {
  return st.players.filter((p) => p.index !== ME).map((pl) => {
    const s = scoreOf(cat, st, pl.index);
    const status = st.phase === 'react' ? (pl.status === 'done' ? '終えた' : '考え中') : '';
    const who = pl.resigned ? '投了・CPU が代わり' : pl.away ? '抜けた・CPU が代わり' : (pl.cpu ? 'CPU' : '');
    const now = (st.phase === 'pick' && pickOrder(st)[st.turn] === pl.index) || (st.phase === 'draft' && st.draftOrder[st.turn] === pl.index);
    return `<button class="opp-box ${now ? 'now' : ''} ${oppOpen === pl.index ? 'open' : ''}" data-act="opp" data-p="${pl.index}" title="${who ? `${who}・` : ''}押すと庭を詳しく見る">
      <b class="ob-name">${esc(pl.name)}</b>
      <span class="ob-mana">${ELEMENTS.map((c) => `<span class="mana-item">${manaDot(c, '', 13)}${pl.mana[c]}</span>`).join('')}</span>
      ${pl.pending.length ? `<small class="muted">手元${pl.pending.length}</small>` : ''}
      ${status ? `<small class="ob-status ${pl.status === 'done' ? 'done' : ''}">${status}</small>` : ''}
      <span class="ob-score">${s.total}点</span>
    </button>`;
  }).join('');
}

function oppDetailHtml() {
  const pl = st.players[oppOpen];
  if (!pl) return '';
  const s = scoreOf(cat, st, oppOpen);
  const note = st.phase === 'react' ? '<p class="muted">手入れフェーズ中は、このフェーズが始まった時の庭を見せています。</p>' : '';
  return `<div class="overlay" data-act="opp-close"><div class="pool opp-detail" data-stop>
    <div class="pool-head"><h2>${esc(pl.name)}の庭　${s.total}点（★${s.stage}・実り${s.end}・お題${s.goals}）</h2><button data-act="opp-close">閉じる</button></div>
    ${note}<div class="mana">${manaRow(pl.mana)}${pl.pending.length ? `<span class="muted">手元のカード：${pl.pending.map((c) => `「${esc(defById(c.id).name)}」`).join('')}</span>` : ''}</div>
    <div class="board-slab">${gardenHtml(oppOpen)}</div>
  </div></div>`;
}

function logHtml() {
  return `<div class="overlay" data-act="log-close"><div class="pool" data-stop>
    <div class="pool-head"><h2>できごと</h2><button data-act="log-close">閉じる</button></div>
    <ol class="log full" reversed>${session.log().slice().reverse().map((l) => `<li>${esc(l)}</li>`).join('')}</ol>
  </div></div>`;
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
  const reveal = !endRevealed;
  endRevealed = true;
  const sorted = [...st.result].sort((a, b) => a.rank - b.rank);
  const rows = sorted.map((r, k) => `<tr class="${reveal ? 'reveal' : ''} ${r.rank === 1 ? 'first' : ''}" style="--d:${(sorted.length - 1 - k) * 0.45}s"><td>${r.rank === 1 ? '<span class="crown">♛</span>' : ''}${r.rank}位</td><td>${esc(nameOf(r.player))}${st.players[r.player].resigned ? '<small class="muted">（投了）</small>' : ''}</td><td>${r.stage}</td><td>${r.end}</td><td>${r.goals}</td><td><b>${r.total}</b></td><td>${r.stage3}</td><td>${st.players[r.player].discarded}</td></tr>`).join('');
  return `<div class="overlay"><div class="end">
    <h2>結果</h2>
    <table><tr><th></th><th>名前</th><th>★の点</th><th>実り</th><th>お題カード</th><th>合計</th><th>★★★</th><th>捨てた魔素</th></tr>${rows}</table>
    <p>かかった時間：${mins} 分（${st.rounds}ラウンド）</p>
    ${session.record ? '<p class="muted">「記録をコピー」で、このゲームの操作と時間を文字にできます。チャットに貼ると、同じゲームをそのまま再現して調べられます。</p><button data-act="copy">記録をコピー</button>' : '<p class="muted">記録は部屋を作った人がコピーできます。</p>'}
    ${endButtons()}
  </div></div>`;
}

// 終わった後：通信の部屋なら部屋に戻って次のゲーム、1人ならセットを選び直す（#9）
function endButtons() {
  if (room instanceof HostRoom) return '<button class="primary" data-act="room-back">部屋に戻る（次のゲームへ）</button>';
  if (room) return '<p class="muted">ホストが部屋に戻すと、次のゲームの待合室に移ります。</p><button data-act="again">部屋から出る</button>';
  return '<button class="primary" data-act="again">セットを選び直す</button>';
}

let dragging = false; // 手元のカードを運んでいる間は描き直さない（運んでいるカードが消えないように）
let renderLater = false;
let lastView = null; // エフェクト（fx.js）：前に描いた盤面とくらべる
let endRevealed = false; // 順位の発表（H3）は1回だけ

function render() {
  if (dragging) { renderLater = true; return; }
  if (screen === 'setup') return renderSetup();
  if (screen === 'lobby') return renderLobby();
  st = session.view();
  ME = session.me;
  if (!st) { lastView = null; return renderLobby(); }
  const fxBefore = fxCapture();
  if (st.phase !== 'end') endRevealed = false;
  const pl = st.players[ME];
  const me = scoreOf(cat, st, ME);
  const lost = session.problem ? `<p class="error banner">${esc(session.problem)}</p>` : '';
  const shownError = error || session.error || '';
  // 対面の配置（工程7・人の案、判定 Z1 で詰めた）：奥（上の帯）に相手、真ん中に場、手前に自分の庭とすること。
  // 右のふちのタブに「できごと」「カードの一覧」「メモ」「記録をコピー」
  app.innerHTML = `
  <header class="topbar">
    <div class="tb-round"><b>ラウンド ${st.round} / ${st.rounds}</b><span class="tb-phase">${phaseName()}</span><small>${orderHtml()}</small>${room ? `<small class="muted">部屋 ${esc(room.code)}</small>` : ''}</div>
    <div class="tb-opps">${opponentBoxes()}</div>
  </header>
  ${lost}
  <main class="table">
    <div class="row-top">
      <section class="sec a-bundles isle"><h2 class="sec-title">束（摘む）</h2><div class="isle-trunk"></div><div class="bundles">${bundlesHtml()}</div>${swapHtml()}</section>
      <section class="sec a-market isle"><h2 class="sec-title">場のカード（招く）</h2><div class="isle-glow"></div><div class="isle-path"></div><div class="isle-gate"></div><div class="market">${marketHtml()}</div></section>
    </div>
    <div class="row-bottom">
      <section class="sec a-goals"><h2 class="sec-title">お題カード</h2><div class="goals">${goalsHtml()}</div></section>
      <section class="sec a-garden mine">
        <h2 class="sec-title">${esc(pl.name)}の庭</h2>
        <div class="me-head"><span class="me-score">${me.total}点（★${me.stage}・実り${me.end}・お題${me.goals}）</span><span class="mana big">${manaRow(pl.mana)}<span class="muted">上限 ${limitOf(cat, pl)}・合計 ${manaTotal(pl.mana)}</span></span></div>
        <div class="board-slab">${gardenHtml(ME)}</div>
      </section>
      <section class="sec a-action"><h2 class="sec-title">あなたのすること</h2><div class="panel">${shownError ? `<p class="error">${esc(shownError)}</p>` : ''}${actionPanel()}</div></section>
    </div>
  </main>
  <nav class="sidetabs">
    <button data-act="rules-open">遊び方</button>
    <button data-act="log-open">できごと</button>
    <button data-act="pool">カードの一覧</button>
    <button data-act="memo">メモ</button>
    ${st.phase !== 'end' ? '<button data-act="resign" title="途中でゲームをやめる">投了</button>' : ''}
    <button data-act="calm" title="飛ぶ・歩く動きをなくし、光るだけにする">${isCalm() ? '動きを戻す' : '動きを減らす'}</button>
    ${session.record ? '<button data-act="copy">記録をコピー</button>' : ''}
  </nav>
  ${endHtml()}
  ${poolOpen ? poolHtml() : ''}
  ${logOpen ? logHtml() : ''}
  ${rulesOpen ? `<div class="overlay" data-act="rules-close"><div class="pool rules-pop" data-stop><div class="pool-head"><h2>遊び方</h2><button data-act="rules-close">閉じる</button></div>${rulesHtml()}</div></div>` : ''}
  ${oppOpen !== null ? oppDetailHtml() : ''}`;
  fxPlay(lastView, st, ME, fxBefore, { pickOrder });
  lastView = st;
}

// このゲームで使っている札の一覧。「あと何枚」は、場・全員の庭と手元・捨て札に見えている分を引いた数
function poolHtml() {
  const origins = Object.keys(cat.versions).map((id) => ({ id, name: expansions.find((e) => e.meta.id === id)?.meta.name ?? id }));
  poolState ??= allState(origins);
  const originNames = Object.fromEntries(origins.map((o) => [o.id, o.name]));
  const cards = cat.deckIds.map((id) => cat.cards[id]);
  return `<div class="overlay"><div class="pool">
    <div class="pool-head"><h2>このゲームのカード（各種類${copiesFor(cat)}枚）</h2><button data-act="pool-close">閉じる</button></div>
    ${filterHtml(origins, poolState)}
    ${listHtml(cards, poolState, { originNames, left: leftCounts(cat, st, copiesFor(cat)), copies: copiesFor(cat) })}
  </div></div>`;
}

app.addEventListener('change', (ev) => {
  const k = ev.target.dataset.room; // 部屋のゲームセット（ホストだけ）
  if (k && room instanceof HostRoom) {
    if (k === 'exp') {
      const ids = expansions.map((e) => e.meta.id).filter((id) => app.querySelector(`[data-room="exp"][value="${id}"]`)?.checked);
      if (!ids.length) return render(); // 少なくとも1つ
      room.setSettings({ expansions: ids, versions: versionsOf(ids) });
    } else room.setSettings({ [k]: Number(ev.target.value) });
    return;
  }
  if (poolOpen && ev.target.dataset.filter) { toggleFilter(poolState, ev.target); render(); }
});

// ---- 手元のカードを庭へ運ぶ（工程9 D3：ドラッグ＆ドロップ） -------------------------
app.addEventListener('dragstart', (ev) => {
  const el = ev.target.closest?.('[data-drag]');
  if (!el || !st || st.phase !== 'react') return;
  ev.dataTransfer.setData('text/plain', el.dataset.drag);
  ev.dataTransfer.effectAllowed = 'move';
  dragging = true;
  tip.hidden = true;
  app.classList.add('dragging');
  if (st.players[ME].garden.every(Boolean)) app.classList.add('dragging-full');
});
app.addEventListener('dragover', (ev) => {
  const cell = ev.target.closest?.('.a-garden [data-act="cell"]');
  if (!dragging || !cell) return;
  if (!st.players[ME].garden.every(Boolean) && !cell.classList.contains('empty')) return;
  ev.preventDefault();
  for (const c of app.querySelectorAll('.drop-over')) if (c !== cell) c.classList.remove('drop-over');
  cell.classList.add('drop-over');
});
app.addEventListener('drop', (ev) => {
  const cell = ev.target.closest?.('.a-garden [data-act="cell"]');
  if (!dragging || !cell) return;
  ev.preventDefault();
  const i = Number(ev.dataTransfer.getData('text/plain'));
  endDrag();
  act({ type: 'place', player: ME, pending: i, cell: Number(cell.dataset.cell) });
});
app.addEventListener('dragend', () => endDrag());
function endDrag() {
  if (!dragging) return;
  dragging = false;
  app.classList.remove('dragging', 'dragging-full');
  if (renderLater) { renderLater = false; render(); }
}

// ---- 押したとき ---------------------------------------------------------------

// カードの説明は、マウスを乗せたカードのすぐ横に出す（工程9 D1。前は右下の欄で、庭から約1000px 離れていた）。
// 画面の描き直しで消えないよう、#app の外に置く
const tip = document.createElement('div');
tip.className = 'card-tip';
tip.hidden = true;
document.body.append(tip);
function showTip(el) {
  tip.innerHTML = detailHtml();
  tip.hidden = false;
  const r = (el.closest('.card, .mini-card, .fullcard') ?? el).getBoundingClientRect();
  const w = tip.offsetWidth;
  const h = tip.offsetHeight;
  const right = r.right + 8 + w <= window.innerWidth;
  tip.style.left = `${right ? r.right + 8 : Math.max(8, r.left - 8 - w)}px`;
  tip.style.top = `${Math.max(8, Math.min(r.top, window.innerHeight - h - 8))}px`;
}
document.addEventListener('mouseover', (ev) => {
  const el = ev.target.closest?.('[data-card]');
  if (!el || !st || screen !== 'game' || dragging) { if (!el) tip.hidden = true; return; }
  hover = { id: el.dataset.card, stage: Number(el.dataset.stage) };
  showTip(el);
});

// 投了（#10）：1人なら、セットの選択に戻る。ホストなら、全員のゲームを終えて部屋に戻る。
// 入った人なら、席を CPU に任せて部屋から出る（結果の表に「投了」）
function resign() {
  if (st?.phase === 'end') return;
  const text = room instanceof HostRoom ? '投了すると、全員のゲームを終えて部屋（待合室）に戻ります。よいですか？'
    : room ? '投了すると、あなたの席は CPU が代わりに遊び、あなたは部屋から出ます。よいですか？'
      : 'ゲームをやめて、セットの選択に戻りますか？';
  if (!window.confirm(text)) return;
  if (room instanceof HostRoom) return backToRoom();
  if (room) { room.resign(); setTimeout(backToSetup, 400); return; } // 投了が届いてから抜ける
  backToSetup();
}

function backToRoom() {
  lastView = null; // 前のゲームとくらべて演出しないように
  clearTimeout(session?.timer);
  room.backToRoom();
  session = null;
  st = null;
  screen = 'lobby';
  render();
}

function backToSetup() {
  lastView = null; // 前のゲームとくらべて演出しないように
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
  if (d.act === 'room-back' && room instanceof HostRoom) return backToRoom();
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
    case 'calm': setCalm(!isCalm()); render(); return;
    case 'resign': return resign();
    case 'pool': poolOpen = true; break;
    case 'log-open': logOpen = true; break;
    case 'rules-open': rulesOpen = true; break;
    case 'rules-close': if (ev.target.closest('[data-stop]') && !ev.target.closest('button')) return; rulesOpen = false; break;
    case 'log-close': if (ev.target.closest('[data-stop]') && !ev.target.closest('button')) return; logOpen = false; break;
    case 'opp': oppOpen = oppOpen === n('p') ? null : n('p'); break;
    case 'opp-close': if (ev.target.closest('[data-stop]') && !ev.target.closest('button')) return; oppOpen = null; break;
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
    case 'pending': ui.pending = ui.pending === n('i') ? null : n('i'); ui.pendingOff = ui.pending === null; ui.cell = null; break;
    case 'cell': {
      const i = n('cell');
      const ch = pl.choice;
      if (ch?.kind === 'stageUp') return act({ type: 'choose', player: ME, value: i });
      if (ch?.kind === 'move') {
        if (ui.moveFrom === null) { if (ch.from.includes(i)) ui.moveFrom = i; break; }
        return act({ type: 'choose', player: ME, value: { from: ui.moveFrom, to: i } });
      }
      if (st.phase !== 'react') break;
      const full = pl.garden.every(Boolean);
      if (ui.pending !== null && (!pl.garden[i] || full)) return act({ type: 'place', player: ME, pending: ui.pending, cell: i });
      // 同じカードを素早く2回押すと育てる（ui.md の 1：育てるのが1手）
      const now = Date.now();
      if (pl.garden[i] && ui.cell === i && lastCellTap.cell === i && now - lastCellTap.at < 400 && !pl.choice) {
        lastCellTap = { cell: null, at: 0 };
        const x = pl.garden[i];
        if (x.stage < 3 && pl.mana[defById(x.id).element] >= growCost(cat, pl, i)) return act({ type: 'grow', player: ME, cell: i });
        break;
      }
      lastCellTap = { cell: i, at: now };
      ui.cell = pl.garden[i] ? i : null;
      if (pl.garden[i]) { ui.pending = null; ui.pendingOff = true; }
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
