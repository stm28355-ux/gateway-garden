// 目標札（D13・フェーズ2の8枚）。条件は部品では書きにくいので、ここに直接書く。
// 1ゲームに3枚。点は満たしたラウンドの順に 5・3・1・0 点（同じラウンドに満たした人は同じ点）。取った点は残る。
// 工程8（G0〜G8）：ほぼ全員が取っていた6枚を重くし、点に順位の傾斜をつけた（#5）。
import { LINES, adjacent } from './garden.js';
import { ELEMENTS } from './schema.js';

export const GOAL_POINTS = [5, 3, 1, 0]; // 満たしたラウンドの順（工程8 G0）

// そのお題を round に満たしたら何点か。claims はそのお題をもう満たした人の並び（{ player, round }）
export function goalPointsOf(claims, round) {
  const rounds = [...new Set(claims.map((x) => x.round))].sort((a, b) => a - b);
  const i = rounds.includes(round) ? rounds.indexOf(round) : rounds.filter((x) => x < round).length;
  return GOAL_POINTS[i] ?? 0;
}

const defOf = (cat, inst) => cat.cards[inst.id];

export const GOALS = {
  'same-line': {
    name: 'そろいの花壇', text: '一列（行か列）を同じ色の★★以上のカード3枚でそろえる',
    check: (cat, g) => LINES.some((l) => l.every((c) => g[c]?.stage >= 2) && new Set(l.map((c) => defOf(cat, g[c]).element)).size === 1),
  },
  'rainbow-line': {
    name: '虹の小道', text: '一列（行か列）を違う色の★★以上のカード3枚で並べる',
    check: (cat, g) => LINES.some((l) => l.every((c) => g[c]?.stage >= 2) && new Set(l.map((c) => defOf(cat, g[c]).element)).size === 3),
  },
  'four-corners': {
    name: '四つ角の守り', text: '中央と4つの角にカードがある',
    check: (cat, g) => [0, 2, 4, 6, 8].every((c) => g[c]),
  },
  'big-tree': {
    name: '大きな木', text: '★★★のカードが4枚',
    check: (cat, g) => g.filter((x) => x && x.stage === 3).length >= 4,
  },
  lush: {
    name: '茂った庭', text: '★★以上のカードが7枚',
    check: (cat, g) => g.filter((x) => x && x.stage >= 2).length >= 7,
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
    name: '対の芽', text: '同じ色の★★★のカード2枚が隣り合う',
    check: (cat, g) => g.some((x, i) => x && x.stage === 3 && adjacent(i).some((j) => {
      const y = g[j];
      return y && y.stage === 3 && defOf(cat, y).element === defOf(cat, x).element;
    })),
  },
  // 拡張を混ぜたゲームだけに出る（出身が2種類以上のとき）
  'world-cross': {
    name: '世界の交わり', text: '違う世界のカードどうしが隣り合う所が7か所', needsOrigins: 2,
    check: (cat, g) => {
      let n = 0;
      g.forEach((x, i) => {
        if (!x) return;
        for (const j of adjacent(i)) if (j > i && g[j] && defOf(cat, g[j]).origin !== defOf(cat, x).origin) n++;
      });
      return n >= 7; // 工程8 R2：拡張を増やして同時に使うことも考えて 3 → 5 → 7
    },
  },
};

// お題までの進み具合（0〜1）。CPU「かしこい」が、まだ満たしていないお題を少し狙うのに使う（工程8 Q1）
const elOf = (cat, x) => defOf(cat, x).element;
const PROGRESS = {
  // ★★以上は1枚、★は半分と数える
  'same-line': (cat, g) => Math.max(...LINES.map((l) => {
    const cs = l.filter((c) => g[c]);
    return new Set(cs.map((c) => elOf(cat, g[c]))).size > 1 ? 0 : cs.reduce((s, c) => s + (g[c].stage >= 2 ? 1 : 0.5), 0) / 3;
  })),
  'rainbow-line': (cat, g) => Math.max(...LINES.map((l) => {
    const cs = l.filter((c) => g[c]);
    return new Set(cs.map((c) => elOf(cat, g[c]))).size < cs.length ? 0 : cs.reduce((s, c) => s + (g[c].stage >= 2 ? 1 : 0.5), 0) / 3;
  })),
  'four-corners': (cat, g) => [0, 2, 4, 6, 8].filter((c) => g[c]).length / 5,
  'big-tree': (cat, g) => g.filter(Boolean).map((x) => (x.stage - 1) / 2).sort((a, b) => b - a).slice(0, 4).reduce((a, b) => a + b, 0) / 4,
  lush: (cat, g) => Math.min(1, (g.filter((x) => x && x.stage >= 2).length + 0.3 * g.filter((x) => x && x.stage === 1).length) / 7),
  'five-colors': (cat, g) => new Set(g.filter(Boolean).map((x) => elOf(cat, x))).size / 5,
  friends: (cat, g) => {
    const n = {};
    for (const x of g) if (x) n[defOf(cat, x).role] = (n[defOf(cat, x).role] ?? 0) + 1;
    return Math.min(1, Math.max(0, ...Object.values(n)) / 3);
  },
  'pair-sprouts': (cat, g) => {
    let best = g.some(Boolean) ? 0.1 : 0;
    g.forEach((x, i) => {
      if (!x) return;
      for (const j of adjacent(i)) {
        const y = g[j];
        if (y && elOf(cat, y) === elOf(cat, x)) best = Math.max(best, 0.2 + 0.2 * (x.stage - 1) + 0.2 * (y.stage - 1));
      }
    });
    return best;
  },
  'world-cross': (cat, g) => {
    let n = 0;
    g.forEach((x, i) => {
      if (!x) return;
      for (const j of adjacent(i)) if (j > i && g[j] && defOf(cat, g[j]).origin !== defOf(cat, x).origin) n++;
    });
    return Math.min(1, n / 7);
  },
};
export const goalProgress = (cat, id, garden) => (GOALS[id].check(cat, garden) ? 1 : ((GOALS[id].progress ?? PROGRESS[id])?.(cat, garden) ?? 0));

