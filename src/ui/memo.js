// ペンで落書きできるメモ（#6）。画面の上に重ねる透明な紙。盤面の配置は動かさない。通信対戦でもほかの人には送らない。
// 「メモ」で書く状態にする（書いている間は下の画面を押せない）。もう一度押すと書き終わり（絵は残る）。
// 暗い画面（星の書）なので、白をはじめのペンにする（工程7の判定 X2）。赤と水色は目立たせたいとき用
const COLORS = ['#ffffff', '#ff7b6b', '#8fd6ff'];

export function installMemo() {
  const canvas = document.createElement('canvas');
  canvas.className = 'memo-canvas';
  // 見た目は style.css に頼らずここで付ける（古い style.css が残っていても、盤面を隠さないように）
  Object.assign(canvas.style, { position: 'absolute', left: '0', top: '0', zIndex: '50', pointerEvents: 'none', background: 'transparent' });
  const bar = document.createElement('div');
  bar.className = 'memo-bar';
  Object.assign(bar.style, { position: 'fixed', right: '16px', bottom: '16px', zIndex: '60', display: 'none', gap: '6px', padding: '6px 8px', background: '#1f2740', color: '#f3ead2', border: '2px solid #ff7b6b', borderRadius: '10px', boxShadow: '0 4px 12px rgba(0,0,0,.15)' });
  const frame = document.createElement('div'); // 書いている間だけ、画面のふちを赤い枠で囲む（画面は暗くも白くもしない）
  Object.assign(frame.style, { position: 'fixed', inset: '0', zIndex: '55', pointerEvents: 'none', border: '4px solid rgba(214,69,58,.7)', display: 'none' });
  bar.innerHTML = `${COLORS.map((c, i) => `<button data-memo="pen" data-color="${c}" class="${i ? '' : 'on'}" title="ペン"><span style="background:${c}"></span></button>`).join('')}
    <button data-memo="eraser" title="消しゴム（触れた線を一筆まるごと消す）">消</button>
    <button data-memo="clear" title="全部消す">全消し</button>
    <button data-memo="hide" title="絵を隠す・見せる">隠す</button>
    <button data-memo="done" class="primary">書き終わり</button>`;
  bar.insertAdjacentHTML('afterbegin', '<b style="align-self:center;font-size:12px;color:#ff7b6b">書いています</b>');
  document.body.append(canvas, frame, bar);

  const ctx = canvas.getContext('2d');
  let color = COLORS[0];
  let erase = false;
  let drawing = false;
  let on = false;
  // 線は「一筆」ごとに覚える（工程7の判定 Y4：メモは意味のある線を書く道具なので、消しゴムは一筆まるごと消す）
  let strokes = []; // { color, pts: [{x, y}] }
  let current = null;

  function drawStroke(k) {
    ctx.strokeStyle = k.color;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(k.pts[0].x, k.pts[0].y);
    for (const p of k.pts.slice(1)) ctx.lineTo(p.x, p.y);
    if (k.pts.length === 1) ctx.lineTo(k.pts[0].x + 0.1, k.pts[0].y);
    ctx.stroke();
  }
  function redraw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const k of strokes) drawStroke(k);
  }

  // 紙の大きさをページ全体に合わせる（覚えている線を描き直す）
  function fit() {
    // 窓の幅はスクロールバーを除いた clientWidth で取る（innerWidth だと紙がはみ出して横スクロールが出る）
    const root = document.documentElement;
    const w = Math.max(root.scrollWidth, root.clientWidth);
    const h = Math.max(root.scrollHeight, root.clientHeight);
    if (canvas.width >= w && canvas.height >= h) return;
    canvas.width = Math.max(w, canvas.width);
    canvas.height = Math.max(h, canvas.height);
    canvas.style.width = `${canvas.width}px`;
    canvas.style.height = `${canvas.height}px`;
    redraw();
  }
  window.addEventListener('resize', fit);
  fit();

  // 点 p から線分 a-b までの距離
  function dist(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const t = dx || dy ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy))) : 0;
    return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
  }
  // 消しゴムが触れた一筆を消す（なぞった所にかかった線はまるごと消える）
  function eraseAt(p) {
    const hit = (k) => k.pts.some((q, i) => dist(p, q, k.pts[Math.min(i + 1, k.pts.length - 1)]) <= 10);
    const left = strokes.filter((k) => !hit(k));
    if (left.length !== strokes.length) { strokes = left; redraw(); }
  }

  const point = (ev) => ({ x: ev.pageX, y: ev.pageY });
  canvas.addEventListener('pointerdown', (ev) => {
    if (!on) return;
    drawing = true;
    canvas.setPointerCapture(ev.pointerId);
    const p = point(ev);
    if (erase) return eraseAt(p);
    current = { color, pts: [p] };
    strokes.push(current);
    drawStroke(current);
  });
  canvas.addEventListener('pointermove', (ev) => {
    if (!drawing) return;
    const p = point(ev);
    if (erase) return eraseAt(p);
    const last = current.pts[current.pts.length - 1];
    current.pts.push(p);
    drawStroke({ color: current.color, pts: [last, p] });
  });
  const stop = () => { drawing = false; current = null; };
  canvas.addEventListener('pointerup', stop);
  canvas.addEventListener('pointercancel', stop);

  function setOn(v) {
    on = v;
    fit();
    canvas.style.pointerEvents = on ? 'auto' : 'none';
    canvas.style.cursor = on ? 'crosshair' : '';
    canvas.style.display = '';
    bar.style.display = on ? 'flex' : 'none';
    frame.style.display = on ? 'block' : 'none';
  }

  bar.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-memo]');
    if (!b) return;
    const kind = b.dataset.memo;
    if (kind === 'pen' || kind === 'eraser') {
      erase = kind === 'eraser';
      if (!erase) color = b.dataset.color;
      for (const x of bar.querySelectorAll('[data-memo="pen"],[data-memo="eraser"]')) x.classList.toggle('on', x === b);
    } else if (kind === 'clear') {
      strokes = [];
      redraw();
    } else if (kind === 'hide') {
      const hide = canvas.style.visibility !== 'hidden';
      canvas.style.visibility = hide ? 'hidden' : 'visible';
      b.textContent = hide ? '見せる' : '隠す';
    } else if (kind === 'done') {
      setOn(false);
    }
  });

  return {
    toggle() { setOn(!on); },
    clear() { strokes = []; redraw(); },
    get on() { return on; },
  };
}
