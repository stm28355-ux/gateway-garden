// 住人の絵の入り口。世界（拡張）ごとに絵の作り方が違う（工程7：世界ごとに画風が違ってよい）。
// 新しい世界の絵を足すときは、ここに1行足す。絵がなければ null（画面は世界の名前を出す）。
import { baseArt } from './base.js';
import { autoBattlerArt } from './auto-battler-1.js';
import { celestialArt } from './celestial-alchemy-1.js';
import { arcEnCielArt } from './arc-en-ciel.js';

const BY_ORIGIN = {
  base: baseArt,
  'auto-battler-1': autoBattlerArt, // 本家 auto-battler の駒の絵（16×16）をそのまま（判定 AB1）
  'celestial-alchemy-1': celestialArt, // 32×32 のドット絵（人に顔、物は顔なし）
  'arc-en-ciel-1': arcEnCielArt, // 本家 Arc-en-ciel Creator のモンスターの絵（32×32）をそのまま
};

export function cardArt(d, size = 96) {
  const draw = BY_ORIGIN[d.origin];
  if (draw) return draw(d.name, size);
  // 世界が分からないとき（古い呼び方）は名前で探す
  return baseArt(d.name, size) ?? autoBattlerArt(d.name, size);
}