export const BASE_GOAL_IDS = Object.keys(GOALS).filter((g) => !GOALS[g].needsOrigins);

// そのゲームで出せる目標札（出身の数と、拡張のお題ならその世界が入っているかで決まる）
export function goalPool(cat) {
  const origins = Object.keys(cat.versions).length;
  return Object.keys(GOALS).filter((g) => (GOALS[g].needsOrigins ?? 1) <= origins && (!GOALS[g].origin || cat.versions[GOALS[g].origin]));
}

// ---- 拡張のお題（expansion.json の goals）。カードのデータと同じく、決まった形の組み合わせで書く ----
//   shape：形（cells：3×3 の中の [行, 列]）を、回す・裏返す・ずらして、どこか1か所で全部のマスが filter に合えば満たす
//   count：filter に合うカードが atLeast 枚以上
// filter：minStage（★の数以上）・element（色）・role（役目）・origin（"this" でその世界のカード）
export const GOAL_KINDS = ['shape', 'count'];
export const GOAL_FILTER_KEYS = ['minStage', 'element', 'role', 'origin'];

const SYMS = [(r, c) => [r, c], (r, c) => [c, -r], (r, c) => [-r, -c], (r, c) => [-c, r], (r, c) => [r, -c], (r, c) => [-c, -r], (r, c) => [-r, c], (r, c) => [c, r]];

// 形を、3×3 の中に置けるすべての置き方（マスの番号の並び）にする
export function shapePlacements(cells) {
  const out = new Map();
  for (const t of SYMS) {
    const pts = cells.map(([r, c]) => t(r, c));
    const r0 = Math.min(...pts.map((p) => p[0]));
    const c0 = Math.min(...pts.map((p) => p[1]));
    const norm = pts.map(([r, c]) => [r - r0, c - c0]);
    for (let dr = 0; dr < 3; dr++) {
      for (let dc = 0; dc < 3; dc++) {
        const moved = norm.map(([r, c]) => [r + dr, c + dc]);
        if (moved.some(([r, c]) => r > 2 || c > 2)) continue;
        const idx = moved.map(([r, c]) => r * 3 + c).sort((a, b) => a - b);
        out.set(idx.join(','), idx);
      }
    }
  }
  return [...out.values()];
}

function goalFit(cat, x, filter, origin) {
  if (!x) return false;
  const d = defOf(cat, x);
  if (filter?.minStage && x.stage < filter.minStage) return false;
  if (filter?.element && d.element !== filter.element) return false;
  if (filter?.role && d.role !== filter.role) return false;
  if (filter?.origin === 'this' && d.origin !== origin) return false;
  return true;
}

export function registerGoal(origin, spec) {
  const id = `${origin}:${spec.id}`;
  if (GOALS[id]) return id;
  const fit = (cat, x) => goalFit(cat, x, spec.filter, origin);
  // 進み具合：条件に合うカードは1、合わないカードがある所は半分（★を育てれば合うかもしれない）
  const part = (cat, x) => (fit(cat, x) ? 1 : (x ? 0.5 : 0));
  if (spec.kind === 'shape') {
    const places = shapePlacements(spec.cells);
    GOALS[id] = {
      name: spec.name, text: spec.text, origin, shape: spec.cells, filter: spec.filter,
      check: (cat, g) => places.some((p) => p.every((c) => fit(cat, g[c]))),
      progress: (cat, g) => Math.max(...places.map((p) => p.reduce((s, c) => s + part(cat, g[c]), 0) / p.length)),
    };
  } else {
    GOALS[id] = {
      name: spec.name, text: spec.text, origin, count: spec.atLeast, filter: spec.filter,
      check: (cat, g) => g.filter((x) => fit(cat, x)).length >= spec.atLeast,
      progress: (cat, g) => Math.min(1, g.reduce((s, x) => s + part(cat, x), 0) / spec.atLeast),
    };
  }
  return id;
}
