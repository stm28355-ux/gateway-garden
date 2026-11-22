// 拡張「号令の戦場」（auto-battler-1）の住人の絵を、本家 auto-battler の駒のドット絵（16×16）から写す。
// 使い方：node tools/import-auto-battler-art.mjs ../auto-battler
//   → src/art/auto-battler-1.js を書き直す（本家の絵が変わったら、もう一度動かす）。
// 本家に絵がない遺物（獣のトーテム・雷の宝珠）は、ここで同じ画風・同じ色で描く（物なので顔なし）。
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(process.argv[2] ?? '../auto-battler');
const { pieceSpriteRows } = await import(pathToFileURL(resolve(root, 'src/ui/pieceIcons.js')).href);

// 住人の名前 → 本家の駒の id
const IDS = {
  将軍: 'c_general', 重装兵: 'c_guard', 見習い剣士: 'c_squire', 聖鎧: 'i_armor',
  竜人: 'c_dragonkin', 吸血鬼: 'c_vampire', 魔剣: 'i_blade', 毒瓶: 'i_vial',
  雷術師: 'c_sorcerer', 呪術師: 'c_hexer', 見習い魔導士: 'c_apprentice', 預言者: 'c_oracle',
  毒蛇: 'c_viper', 鷹: 'c_hawk', 古の巨獣: 'c_behemoth',
  電磁塔: 'c_tesla', 修理工房: 'c_workshop', ゴーレム: 'c_golem',
};

// 本家にない2つ（遺物。本家では絵文字 🪶・🔆）
const EXTRA = {
  // 獣のトーテム：木の柱に緑の帯、てっぺんに羽根
  獣のトーテム: [
    '.........kk.....',
    '........kGlk....',
    '.......kGlk.....',
    '......kGGlk.....',
    '......kGlk......',
    '....kkkkkkkk....',
    '...knnnnnnnnk...',
    '...kntnnnntnk...',
    '...knnnnnnnnk...',
    '...kGGGGGGGGk...',
    '..kknnnnnnnnkk..',
    '.kGkntnnnntnkGk.',
    '..kknnnnnnnnkk..',
    '...knnnnnnnnk...',
    '..kddddddddddk..',
    '..kkkkkkkkkkkk..',
  ],
  // 雷の宝珠：稲妻を閉じこめた金の珠と、鋼の台
  雷の宝珠: [
    '..e..........e..',
    '.....kkkkkk.....',
    '...kkyyyyyykk...',
    '..kyyyyyyoyyyk..',
    '.kywwyyyooyyyyk.',
    '.kywyyyooyyyyyk.',
    '.kyyyyooooyyyyk.',
    '.kyyyyyyooyyyyk.',
    '.kyyyyyooyyyyyk.',
    '..kyyyyoyyyyyk..',
    '...kkyyyyyykk...',
    '.....kkkkkk.....',
    '....kssssssk....',
    '...kggggggggk...',
    '...kssssssssk...',
    '...kkkkkkkkkk...',
  ],
};

const rows = {};
for (const [name, id] of Object.entries(IDS)) {
  const r = pieceSpriteRows(id);
  if (!r) throw new Error(`本家に ${id}（${name}）の絵がない`);
  rows[name] = r.map((s) => s.padEnd(16, '.').slice(0, 16));
}
for (const [name, r] of Object.entries(EXTRA)) {
  if (r.length !== 16 || r.some((s) => s.length !== 16)) throw new Error(`${name} の絵は16×16で書く`);
  rows[name] = r;
}

const out = `// 拡張「号令の戦場」（auto-battler-1）の住人の絵。本家 auto-battler の駒のドット絵（16×16）をそのまま使う。
// このファイルは tools/import-auto-battler-art.mjs が作る（手で直さない）。
// 工程7：拡張は世界ごとに画風が違ってよい。この世界は本家と同じ「かっこいいドット絵・物に顔なし」。
import { grid, toSvg } from './pixel.js';

// 本家と同じ16色（src/ui/pieceIcons.js の PALETTE）
const PALETTE = {
  k: '#1a1c2c', w: '#f4f4f4', g: '#94b0c2', s: '#566c86', y: '#ffcd75', o: '#ef7d57', r: '#b13e53',
  b: '#3b5dc9', c: '#41a6f6', p: '#8a4fd1', G: '#38b764', d: '#257179', l: '#a7f070', n: '#8a5a3c',
  t: '#c28569', f: '#f0c8a0', P: '#5d275d', a: '#333c57', e: '#73eff7', u: '#29366f',
};

export const ROWS = ${JSON.stringify(rows, null, 2)};

const cache = new Map();
export function autoBattlerArt(name, size = 96) {
  const r = ROWS[name];
  if (!r) return null;
  if (!cache.has(name)) {
    const g = grid(16);
    r.forEach((row, y) => [...row].forEach((ch, x) => { if (PALETTE[ch]) g.px1(x, y, PALETTE[ch]); }));
    cache.set(name, g);
  }
  return toSvg(cache.get(name), size);
}
`;
writeFileSync(new URL('../src/art/auto-battler-1.js', import.meta.url), out);
console.log(`src/art/auto-battler-1.js に ${Object.keys(rows).length} 体を書いた`);
