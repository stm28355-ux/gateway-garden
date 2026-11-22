// 目標札（D13・フェーズ2の8枚）。条件は部品では書きにくいので、ここに直接書く。
// 1ゲームに3枚。一番乗りのラウンドに満たした人は5点、それより後は3点。取った点は残る。
import { LINES, adjacent } from './garden.js';
import { ELEMENTS } from './schema.js';

export const FIRST_POINTS = 5;
export const LATER_POINTS = 3;

const defOf = (cat, inst) => cat.cards[inst.id];

export const GOALS = {
  'same-line': {
    name: 'そろいの花壇', text: '一列（行か列）を同じ色のカード3枚でそろえる',
    check: (cat, g) => LINES.some((l) => l.every((c) => g[c]) && new Set(l.map((c) => defOf(cat, g[c]).element)).size === 1),
  },
  'rainbow-line': {
    name: '虹の小道', text: '一列（行か列）を違う色のカード3枚で並べる',
    check: (cat, g) => LINES.some((l) => l.every((c) => g[c]) && new Set(l.map((c) => defOf(cat, g[c]).element)).size === 3),
  },
  'four-corners': {
    name: '四つ角の守り', text: '中央と4つの角にカードがある',
    check: (cat, g) => [0, 2, 4, 6, 8].every((c) => g[c]),
  },
  'big-tree': {
    name: '大きな木', text: '★★★のカードが2枚',
    check: (cat, g) => g.filter((x) => x && x.stage === 3).length >= 2,
  },
  lush: {
    name: '茂った庭', text: '★★以上のカードが5枚',
    check: (cat, g) => g.filter((x) => x && x.stage >= 2).length >= 5,
  },
  'five-colors': {
    name: '五色の庭', text: '5色すべてのカードが庭にある',
    check: (cat, g) => ELEMENTS.every((el) => g.some((x) => x && defOf(cat, x).element === el)),
  },
  friends: {
    name: '仲良しの輪', text: '同じ役目のカードが3枚',
    check: (cat, g) => {
      const n = {};
      for (const x of g) if (x) n[defOf(cat, x).role] = (n[defOf(cat, x).role] ?? 0) + 1;
      return Object.values(n).some((v) => v >= 3);
    },
  },
  'pair-sprouts': {
    name: '対の芽', text: '同じ色の★★以上のカード2枚が隣り合う',
    check: (cat, g) => g.some((x, i) => x && x.stage >= 2 && adjacent(i).some((j) => {
      const y = g[j];
      return y && y.stage >= 2 && defOf(cat, y).element === defOf(cat, x).element;
    })),
  },
  // 拡張を混ぜたゲームだけに出る（出身が2種類以上のとき）
  'world-cross': {
    name: '世界の交わり', text: '違う世界のカードどうしが隣り合う所が3か所', needsOrigins: 2,
    check: (cat, g) => {
      let n = 0;
      g.forEach((x, i) => {
        if (!x) return;
        for (const j of adjacent(i)) if (j > i && g[j] && defOf(cat, g[j]).origin !== defOf(cat, x).origin) n++;
      });
      return n >= 3;
    },
  },
};

export const BASE_GOAL_IDS = Object.keys(GOALS).filter((g) => !GOALS[g].needsOrigins);

// そのゲームで出せる目標札（出身の数で決まる）
export function goalPool(cat) {
  const origins = Object.keys(cat.versions).length;
  return Object.keys(GOALS).filter((g) => (GOALS[g].needsOrigins ?? 1) <= origins);
}
