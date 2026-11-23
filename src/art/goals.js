// お題カードの絵（工程7の判定 X2・Y3：お題の名前と、満たす中身の両方が分かる絵）。住人と同じ道具・同じ縁取りで、32×32。
// 中身の数（何枚・何か所）は、絵の中の数で見せる（例：大きな木＝★★★の木が2本）。
import { grid, toSvg } from './pixel.js';
import { GOALS } from '../core/goals.js';

const INK = '#1d1a33';
const C = { red: '#e3604f', blue: '#5c9ae6', green: '#4ea860', greenLight: '#8fd39a', yellow: '#ffd03a', white: '#efe9d6',
  gold: '#e6b23c', goldLight: '#ffe28a', brown: '#b97a45', brownDark: '#7e4f2a', soil: '#6b4a32', purple: '#9b7fd6', sky: '#a9d2ff' };

const CARD = '#2c3557';
const flower = (g, x, y, petal) => g.ellipse(x, y - 2, 1.5, 1.5, petal).ellipse(x - 2, y, 1.5, 1.5, petal).ellipse(x + 2, y, 1.5, 1.5, petal)
  .ellipse(x, y + 2, 1.5, 1.5, petal).px1(x, y, C.yellow);
const stars = (g, x, y, k) => { for (let i = 0; i < k; i++) g.px1(x + i * 2, y, C.goldLight); return g; };
// 小さなカードの枠（中に絵を描く台）
const card = (g, x0, y0, x1, y1, edge = C.gold) => g.rect(x0, y0, x1, y1, edge).rect(x0 + 1, y0 + 1, x1 - 1, y1 - 1, CARD);
const cell3 = [3, 12, 21]; // 3×3 の庭のマスの左上（1マス 8×8）

