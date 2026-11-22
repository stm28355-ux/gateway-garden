// ペンで落書きできるメモ（#6）。画面の上に重ねる透明な紙。盤面の配置は動かさない。通信対戦でもほかの人には送らない。
// 「メモ」で書く状態にする（書いている間は下の画面を押せない）。もう一度押すと書き終わり（絵は残る）。
const COLORS = ['#222222', '#d6453a', '#2f6fd1'];

export function installMemo() {
  const canvas = document.createElement('canvas');
  canvas.className = 'memo-canvas';
  const bar = document.createElement('div');
  bar.className = 'memo-bar';
  bar.hidden = true;
  bar.innerHTML = `${COLORS.map((c, i) => `<button data-memo="pen" data-color="${c}" class="${i ? '' : 'on'}" title="ペン"><span style="background:${c}"></span></button>`).join('')}
    <button data-memo="eraser" title="消しゴム">消</button>
    <button data-memo="clear" title="全部消す">全消し</button>
    <button data-memo="hide" title="絵を隠す・見せる">隠す</button>
    <button data-memo="done" class="primary">書き終わり</button>`;
  document.body.append(canvas, bar);

  const ctx = canvas.getContext('2d');
  let color = COLORS[0];
  let erase = false;
  let drawing = false;
  let last = null;
  let on = false;

  // 紙の大きさをページ全体に合わせる（大きくなるときは描いた絵を残す）
  function fit() {
    const w = Math.max(document.documentElement.scrollWidth, window.innerWidth);
    const h = Math.max(document.documentElement.scrollHeight, window.innerHeight);
    if (canvas.width >= w && canvas.height >= h) return;
    const keep = document.createElement('canvas');
    keep.width = canvas.width;
    keep.height = canvas.height;
    if (keep.width && keep.height) keep.getContext('2d').drawImage(canvas, 0, 0);
    canvas.width = Math.max(w, canvas.width);
    canvas.height = Math.max(h, canvas.height);
    canvas.style.width = `${canvas.width}px`;
    canvas.style.height = `${canvas.height}px`;
    if (keep.width && keep.height) ctx.drawImage(keep, 0, 0);
  }
  window.addEventListener('resize', fit);
  fit();

  const point = (ev) => ({ x: ev.pageX, y: ev.pageY });
  canvas.addEventListener('pointerdown', (ev) => {
    if (!on) return;
    drawing = true;
    last = point(ev);
    canvas.setPointerCapture(ev.pointerId);
  });
  canvas.addEventListener('pointermove', (ev) => {
    if (!drawing) return;
    const p = point(ev);
    ctx.globalCompositeOperation = erase ? 'destination-out' : 'source-over';
    ctx.strokeStyle = color;
    ctx.lineWidth = erase ? 22 : 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last = p;
  });
  const stop = () => { drawing = false; };
  canvas.addEventListener('pointerup', stop);
  canvas.addEventListener('pointercancel', stop);

  function setOn(v) {
    on = v;
    fit();
    canvas.classList.toggle('on', on);
    canvas.hidden = false;
    bar.hidden = !on;
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
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    } else if (kind === 'hide') {
      canvas.hidden = !canvas.hidden;
      b.textContent = canvas.hidden ? '見せる' : '隠す';
    } else if (kind === 'done') {
      setOn(false);
    }
  });

  return {
    toggle() { setOn(!on); },
    clear() { ctx.clearRect(0, 0, canvas.width, canvas.height); },
    get on() { return on; },
  };
}
