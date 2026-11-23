// 画面の「記録をコピー」で写した文字から、同じゲームを再現して中身を出す。
// 使い方：node tools/replay.mjs 記録.json   （記録の版と今の札の版が違うと再現できないことがある）
import { readFileSync } from 'node:fs';
import { buildCatalog, createGame, applyMut, scoreOf, manaTotal } from '../src/core/game.js';

const rec = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const exps = Object.keys(rec.versions).map((id) => ({ meta: read(`../expansions/${id}/expansion.json`), cards: read(`../expansions/${id}/cards.json`) }));
const cat = buildCatalog(exps);
for (const [id, v] of Object.entries(rec.versions)) {
  if (cat.versions[id] !== v) console.log(`注意：${id} の版が違う（記録 ${v}／今 ${cat.versions[id]}）`);
}

const st = createGame(cat, { players: rec.players.map((name, i) => ({ name, cpu: i ? 'normal' : null })), rounds: rec.rounds, seed: rec.seed, firstPlayer: rec.firstPlayer ?? 0 }); // 0.14.2 より前の記録は先番が席0
let round = 1;
let last = 0;
const show = (label) => {
  console.log(`\n== ${label}（${((rec.actions.find((x) => x.t >= last)?.t ?? last) / 60000).toFixed(1)} 分ごろ）`);
  for (const pl of st.players) {
    const g = pl.garden.map((x) => (x ? `${cat.cards[x.id].name}${x.stage}` : '・')).join(' ');
    console.log(`${pl.name}：${scoreOf(cat, st, pl.index).total}点 魔素${manaTotal(pl.mana)} 捨てた${pl.discarded} | ${g}`);
  }
};
for (const { t, a } of rec.actions) {
  applyMut(cat, st, a);
  last = t;
  if (st.round !== round || st.phase === 'end') { show(`ラウンド ${round} の終わり`); round = st.round; }
}
console.log(`\nかかった時間 ${(last / 60000).toFixed(1)} 分、操作 ${rec.actions.length} 回`);
