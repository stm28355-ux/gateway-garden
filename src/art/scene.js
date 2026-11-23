// 挿絵（工程9 G1〜G5・I1）：夜空に浮かぶ島。ドット絵（1点 4px）で、カードの住人と絵柄をそろえる。
// 絵はここで SVG を作り、CSS の変数（--art-…）に入れる。どこに貼るかは style.css。
// 夜空・束の島（枝から垂れる房）・場の島（石レンガと異界の門）・庭の島（草原）・お題の立て札。

const url = (svg) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;

// 決まった乱数（毎回同じ絵になるように）
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}
// hash は見本で決まった絵（崖・石レンガ・門・枝）のまま。負の値も出るが、絵が変わるので直さない。新しい絵は noise（0〜1）
const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) >>> 0; h = ((h ^ (h >>> 13)) * 1274126177) >>> 0; return (h ^ (h >>> 16)) / 2 ** 32; };
const noise = (x, y) => { let h = (x * 374761393 + y * 668265263) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 2 ** 32; };

// fn(x, y) が色（なければ透明）を返す。横に続く同じ色は1つの rect にまとめる
function pixels(W, H, u, fn, ox = 0) {
  let out = '';
  for (let y = 0; y < H; y++) {
    let x = 0;
    while (x < W) {
      const c = fn(x, y);
      let n = 1;
      while (x + n < W && fn(x + n, y) === c) n++;
      if (c) out += `<rect x="${(x + ox) * u}" y="${y * u}" width="${n * u}" height="${u}" fill="${c}"/>`;
      x += n;
    }
  }
  return out;
}
const svg = (w, h, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" shape-rendering="crispEdges">${body}</svg>`;
const sprite = (W, H, u, fn) => svg(W * u, H * u, pixels(W, H, u, fn));

// ---- 夜空（星は2枚：またたく星は別の層） ------------------------------------
function stars(seed, n, bigRate) {
  const r = rng(seed);
  let s = '';
  for (let i = 0; i < n; i++) {
    const x = Math.floor(r() * 128) * 4, y = Math.floor(r() * 128) * 4;
    const big = r() < bigRate, c = r() < 0.3 ? '#ffe9a8' : (r() < 0.5 ? '#bfe3ff' : '#ffffff');
    const o = (0.35 + r() * 0.6).toFixed(2);
    if (big) s += `<g fill="${c}" opacity="${o}"><rect x="${x}" y="${y - 4}" width="4" height="12"/><rect x="${x - 4}" y="${y}" width="12" height="4"/></g>`;
    else { const z = r() < 0.3 ? 4 : 2; s += `<rect x="${x}" y="${y}" width="${z}" height="${z}" fill="${c}" opacity="${o}"/>`; }
  }
  return url(svg(512, 512, s));
}

// ---- 島の崖（欄の下の縁）と、その下に垂れた岩と根 ------------------------------
const cliff = url(sprite(100, 7, 4, (x, y) => {
  const edge = Math.floor(hash(x >> 1, 9) * 3);
  if (y < edge - 1) return null;
  if (y === 2 && hash(x, y) < 0.3) return '#3e5a2a';
  if (hash(x, y) < 0.12) return '#382c22';
  return y < 2 ? '#5a7a3a' : (y < 4 ? '#6b5640' : '#4a3a2e');
}));
const DEPTH = [3, 5, 7, 4, 2, 3, 6, 8, 5, 3, 2, 4, 6, 5, 3, 2, 3, 5, 7, 6, 4, 2, 3, 4, 6, 7, 5, 3, 2, 3, 4, 3];
const roots = url(sprite(32, 8, 4, (x, y) => {
  const d = DEPTH[x];
  if (y < d - 2) return hash(x, y) < 0.2 ? '#2e241c' : '#3d3026';
  if (y < d - 1) return '#2a2019';
  if ((x === 7 || x === 18 || x === 26) && y < d + 1) return '#6a8a3a';
  return null;
}));

// ---- 地面 ----------------------------------------------------------------
const bricks = url(sprite(16, 8, 4, (x, y) => { // 場の島：石レンガ
  const row = y >> 2, off = row % 2 ? 4 : 0;
  if (y % 4 === 3 || (x + off) % 8 === 7) return '#1c1f2c';
  if (y % 4 === 0 && hash(x, y) < 0.5) return '#4a4e63';
  const v = hash(((x + off) >> 3) + row * 7, row);
  return v < 0.33 ? '#353a4e' : (v < 0.66 ? '#3a3f55' : '#31354a');
}));
const grass = url(sprite(16, 16, 4, (x, y) => { // 庭の島：草原
  const h = noise(x, y);
  if (h < 0.025) return noise(y, x) < 0.5 ? '#e8d27a' : '#e88ab0'; // 小さな花
  if (h < 0.12) return '#5f8f3c';
  if (h < 0.2) return '#2c4a22';
  return h < 0.6 ? '#365a28' : '#3a612b';
}));
const plot = url(sprite(16, 16, 4, (x, y) => { // 庭のマス：耕した土
  const h = noise(x + 40, y + 40);
  if (y % 4 === 3) return '#2a1f16';
  return h < 0.15 ? '#4a3828' : (h < 0.5 ? '#3a2c1f' : '#33271c');
}));
const planks = url(sprite(16, 12, 4, (x, y) => { // お題の立て札：板
  if (y % 6 === 5) return '#2b1d12';
  if (y % 6 === 2 && (x === 1 || x === 14)) return '#a8a29a'; // くぎ
  const v = noise(x >> 2, Math.floor(y / 6) + 3);
  if (noise(x, y) < 0.08) return '#4a3220';
  return v < 0.5 ? '#6a4a30' : '#5e4229';
}));
const post = url(sprite(4, 1, 4, (x) => ['#3e2c1e', '#7a5636', '#6a4a30', '#3e2c1e'][x]));

// ---- 異界の門（渦の向きを変えた4こまを横に並べる。H9 でゆっくり回す） -------------
const GW = 54, GH = 44;
function gateFrame(phase) {
  const cx = 26.5, yb = 22;
  const portal = ['#1a0f3a', '#2c1660', '#4a2390', '#6a3cc0', '#3f8fd0', '#5fd0e8', '#bff4ff'];
  return (x, y) => {
    const dx = x - cx;
    const inOuter = y >= yb ? Math.abs(dx) <= 21 : dx * dx + (y - yb) ** 2 <= 21 * 21;
    const inInner = y >= yb ? Math.abs(dx) <= 13 : dx * dx + (y - yb) ** 2 <= 13 * 13;
    if (y >= GH - 3) { // 台座
      if (Math.abs(dx) > 25) return null;
      return y === GH - 3 ? '#8a8fa8' : (hash(x, y) < 0.2 ? '#3a3e52' : '#555a72');
    }
    if (inInner) { // 門の中：渦
      const py = y - (yb + 3), r = Math.sqrt(dx * dx + py * py) / 15;
      const a = Math.atan2(py, dx) / (Math.PI * 2) + phase;
      const t = (1 - Math.min(r, 1)) * 5 + Math.sin((a + r * 1.4) * Math.PI * 6) * 0.9;
      let i = Math.max(0, Math.min(portal.length - 1, Math.round(t + ((x + y) % 2 ? 0.25 : -0.25))));
      const nearEdge = y >= yb ? Math.abs(dx) >= 12.5 : dx * dx + (y - yb) ** 2 >= 12.4 * 12.4;
      if (nearEdge) i = 5;
      return portal[i];
    }
    if (!inOuter) return null;
    const row = Math.floor(y / 3), off = row % 2 ? 3 : 0;
    if (y < yb - 14 && Math.abs(dx) <= 3) { // 要石と光る印
      if (Math.abs(dx) <= 1 && y >= yb - 20 && y <= yb - 17) return (dx === 0 || y === yb - 18) ? '#7ff0ff' : '#5a6382';
      return y % 3 === 0 ? '#6e7594' : '#5a6382';
    }
    if (y % 3 === 2 || (x + off) % 6 === 5) return '#262938';
    const v = hash(Math.floor((x + off) / 6), row);
    if (dx < 0 && y % 3 === 0) return '#7d829c';
    return v < 0.35 ? '#4b5068' : (v < 0.7 ? '#565b75' : '#454a60');
  };
}
const gate = url(svg(GW * 4 * 4, GH * 4, [0, 1, 2, 3].map((k) => pixels(GW, GH, 4, gateFrame(k / 12), k * GW)).join('')));

// ---- 束の植物 ------------------------------------------------------------
const vine = url(sprite(16, 6, 4, (x, y) => { // 枝と葉（くり返し）
  const wob = x % 8 < 4 ? 0 : 1;
  if (y === 2 + wob) return x % 5 === 0 ? '#8a6440' : '#6a4a30';
  if (y === 3 + wob) return hash(x, 3) < 0.4 ? '#3e2c1e' : '#4a3524';
  if (y <= 1 + wob && [1, 2, 6, 10, 11, 14].includes(x)) return (x + y) % 2 ? '#7bb04a' : '#5a8f3a';
  if (y === 0 && [2, 11].includes(x)) return '#9fd06a';
  return null;
}));
const trunk = url(sprite(9, 46, 4, (x, y) => { // 左の幹と上の茂み
  if (y < 7) {
    const d = (x - 4) ** 2 / 20 + (y - 3) ** 2 / 9;
    if (d <= 1) return hash(x, y) < 0.3 ? '#9fd06a' : (hash(x, y + 9) < 0.5 ? '#5a8f3a' : '#7bb04a');
    return null;
  }
  const l = y > 40 ? 0 : 1, r = y > 40 ? 7 : (y > 36 ? 6 : 5);
  if (x < l || x > r) return null;
  if (x === l) return '#3e2c1e';
  if (x === l + 1) return '#8a6440';
  return hash(x, y) < 0.22 ? '#4a3524' : '#6a4a30';
}));
const leaf = url(sprite(4, 3, 3, (x, y) => ((y !== 1 && (x === 0 || x === 3)) ? null : ((x + y) % 3 ? '#5a8f3a' : '#7bb04a'))));

const ART = {
  sky: stars(7, 70, 0.12), twinkle: stars(11, 24, 0.5), cliff, roots, bricks, grass, plot, planks, post, gate, vine, trunk, leaf,
};

// 一度だけ CSS の変数に入れる
export function installScene(root = document.documentElement) {
  for (const [k, v] of Object.entries(ART)) root.style.setProperty(`--art-${k}`, v);
}
