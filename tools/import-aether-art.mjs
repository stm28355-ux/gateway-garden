// 拡張「魔導具の工房」（aether-atelier-1）の住人の絵を、本家 Aether Atelier の機械と素材のドット絵から写す。
// 使い方：node tools/import-aether-art.mjs ../aether-atelier
//   → src/art/aether-atelier-1.js を書き直す（本家の絵が変わったら、もう一度動かす）。
// 本家は canvas に四角を塗って描くので、塗った四角をドットの格子に写す。
// 機械は1マス＝20ドット（大きさは本家のまま：1×1〜4×4）、素材は16×16。
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(process.argv[2] ?? '../aether-atelier');
const load = (p) => import(pathToFileURL(resolve(root, p)).href);
const { drawMachineArt, DOTS } = await load('src/ui/machines.js');
const { drawItem } = await load('src/ui/sprites.js');
const { pen, OUT } = await load('src/ui/pixel.js');
const { buildings } = await load('src/data/content.js');

// 住人の名前 → 本家の何の絵か（m：機械、i：素材）
const CARDS = {
  竜炉: ['m', 'furnace'], 鋳型台: ['m', 'caster'], 金属板: ['i', 'plate'], 魔力炉: ['m', 'manaFurnace'], 調合台: ['m', 'mixer'],
  霜の柱: ['m', 'frostPillar'], エーテル水: ['i', 'aether'], 蒸留器: ['m', 'still'], 精製器: ['m', 'refiner'], 浮遊石の素: ['i', 'floatmix'],
  旋盤: ['m', 'lathe'], プレス機: ['m', 'press'], 巻き機: ['m', 'winder'], 時計の機構: ['i', 'clockwork'], 組立台: ['m', 'assembler'],
  光る苔: ['i', 'moss'], 育て床: ['m', 'planter'], 紡ぎ機: ['m', 'spinner'], 織機: ['m', 'loom'], 浮袋: ['i', 'balloon'],
  灯り台: ['m', 'lightPost'], 研磨機: ['m', 'polisher'], からくり台: ['m', 'workbench'], 造船台: ['m', 'shipyard'], あふれ口: ['o', 'overflow'],
  石くず: ['i', 'gravel'], 浮遊石: ['i', 'floatstone'], 赤熱した板: ['i', 'redplate'], 焼き入れ鋼: ['i', 'steel'],
  エーテル結晶: ['i', 'crystal'], 魔導ランタン: ['i', 'lantern'],
};

// 塗った四角をドットに写す、canvas のふり。unit は1ドットの px
function fakeCanvas(w, h, unit) {
  const grid = Array.from({ length: h }, () => Array(w).fill(null));
  const ctx = {
    fillStyle: '#000',
    fillRect(x, y, fw, fh) {
      for (let yy = Math.round(y / unit); yy < Math.round((y + fh) / unit); yy++) {
        for (let xx = Math.round(x / unit); xx < Math.round((x + fw) / unit); xx++) {
          if (yy >= 0 && yy < h && xx >= 0 && xx < w) grid[yy][xx] = this.fillStyle;
        }
      }
    },
  };
  return { ctx, grid };
}

// あふれ口：本家では盤面の描画で円と矢印を描くので、同じ色でドットに描き直す（灰色の台に、倉庫へ戻す暗い穴と矢印）
function drawOverflow(ctx) {
  const d = pen(ctx, 0, 0, 1);
  d.r(1, 1, 18, 18, OUT);
  d.r(2, 2, 16, 16, '#9b958c');
  d.disc(10, 13, 3.6, '#b5541c');
  d.disc(10, 13, 1.8, '#3b352e');
  for (let i = 0; i < 4; i++) d.r(10 - i, 4 + i, 1 + i * 2, 1, '#c9c3b8'); // 上向きの矢印
  d.r(9, 8, 2, 2, '#c9c3b8');
}

const CHARS = '.123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const art = {};
for (const [name, [kind, id]] of Object.entries(CARDS)) {
  let c;
  if (kind === 'm') {
    const b = buildings[id];
    if (!b) throw new Error(`本家に機械がない：${id}`);
    const unit = 40 / DOTS; // 本家は1ドット＝2px
    c = fakeCanvas(b.w * DOTS, b.h * DOTS, unit);
    drawMachineArt(c.ctx, id, 0, 0, b.w * 40, b.h * 40, true);
  } else if (kind === 'i') {
    c = fakeCanvas(16, 16, 1);
    drawItem(c.ctx, id, 8, 8, 16);
  } else {
    c = fakeCanvas(20, 20, 1);
    drawOverflow(c.ctx);
  }
  const palette = [];
  const rows = c.grid.map((row) => row.map((col) => {
    if (!col) return '.';
    let k = palette.indexOf(col);
    if (k < 0) { palette.push(col); k = palette.length - 1; }
    if (k + 1 >= CHARS.length) throw new Error(`色が多すぎる：${name}`);
    return CHARS[k + 1];
  }).join(''));
  if (!palette.length) throw new Error(`絵が描かれなかった：${name}（${id}）`);
  art[name] = { w: rows[0].length, h: rows.length, palette, rows };
}

const body = Object.entries(art).map(([name, a]) => `  ${JSON.stringify(name)}: {\n    w: ${a.w}, h: ${a.h},\n    palette: ${JSON.stringify(a.palette)},\n    rows: [\n${a.rows.map((r) => `      '${r}',`).join('\n')}\n    ],\n  },`).join('\n');

writeFileSync(resolve('src/art/aether-atelier-1.js'), `// 拡張「魔導具の工房」の住人の絵。本家 Aether Atelier の機械と素材のドット絵をそのまま使う（顔はない）。
// このファイルは tools/import-aether-art.mjs が作る（手で直さない）。
// rows の1文字が1ドット（. は透明、1〜 は palette の順）。機械は1マス20ドット（大きい機械は本家の大きさのまま）、素材は16×16。
const CHARS = ${JSON.stringify(CHARS)};

const ART = {
${body}
};

export function aetherArt(name, size = 96) {
  const a = ART[name];
  if (!a) return null;
  let rects = '';
  a.rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      let n = 1;
      while (x + n < row.length && row[x + n] === ch) n++;
      if (ch !== '.') rects += \`<rect x="\${x}" y="\${y}" width="\${n}" height="1" fill="\${a.palette[CHARS.indexOf(ch) - 1]}"/>\`;
      x += n;
    }
  });
  return \`<svg class="px" width="\${size}" height="\${size}" viewBox="0 0 \${a.w} \${a.h}" shape-rendering="crispEdges">\${rects}</svg>\`;
}
`);
console.log(`${Object.keys(art).length} 枚の絵を src/art/aether-atelier-1.js に書いた`);
