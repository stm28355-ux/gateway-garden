// エフェクト（工程9 H1〜H10）。描き直しの前後の盤面をくらべて、起きたことを画面の上の層（#fx-layer）に描く。
// ゲームの画面は描き直しで作り直されるので、動きはなるべく上の層に置く。通信の量は増えない（どの人も自分の画面で描く）。
//   H1 育てた（RankUp）  H2 開花を左上から順に  H3 順位の発表（main.js の endHtml）  H4 お題を取った
//   H5 束を摘んだ  H6 場に新しいカード・招いたカード  H7 庭に置いた（来訪）  H8 ラウンドの始まり・あなたの番
//   H9 いつも動く飾り（style.css）  H10 動きを減らす（calm：光るだけ。飛ぶ・歩くはしない）
import { gemSvg } from './gems.js';

const ELEMENTS = ['white', 'red', 'blue', 'green', 'yellow'];
const STEP = 420; // 開花で1枚ずつ光る間（ミリ秒）

let calm = false;
try { calm = localStorage.getItem('gg-calm') === '1'; } catch { /* 使えなくてもよい */ }
if (globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) calm = true;
export const isCalm = () => calm;
export function setCalm(v) {
  calm = v;
  document.body.classList.toggle('calm', v);
  try { localStorage.setItem('gg-calm', v ? '1' : '0'); } catch { /* 使えなくてもよい */ }
}

let layer = null;
function ensureLayer() {
  if (layer?.isConnected) return layer;
  layer = document.createElement('div');
  layer.id = 'fx-layer';
  document.body.append(layer);
  document.body.classList.toggle('calm', calm);
  return layer;
}

const center = (r) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
const rectOf = (sel) => document.querySelector(sel)?.getBoundingClientRect() ?? null;
const later = (ms, fn) => setTimeout(fn, ms);

