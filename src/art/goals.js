// お題カードの絵（工程7の判定 X2：お題を表す絵）。住人と同じ道具・同じ縁取りで、32×32。
import { grid, toSvg } from './pixel.js';

const INK = '#1d1a33';
const C = { red: '#e3604f', blue: '#5c9ae6', green: '#4ea860', greenLight: '#8fd39a', yellow: '#ffd03a', white: '#efe9d6',
  gold: '#e6b23c', goldLight: '#ffe28a', brown: '#b97a45', brownDark: '#7e4f2a', soil: '#6b4a32', purple: '#9b7fd6', sky: '#a9d2ff' };

const flower = (g, x, y, petal) => g.ellipse(x, y - 2, 1.5, 1.5, petal).ellipse(x - 2, y, 1.5, 1.5, petal).ellipse(x + 2, y, 1.5, 1.5, petal)
  .ellipse(x, y + 2, 1.5, 1.5, petal).px1(x, y, C.yellow).line(x, y + 3, x, y + 7, C.green);
const gem = (g, x, y, c) => g.poly([[x, y - 3], [x + 3, y], [x, y + 3], [x - 3, y]], c);

const DRAW = {
  // そろいの花壇：同じ色の花が一列
  'same-line': () => { const g = grid().rect(2, 22, 29, 26, C.soil); for (const x of [7, 16, 25]) flower(g, x, 14, C.red); return g.outline(INK); },
  // 虹の小道：虹と小道
  'rainbow-line': () => {
    const g = grid();
    [[C.red, 13], [C.yellow, 11], [C.green, 9], [C.blue, 7]].forEach(([c, r]) => g.ellipse(16, 18, r, r, c));
    g.clear(0, 19, 31, 31).ellipse(16, 18, 5, 5, null).poly([[12, 30], [20, 30], [18, 20], [14, 20]], C.goldLight);
    return g.outline(INK);
  },
  // 四つ角の守り：3×3 の中央と四つ角が光る
  'four-corners': () => {
    const g = grid();
    for (const [i, x] of [6, 16, 26].entries()) for (const [j, y] of [6, 16, 26].entries()) {
      const on = (i !== 1 && j !== 1) || (i === 1 && j === 1);
      g.rect(x - 3, y - 3, x + 3, y + 3, on ? C.gold : '#3a4466');
      if (on) g.px1(x - 1, y - 1, C.goldLight);
    }
    return g.outline(INK);
  },
  // 大きな木：★★★ に育った木
  'big-tree': () => grid().ellipse(16, 12, 11, 8, C.green).ellipse(11, 9, 3, 2, C.greenLight)
    .rect(13, 18, 19, 28, C.brown).poly([[13, 28], [9, 30], [14, 30]], C.brown).poly([[19, 28], [23, 30], [18, 30]], C.brown)
    .px1(9, 3, C.gold).px1(16, 1, C.gold).px1(23, 3, C.gold).outline(INK),
  // 茂った庭：こんもりした茂み
  lush: () => grid().rect(2, 25, 29, 28, C.soil)
    .ellipse(7, 20, 5, 5, C.green).ellipse(16, 17, 6, 7, C.green).ellipse(25, 20, 5, 5, C.green)
    .ellipse(14, 14, 2, 1.5, C.greenLight).ellipse(6, 18, 1.5, 1, C.greenLight).ellipse(25, 18, 1.5, 1, C.greenLight)
    .px1(10, 22, C.red).px1(21, 21, C.yellow).px1(17, 23, C.white).outline(INK),
  // 五色の庭：5色の魔素の輪
  'five-colors': () => {
    const g = grid();
    [[C.white, 16, 6], [C.red, 26, 13], [C.blue, 22, 25], [C.green, 10, 25], [C.yellow, 6, 13]].forEach(([c, x, y]) => gem(g, x, y, c));
    return g.ellipse(16, 16, 2.5, 2.5, C.goldLight).outline(INK);
  },
  // 仲良しの輪：手をつなぐ3つの丸
  friends: () => grid().path([[9, 20], [16, 9], [23, 20], [9, 20]], 0.8, C.gold)
    .ellipse(16, 9, 4.5, 4.5, C.red).ellipse(8, 21, 4.5, 4.5, C.blue).ellipse(24, 21, 4.5, 4.5, C.green).outline(INK),
  // 対の芽：同じ色の芽が2つ並ぶ
  'pair-sprouts': () => {
    const g = grid().rect(2, 23, 29, 27, C.soil);
    for (const x of [10, 22]) g.line(x, 22, x, 13, C.green).ellipse(x - 3, 12, 3, 1.8, C.green).ellipse(x + 3, 11, 3, 1.8, C.greenLight);
    return g.outline(INK);
  },
  // 世界の交わり：2つの世界をつなぐ門
  'world-cross': () => grid().ellipse(16, 14, 11, 11, C.purple).ellipse(16, 14, 7, 8, C.sky).clear(0, 25, 31, 31)
    .rect(4, 14, 7, 28, C.gold).rect(25, 14, 28, 28, C.gold).rect(8, 14, 15, 24, C.sky).rect(17, 14, 24, 24, '#f6b26b')
    .line(16, 7, 16, 24, C.goldLight).outline(INK),
};

export function goalArt(id, size = 36) {
  return DRAW[id] ? toSvg(DRAW[id](), size) : '';
}
