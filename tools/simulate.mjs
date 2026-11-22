// CPU どうしの自動対戦。長さ・勝ち筋・札ごとの強さ・素材の上限（Issue #1）を数える。
// 使い方：node tools/simulate.mjs [ゲーム数=200] [人数=2,3,4] [ラウンド=8] [--out docs/sim/xxx.md]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { buildCatalog, manaTotal } from '../src/core/game.js';
import { playGame } from '../src/core/autoplay.js';
import { GOALS } from '../src/core/goals.js';
import { GROWTH } from '../src/core/schema.js';

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args.splice(i, 2)[1] : null; };
const out = opt('--out');
// CPU の強さ：--cpu smart（工程8 Q1 の「かしこい」）。はじめは normal
const cpuLevel = opt('--cpu') ?? 'normal';
// 試しに育てる値段を変える：--growth "early=1,3;flat=2,3;late=3,4"
const growthOpt = opt('--growth');
if (growthOpt) {
  for (const part of growthOpt.split(';')) {
    const [k, v] = part.split('=');
    GROWTH[k] = v.split(',').map(Number);
  }
}
const games = Number(args[0] ?? 200);
const counts = (args[1] ?? '2,3,4').split(',').map(Number);
const rounds = Number(args[2] ?? 8);

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
// 使う拡張：--exp base,auto-battler（基本セットは必ず入る）
const expIds = [...new Set(['base', ...(opt('--exp') ?? 'base').split(',').map((s) => s.trim()).filter(Boolean)])];
const exps = expIds.map((id) => ({ meta: read(`../expansions/${id}/expansion.json`), cards: read(`../expansions/${id}/cards.json`) }));
// 試しの直し：--patch tools/patches/xxx.mjs（札の名前 → 直す関数 の並びを export default）。カードのデータは書き換えずに測る（工程8）
const patchPath = opt('--patch');
if (patchPath) {
  const patch = (await import(new URL(`../${patchPath}`, import.meta.url))).default;
  for (const e of exps) for (const c of e.cards) patch[c.name]?.(c);
}
const cat = buildCatalog(exps);

const COLOR_JA = { white: '白', red: '赤', blue: '青', green: '緑', yellow: '黄' };
const ROLE_JA = { generate: '生成', guide: '導き', boost: '強化', convert: '変換', score: '得点', chain: '連鎖' };
const YELLOW_HOARD = new Set(['ひだまりハチ', '渡り鳥', '両替カラス']); // 黄の「上限+」または「貯めて点」の札
const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const f1 = (x) => x.toFixed(1);
const pct = (x) => `${Math.round(x * 100)}%`;

function mainOf(cards, key) {
  const n = {};
  for (const d of cards) n[d[key]] = (n[d[key]] ?? 0) + 1;
  const top = Object.entries(n).sort((a, b) => b[1] - a[1]);
  if (!top.length) return 'なし';
  return top.length > 1 && top[0][1] === top[1][1] ? 'まぜ' : top[0][0];
}

const lines = [];
const say = (s = '') => { lines.push(s); console.log(s); };

say(`# 自動対戦の結果（CPU ${cpuLevel === 'smart' ? 'かしこい' : 'ふつう'} どうし、${rounds}ラウンド、各人数 ${games} ゲーム）`);
say();
say(`前提：全員 CPU「${cpuLevel === 'smart' ? 'かしこい' : 'ふつう'}」。使う札：${expIds.map((id) => `${id}（版 ${cat.versions[id]}）`).join('・')}、各札2枚の山。`);
if (patchPath) say(`試しの直し：${patchPath}`);
say(`育てる値段：早熟 ${GROWTH.early.join('・')}、平ら ${GROWTH.flat.join('・')}、晩成 ${GROWTH.late.join('・')}`);