function spawn(cls, html, r, ms) {
  const el = document.createElement('div');
  el.className = `fx ${cls}`;
  el.innerHTML = html;
  if (r) Object.assign(el.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
  ensureLayer().append(el);
  later(ms, () => el.remove());
  return el;
}

// 枠を光らせる（calm でもする）
function glow(r, color = '#ffe28a', ms = 700) {
  if (!r) return;
  const el = spawn('fx-glow', '', r, ms);
  el.style.setProperty('--c', color);
  el.animate([{ opacity: 0, transform: 'scale(.96)' }, { opacity: 1, transform: 'scale(1.02)', offset: 0.3 }, { opacity: 0, transform: 'scale(1.06)' }], { duration: ms, easing: 'ease-out' });
}

// 物が a から b へ飛ぶ（calm ではしない）
function fly(html, a, b, { delay = 0, ms = 650, size = 22, arc = -60 } = {}) {
  if (calm || !a || !b) return;
  later(delay, () => {
    const el = spawn('fx-fly', html, { left: a.x - size / 2, top: a.y - size / 2, width: size, height: size }, ms + 50);
    const dx = b.x - a.x, dy = b.y - a.y;
    el.animate([
      { transform: 'translate(0, 0) scale(1)', opacity: 1 },
      { transform: `translate(${dx * 0.5}px, ${dy * 0.5 + arc}px) scale(1.25)`, opacity: 1, offset: 0.5 },
      { transform: `translate(${dx}px, ${dy}px) scale(.7)`, opacity: 0.2 },
    ], { duration: ms, easing: 'ease-in-out', fill: 'forwards' });
  });
}

// 花びら・きらきらを散らす
function burst(r, colors, n = 10, ms = 700) {
  if (!r || calm) return;
  const c = center(r);
  for (let i = 0; i < n; i++) {
    const el = spawn('fx-bit', '', { left: c.x - 3, top: c.y - 3, width: 6, height: 6 }, ms + 50);
    el.style.background = colors[i % colors.length];
    const a = (Math.PI * 2 * i) / n + Math.random() * 0.5, d = 30 + Math.random() * 40;
    el.animate([{ transform: 'translate(0,0)', opacity: 1 }, { transform: `translate(${Math.cos(a) * d}px, ${Math.sin(a) * d - 20}px) rotate(${Math.random() * 360}deg)`, opacity: 0 }],
      { duration: ms, easing: 'cubic-bezier(.2,.7,.4,1)', fill: 'forwards' });
  }
}

// 文字の札（RANK UP・＋5点・あなたの番 など）
function label(text, r, cls = '', ms = 1000) {
  if (!r) return;
  const c = center(r);
  const el = spawn(`fx-label ${cls}`, text, null, ms);
  Object.assign(el.style, { left: `${c.x}px`, top: `${c.y}px` });
  el.animate([{ transform: 'translate(-50%, -30%) scale(.6)', opacity: 0 }, { transform: 'translate(-50%, -60%) scale(1.1)', opacity: 1, offset: 0.25 },
    { transform: 'translate(-50%, -90%) scale(1)', opacity: 0 }], { duration: ms, easing: 'ease-out', fill: 'forwards' });
}

// 光の線（呼応）
function beam(a, b, delay) {
  if (!a || !b) return;
  later(delay, () => {
    const len = Math.hypot(b.x - a.x, b.y - a.y), ang = Math.atan2(b.y - a.y, b.x - a.x);
    const el = spawn('fx-beam', '', { left: a.x, top: a.y - 2, width: len, height: 4 }, 700);
    el.style.transform = `rotate(${ang}rad)`;
    el.animate([{ clipPath: 'inset(0 100% 0 0)', opacity: 1 }, { clipPath: 'inset(0 0 0 0)', opacity: 1, offset: 0.5 }, { clipPath: 'inset(0 0 0 0)', opacity: 0 }], { duration: 700, fill: 'forwards' });
  });
}

const gem = (c, size = 22) => (c === 'any' ? '<span class="fx-any"></span>' : gemSvg(c, size));

// ---- 描き直しの前に、今の場所を覚える ----------------------------------------
export function capture() {
  const q = (sel) => [...document.querySelectorAll(sel)];
  const r = (el) => el.getBoundingClientRect();
  return {
    bundles: Object.fromEntries(q('.a-bundles .bundle[data-b]').map((el) => [el.dataset.b, r(el)])),
    market: Object.fromEntries(q('.a-market .card[data-i]').map((el) => [el.dataset.i, { rect: r(el), html: el.outerHTML }])),
  };
}

// 相手の行き先（上の帯のタブ）・自分の行き先
const playerTarget = (st, me, p, mine) => (p === me ? rectOf(mine) : rectOf(`.opp-box[data-p="${p}"]`));
const cellRect = (i) => rectOf(`.a-garden [data-cell="${i}"]`);
const pickNow = (st, order) => (st.phase === 'pick' ? order(st)[st.turn] : st.phase === 'draft' ? st.draftOrder[st.turn] : -1);

// ---- 描き直しの後に、起きたことを描く ----------------------------------------
export function play(prev, st, me, before, { pickOrder }) {
  if (!prev || !st || st.round < prev.round || (prev.phase === 'end' && st.phase !== 'end')) return; // 新しいゲーム
  ensureLayer();
  const pPl = prev.players[me], pl = st.players[me];

  // H8 ラウンドの始まり
  if (st.round > prev.round && st.phase !== 'end') roundBanner(st.round, st.rounds);

  // H5 束を摘んだ：摘んだ人の魔素が増えた色だけ、束から飛ぶ
  if (prev.phase === 'pick' && (st.turn !== prev.turn || st.phase !== 'pick' || st.round !== prev.round)) {
    const who = pickOrder(prev)[prev.turn];
    const changed = prev.bundles.map((b, i) => (b.join() !== st.bundles[i]?.join() ? i : -1)).filter((i) => i >= 0);
    const from = before.bundles[changed[0]];
    const gained = prev.bundles[changed[0]] ?? []; // 摘んだ束の中身（払いがあるので、魔素の増え方からは数えない）
    const to = playerTarget(st, me, who, '.a-garden .mana.big');
    if (from) {
      glow(from, '#9fd06a', 600);
      gained.slice(0, 6).forEach((c, k) => fly(gem(c), center(from), to && center(to), { delay: k * 90 }));
    }
    for (const i of changed) { // 新しい房は枝から伸びて実る
      const el = document.querySelector(`.a-bundles .bundle[data-b="${i}"]`);
      if (el && !calm) el.animate([{ transform: 'scaleY(.2)', opacity: 0 }, { transform: 'scaleY(1)', opacity: 1 }], { duration: 600, delay: 350, easing: 'cubic-bezier(.3,1.4,.5,1)', fill: 'backwards' });
    }
  }

  // H6 場：招いたカードは招いた人へ飛び、新しいカードは門から歩いてくる
  const gate = rectOf('.isle-gate');
  let walkers = 0;
  st.market.forEach((c, i) => {
    const old = prev.market[i];
    if (old?.uid === c?.uid) return;
    if (old && before.market[i]) {
      const who = prev.phase === 'draft' ? prev.draftOrder[prev.turn] : (prev.phase === 'pick' ? pickOrder(prev)[prev.turn] : -1);
      const to = who >= 0 ? playerTarget(st, me, who, '.a-action .panel') : null;
      if (to && !calm) {
        const r = before.market[i].rect;
        const el = spawn('fx-card', before.market[i].html, r, 750);
        const t = center(to), s = center(r);
        el.animate([{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: `translate(${t.x - s.x}px, ${t.y - s.y}px) scale(.35)`, opacity: 0 }], { duration: 700, easing: 'ease-in', fill: 'forwards' });
      }
    }
    if (c) {
      const el = document.querySelector(`.a-market .card[data-i="${i}"]`);
      if (el && gate && !calm) {
        const r = el.getBoundingClientRect(), g = center(gate);
        el.animate([
          { transform: `translate(${g.x - center(r).x}px, ${g.y - center(r).y}px) scale(.25)`, opacity: 0 },
          { transform: `translate(${(g.x - center(r).x) * 0.6}px, 0) scale(.6)`, opacity: 1, offset: 0.35 },
          { transform: 'translate(0, 0) scale(1)', opacity: 1 },
        ], { duration: 900, delay: 300 + walkers * 160, easing: 'ease-out', fill: 'backwards' });
      }
      walkers++;
    }
  });
  if (walkers && gate) glow(gate, '#7ff0ff', 900);

  // H1 育てた・H7 置いた（自分の庭）
  pl.garden.forEach((x, i) => {
    if (!x) return;
    const old = pPl.garden.find((y) => y?.uid === x.uid);
    const r = cellRect(i);
    if (old && x.stage > old.stage) rankUp(r, x.stage);
    if (!old && !pPl.garden.some((y) => y?.uid === x.uid)) placed(r, i);
  });

  // H2 開花：終えた（終える→動いている・終えた、またはラウンドが進んだ）ら、動いた効果を左上から順に光らせる
  const finished = pPl.status === 'acting' && (pl.status !== 'acting' || st.round !== prev.round);
  const fx = pl.fx ?? [];
  if (finished && fx.length) bloom(fx, pl, st, me);
  else if (!finished && fx.length && JSON.stringify(fx) !== JSON.stringify(pPl.fx ?? [])) quick(fx, pl); // 来訪・芽吹き・手入れ

  // H4 お題を取った
  st.goals.forEach((g, k) => {
    const was = prev.claims[g] ?? [];
    for (const c of st.claims[g]) {
      if (was.some((y) => y.player === c.player)) continue;
      const r = rectOf(`.a-goals .goal:nth-child(${k + 1})`);
      glow(r, '#ffe28a', 1100);
      burst(r, ['#ffe28a', '#fff6c8', '#c9a45a'], 12, 900);
      const to = playerTarget(st, me, c.player, '.a-garden .me-score');
      const pts = document.querySelector(`.a-goals .goal:nth-child(${k + 1}) .goal-slots li.taken:last-of-type em`)?.textContent ?? '';
      if (r && to) fly(`<span class="fx-pts">+${pts}</span>`, center(r), center(to), { delay: 400, ms: 900, size: 48, arc: -30 });
    }
  });

  // H8 あなたの番（束を摘む・始まりのカード）
  const nowMine = pickNow(st, pickOrder) === me && (pickNow(prev, pickOrder) !== me || st.phase !== prev.phase || st.round !== prev.round);
  if (nowMine && st.phase !== 'end') yourTurn(st.phase);

  // H3 終わり：紙吹雪
  if (st.phase === 'end' && prev.phase !== 'end') confetti();
}

function rankUp(r, stage) {
  if (!r) return;
  glow(r, '#ffe28a', 900);
  label(`<b>RANK UP</b><span>${'★'.repeat(stage)}</span>`, r, 'fx-rank', 1100);
  burst(r, ['#ffe28a', '#fff6c8', '#8fd6ff'], 12, 800);
}

function placed(r, i) {
  if (!r) return;
  const el = document.querySelector(`.a-garden [data-cell="${i}"] .card`);
  if (el && !calm) el.animate([{ transform: 'translateY(-40px) scale(1.08)', opacity: 0 }, { transform: 'translateY(4px) scale(1)', opacity: 1, offset: 0.7 }, { transform: 'translateY(0)' }],
    { duration: 450, easing: 'ease-in' });
  later(calm ? 0 : 320, () => burst({ left: r.left, top: r.bottom - 30, width: r.width, height: 20 }, ['#7bb04a', '#9fd06a', '#e88ab0', '#e8d27a'], 14, 800));
}

const fxColor = (e) => (e.do === 'gain' ? e.color : null);

// 開花：1枚ずつ光り、得た魔素が魔素の欄へ飛ぶ。呼応は光の線
function bloom(fx, pl, st, me) {
  const uidCell = (uid) => pl.garden.findIndex((x) => x?.uid === uid);
  const mana = rectOf('.a-garden .mana.big');
  let k = 0, last = null;
  for (const e of fx) {
    const i = uidCell(e.uid);
    if (i < 0) continue;
    if (e.uid !== last) k++;
    last = e.uid;
    const t = (k - 1) * STEP;
    later(t, () => {
      const r = cellRect(i);
      glow(r, e.do === 'trigger' ? '#bff4ff' : '#ffe28a', STEP + 300);
      const c = fxColor(e);
      if (c && r) for (let n = 0; n < Math.min(e.n, 4); n++) fly(gem(c), center(r), mana && center(mana), { delay: n * 80, ms: 600 });
      if (e.do === 'convert' && r) label('<span>変性</span>', r, 'fx-small', 800);
      if (e.do === 'stageUp' && r) label('<span>★+1</span>', r, 'fx-small', 800);
    });
    for (const tu of e.targets ?? []) { const j = uidCell(tu); if (j >= 0) later(t, () => beam(center(cellRect(i)), center(cellRect(j)), 0)); }
  }
  if (k) later(0, () => label('<b>開花</b>', rectOf('.a-garden .board-slab'), 'fx-bloom', 900));
}

// 置いた・育てた・手入れで動いた効果は、すぐ光らせる
function quick(fx, pl) {
  const mana = rectOf('.a-garden .mana.big');
  for (const e of fx) {
    const i = pl.garden.findIndex((x) => x?.uid === e.uid);
    if (i < 0) continue;
    later(250, () => {
      const r = cellRect(i);
      glow(r, '#8fd6ff', 700);
      const c = fxColor(e);
      if (c && r) for (let n = 0; n < Math.min(e.n, 4); n++) fly(gem(c), center(r), mana && center(mana), { delay: n * 80 });
    });
  }
}

function roundBanner(round, rounds) {
  const el = spawn('fx-banner', `<b>ラウンド ${round}</b><small>／${rounds}${round === rounds ? '（最後）' : ''}</small>`, null, 1600);
  el.animate(calm
    ? [{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }]
    : [{ transform: 'translate(-120%, -50%)', opacity: 0 }, { transform: 'translate(-50%, -50%)', opacity: 1, offset: 0.25 }, { transform: 'translate(-50%, -50%)', opacity: 1, offset: 0.75 }, { transform: 'translate(20%, -50%)', opacity: 0 }],
  { duration: 1600, easing: 'ease-in-out', fill: 'forwards' });
}

function yourTurn(phase) {
  const r = rectOf(phase === 'draft' ? '.a-market' : '.a-bundles');
  if (!r) return;
  later(300, () => {
    label('<b>あなたの番</b>', { left: r.left, top: r.top + 20, width: r.width, height: 30 }, 'fx-turn', 1400);
    const el = document.querySelector('.a-bundles .bundles');
    if (el && phase === 'pick' && !calm) el.animate([{ transform: 'rotate(0)' }, { transform: 'rotate(-1.5deg)' }, { transform: 'rotate(1.5deg)' }, { transform: 'rotate(-1deg)' }, { transform: 'rotate(0)' }], { duration: 700, easing: 'ease-in-out' });
  });
}

function confetti() {
  if (calm) return;
  const colors = ['#ffe28a', '#e3604f', '#4f8fe0', '#4ea860', '#efe9d6', '#e8bf35'];
  const W = innerWidth;
  for (let i = 0; i < 70; i++) {
    const x = Math.random() * W, el = spawn('fx-bit fx-confetti', '', { left: x, top: -20, width: 8, height: 12 }, 3200);
    el.style.background = colors[i % colors.length];
    el.animate([{ transform: 'translate(0, 0) rotate(0)' }, { transform: `translate(${(Math.random() - 0.5) * 200}px, ${innerHeight + 40}px) rotate(${Math.random() * 720}deg)` }],
      { duration: 2200 + Math.random() * 900, delay: 1400 + Math.random() * 600, easing: 'ease-in', fill: 'both' });
  }
}
