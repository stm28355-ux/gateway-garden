// 拡張「アルカンシエル」（arc-en-ciel-1 など）の住人の絵を、本家 Arc-en-ciel Creator のモンスターのドット絵（32×32）から写す。
// 使い方：node tools/import-arc-en-ciel-art.mjs ../arc-en-ciel-creator
//   → src/art/arc-en-ciel.js を書き直す（本家の絵が変わったら、もう一度動かす）。前編・後編で同じファイルを使う。
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(process.argv[2] ?? '../arc-en-ciel-creator');
const { drawSprite } = await import(pathToFileURL(resolve(root, 'src/art/sprites.js')).href);
const { MONSTERS } = await import(pathToFileURL(resolve(root, 'src/data/monsters.js')).href);

// 住人の名前 → 本家のモンスターの種類（前編・後編）
const KINDS = [
  'slime', 'hinoko', 'waterslime', 'zapslime', 'sprite', 'dandelion', 'frostflower', 'peppercannon',
  'hawk', 'firebird', 'thunderbird', 'dove', 'bat', 'mole', 'seal', 'flamebat',
  'turtle', 'crystalgolem', 'icerock', 'skyshell',
  'bigslime', 'forestsprite', 'eagle', 'stormbat', 'rockturtle',
  // 後編
  'singer', 'demon', 'flamelord', 'piper', 'sparkbot', 'firework', 'machinaflower', 'holybot',
  'elderdragon', 'frog', 'wyvern', 'eel', 'shockjelly', 'squid', 'fruitwhip', 'starfish',
  'plasma', 'yukionna', 'candle', 'hellfire',
  'maou', 'megasparkbot', 'rainfrog', 'boltjelly',
];

const CHARS = '.123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const art = {};
for (const kind of KINDS) {
  const s = drawSprite(kind);
  const name = MONSTERS[kind]?.name;
  if (!s || !name) throw new Error(`本家に絵か名前がない：${kind}`);
  if (s.palette.length > CHARS.length) throw new Error(`色が多すぎる：${kind}`);
  const rows = [];
  for (let y = 0; y < s.h; y++) {
    let row = '';
    for (let x = 0; x < s.w; x++) row += CHARS[s.grid[y * s.w + x]];
    rows.push(row);
  }
  art[name] = { palette: s.palette.slice(1), rows };
}

const body = Object.entries(art).map(([name, a]) => `  ${JSON.stringify(name)}: {\n    palette: ${JSON.stringify(a.palette)},\n    rows: [\n${a.rows.map((r) => `      '${r}',`).join('\n')}\n    ],\n  },`).join('\n');

writeFileSync(resolve('src/art/arc-en-ciel.js'), `// 拡張「アルカンシエル」の住人の絵。本家 Arc-en-ciel Creator のモンスターのドット絵（32×32）をそのまま使う。
// このファイルは tools/import-arc-en-ciel-art.mjs が作る（手で直さない）。
// rows の1文字が1マス（. は透明、1〜 は palette の順）。影（半透明）も本家のまま。
const CHARS = ${JSON.stringify(CHARS)};

const ART = {
${body}
};

export function arcEnCielArt(name, size = 96) {
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
  return \`<svg class="px" width="\${size}" height="\${size}" viewBox="0 0 32 32" shape-rendering="crispEdges">\${rects}</svg>\`;
}
`);
console.log(`${Object.keys(art).length} 体の絵を src/art/arc-en-ciel.js に書いた`);