const cardStats = {};
for (const n of counts) {
  const t0 = Date.now();
  const rows = [];
  const seatWins = Array(n).fill(0);
  const goalClaims = {};
  let steps = 0;
  for (let g = 0; g < games; g++) {
    const maxMana = Array(n).fill(0);
    const { st, actions } = playGame(cat, {
      players: n, rounds, seed: 1000 * n + g, cpu: cpuLevel,
      onStep: (s) => s.players.forEach((pl, i) => { maxMana[i] = Math.max(maxMana[i], manaTotal(pl.mana)); }),
    });
    steps += actions.filter((a) => a.type !== 'choose').length;
    for (const gid of st.goals) {
      goalClaims[gid] ??= { shown: 0, claimed: 0 };
      goalClaims[gid].shown += n;
      goalClaims[gid].claimed += st.claims[gid].length;
    }
    for (const r of st.result) {
      const pl = st.players[r.player];
      const defs = pl.garden.filter(Boolean).map((x) => cat.cards[x.id]);
      const win = r.rank === 1;
      if (win) seatWins[r.player]++;
      rows.push({ ...r, win, cards: defs.length, color: mainOf(defs, 'element'), role: mainOf(defs, 'role'),
        discarded: pl.discarded, maxMana: maxMana[r.player],
        limitCard: pl.garden.some((x) => x && YELLOW_HOARD.has(cat.cards[x.id].name) && cat.cards[x.id].stages[x.stage - 1].effects.some((e) => e.do === 'limit' || e.do === 'hoard')) });
      for (const x of pl.garden) {
        if (!x) continue;
        const k = cat.cards[x.id].name;
        cardStats[k] ??= { owned: 0, wins: 0, stage: 0, games: 0, share: 0 };
        cardStats[k].owned++;
        cardStats[k].stage += x.stage;
        cardStats[k].wins += win ? 1 : 0;
        cardStats[k].share += 1 / n;
      }
    }
  }
  const sec = (Date.now() - t0) / 1000;
  const winners = rows.filter((r) => r.win);
  say();
  say(`## ${n}人`);
  say();
  say(`| 項目 | 値 |`);
  say(`| --- | --- |`);
  say(`| 点の平均（勝った人） | ${f1(avg(rows.map((r) => r.total)))}（${f1(avg(winners.map((r) => r.total)))}） |`);
  say(`| 点の内わけ（段階・終わりの効果・目標札） | ${f1(avg(rows.map((r) => r.stage)))}・${f1(avg(rows.map((r) => r.end)))}・${f1(avg(rows.map((r) => r.goals)))} |`);
  say(`| 1位と最下位の差 | ${f1(avg(Array.from({ length: games }, (_, g) => { const rs = rows.slice(g * n, g * n + n).map((r) => r.total); return Math.max(...rs) - Math.min(...rs); })))} |`);
  say(`| 庭の札の数・段階3の数 | ${f1(avg(rows.map((r) => r.cards)))}・${f1(avg(rows.map((r) => r.stage3)))} |`);
  say(`| 席ごとの1位の割合（最初の先番から） | ${seatWins.map((w) => pct(w / games)).join('・')} |`);
  say(`| 1ゲームの操作の数（選ぶを除く） | ${f1(steps / games)} |`);
  say(`| 上限を超えて捨てた人の割合・1人あたり捨てた数 | ${pct(rows.filter((r) => r.discarded > 0).length / rows.length)}・${f1(avg(rows.map((r) => r.discarded)))} |`);
  say(`| 手持ちの素材の最大（平均） | ${f1(avg(rows.map((r) => r.maxMana)))} |`);
  say(`| 黄の上限・貯め札（効く段階）あり／なしの点 | ${f1(avg(rows.filter((r) => r.limitCard).map((r) => r.total)))}（${rows.filter((r) => r.limitCard).length}人）／${f1(avg(rows.filter((r) => !r.limitCard).map((r) => r.total)))} |`);
  say(`| かかった時間 | ${f1(sec)} 秒 |`);
  say();
  say('勝ち筋（いちばん多い色・役目ごとの1位の割合。「まぜ」は同数）：');
  say();
  for (const [key, ja] of [['color', COLOR_JA], ['role', ROLE_JA]]) {
    const groups = {};
    for (const r of rows) { groups[r[key]] ??= { n: 0, w: 0 }; groups[r[key]].n++; groups[r[key]].w += r.win ? 1 : 0; }
    say(`- ${Object.entries(groups).sort((a, b) => b[1].n - a[1].n).map(([k, v]) => `${ja[k] ?? k} ${pct(v.w / v.n)}（${v.n}人）`).join('、')}`);
  }
  say();
  say(`目標札（出たときに取れた人の割合）：${Object.entries(goalClaims).map(([k, v]) => `${GOALS[k].name} ${pct(v.claimed / v.shown)}`).join('、')}`);
}

say();
say('## 札ごと（全人数をまとめて）');
say();
say('「勝ちへの効き」＝その札を持っていた人の1位の割合 ÷ 人数から見た1位の割合。1.0 より大きいほど勝ちに効いている。');
say();
say('| 札 | 出身 | 色 | 役目 | 持たれた回数 | 終わりの段階（平均） | 勝ちへの効き |');
say('| --- | --- | --- | --- | --- | --- | --- |');
for (const [name, s] of Object.entries(cardStats).sort((a, b) => (b[1].wins / b[1].share) - (a[1].wins / a[1].share))) {
  const d = Object.values(cat.cards).find((c) => c.name === name);
  say(`| ${name} | ${d.origin} | ${COLOR_JA[d.element]} | ${ROLE_JA[d.role]} | ${s.owned} | ${f1(s.stage / s.owned)} | ${(s.wins / s.share).toFixed(2)} |`);
}

if (out) {
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${lines.join('\n')}\n`);
}