const DRAW = {
  // そろいの花壇：一列に並んだ3枚のカードが、みんな同じ赤い花で★★以上（上に★2つ）
  'same-line': () => {
    const g = grid().rect(1, 24, 30, 28, C.soil);
    for (const x of [1, 11, 21]) { card(g, x, 4, x + 9, 22, C.red); stars(g, x + 4, 6, 2); flower(g, x + 5, 12, C.red); g.line(x + 5, 15, x + 5, 20, C.green); }
    return g.outline(INK);
  },

  // 虹の小道：虹の下を通る小道に、色の違う★★以上のカード3枚の踏み石（上に★2つ）
  'rainbow-line': () => {
    const g = grid();
    [[C.red, 14], [C.yellow, 12], [C.green, 10], [C.blue, 8]].forEach(([c, r]) => g.ellipse(16, 15, r, r, c));
    g.clear(0, 16, 31, 31).ellipse(16, 15, 6, 6, null);
    for (const [i, c] of [C.red, C.blue, C.green].entries()) { card(g, 2 + i * 10, 19, 9 + i * 10, 29, c).rect(4 + i * 10, 23, 7 + i * 10, 27, c); stars(g, 4 + i * 10, 21, 2); }
    return g.outline(INK);
  },

  // 四つ角の守り：3×3 の庭の中央と四つ角にカード、まん中は盾
  'four-corners': () => {
    const g = grid();
    for (const [i, x] of cell3.entries()) for (const [j, y] of cell3.entries()) {
      const on = (i !== 1 && j !== 1) || (i === 1 && j === 1);
      if (on) card(g, x, y, x + 7, y + 7, C.gold).px1(x + 2, y + 2, C.goldLight);
      else g.rect(x + 2, y + 2, x + 5, y + 5, '#3a4466');
    }
    g.poly([[13, 13], [18, 13], [18, 16], [15.5, 19], [13, 16]], C.sky).px1(15, 14, '#ffffff');
    return g.outline(INK);
  },
  // 大きな木：★★★に育った木が4本（上に★3つ）
  'big-tree': () => {
    const g = grid().rect(8, 1, 23, 5, '#3a2f5a');
    for (const x of [11, 16, 21]) g.rect(x - 1, 2, x + 1, 4, C.gold).px1(x, 3, C.goldLight);
    for (const x of [4, 12, 20, 28]) g.ellipse(x, 15, 3.5, 5, C.green).px1(x - 1, 12, C.greenLight).rect(x - 1, 20, x, 28, C.brown);
    return g.rect(0, 29, 31, 30, C.soil).outline(INK);
  },

  // 茂った庭：3×3 の庭のうち7マスが★★以上の茂み
  lush: () => {
    const g = grid();
    const empty = [[1, 0], [2, 1]];
    for (const [i, x] of cell3.entries()) for (const [j, y] of cell3.entries()) {
      if (!empty.some(([a, b]) => a === i && b === j)) g.ellipse(x + 3.5, y + 4, 4, 3.5, C.green).px1(x + 2, y + 2, C.greenLight).px1(x + 2, y + 7, C.goldLight).px1(x + 5, y + 7, C.goldLight);
      else g.rect(x + 2, y + 2, x + 5, y + 5, '#3a4466');
    }
    return g.outline(INK);
  },

  // 五色の庭：5色の花が咲く花壇（5色のカードがそろう）
  'five-colors': () => {
    const g = grid().rect(1, 24, 30, 29, C.soil);
    [[C.white, 4, 13], [C.red, 10, 8], [C.blue, 16, 12], [C.green, 22, 8], [C.yellow, 28, 13]].forEach(([c, x, y]) => {
      g.line(x, y + 2, x, 23, C.green);
      flower(g, x, y, c);
    });
    return g.outline(INK);
  },
  // 仲良しの輪：同じ役目（同じ姿）の3匹が手をつなぐ
  friends: () => {
    const g = grid().path([[8, 21], [16, 9], [24, 21], [8, 21]], 0.8, C.gold);
    for (const [x, y, c] of [[16, 9, C.red], [8, 21, C.blue], [24, 21, C.green]]) g.ellipse(x, y, 5, 4.5, c).px1(x - 3, y - 5, c).px1(x + 3, y - 5, c).eye(x - 3, y - 1).eye(x + 2, y - 1);
    return g.outline(INK);
  },
  // 対の芽：隣り合う2枚のカードに、同じ色の★★★に育った芽（上に★3つ）
  'pair-sprouts': () => {
    const g = grid();
    for (const x of [3, 17]) {
      card(g, x, 4, x + 12, 28, C.green);
      g.rect(x + 2, 23, x + 10, 26, C.soil).line(x + 6, 22, x + 6, 11, C.green)
        .ellipse(x + 3, 14, 2.5, 1.5, C.green).ellipse(x + 9, 12, 2.5, 1.5, C.greenLight).ellipse(x + 6, 10, 2, 1.5, C.greenLight);
      stars(g, x + 4, 6, 3);
    }
    return g.px1(16, 16, C.goldLight).outline(INK);
  },

  // 世界の交わり：違う世界のカード8枚が並び、つなぎ目7か所が光る（門でつながる）
  'world-cross': () => {
    const g = grid().ellipse(16, 9, 9, 7, C.purple).ellipse(16, 10, 6, 5, null).clear(0, 11, 31, 31);
    for (let i = 0; i < 8; i++) card(g, i * 4, 14, 3 + i * 4, 26, C.gold).rect(1 + i * 4, 16, 2 + i * 4, 24, i % 2 ? '#f6b26b' : C.sky);
    for (let i = 1; i < 8; i++) g.px1(i * 4, 12, C.goldLight).px1(i * 4, 28, C.goldLight);
    return g.outline(INK);
  },

};

export function goalArt(id, size = 36) {
  if (DRAW[id]) return toSvg(DRAW[id](), size);
  const def = GOALS[id];
  if (def?.shape) return toSvg(shapeArt(def), size);
  if (def?.count) return toSvg(countArt(def), size);
  return '';
}

// 拡張のお題（expansion.json の goals）の絵：庭の3×3に、満たす形の印。★の条件は上に★
function shapeArt(def) {
  const g = grid();
  const on = new Set(def.shape.map(([r, c]) => r * 3 + c));
  for (let i = 0; i < 9; i++) {
    const x = cell3[i % 3], y = cell3[Math.floor(i / 3)] + 2;
    if (on.has(i)) card(g, x, y, x + 7, y + 7, C.gold).rect(x + 2, y + 2, x + 5, y + 5, C.goldLight);
    else g.rect(x + 1, y + 1, x + 6, y + 6, C.soil);
  }
  if (def.filter?.minStage) stars(g, 2, 1, def.filter.minStage);
  return g.outline(INK);
}

function countArt(def) {
  const g = grid();
  const n = Math.min(def.count, 9);
  for (let k = 0; k < n; k++) {
    const x = 3 + (k % 3) * 9, y = 4 + Math.floor(k / 3) * 9;
    card(g, x, y, x + 7, y + 7, C.gold);
  }
  if (def.filter?.minStage) stars(g, 2, 1, def.filter.minStage);
  return g.outline(INK);
}
