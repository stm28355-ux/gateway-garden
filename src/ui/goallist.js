// お題の一覧（goals.html）。カードの一覧（cardlist.js）と同じく、世界で絞って並べる
import { GOALS, GOAL_POINTS } from '../core/goals.js';
import { GOAL_COUNT } from '../core/game.js';
import { goalArt } from '../art/goals.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// お題がどの世界のものか：拡張のお題はその世界、ほかは基本セット（混ぜたときだけ出るものも基本セットの扱い）
export const goalOrigin = (id) => GOALS[id].origin ?? 'base';

// いつ出るか（ゲームに入る条件）
function whenText(def, originNames) {
  if (def.origin) return `「${esc(originNames[def.origin] ?? def.origin)}」を入れたゲームに出る`;
  if (def.needsOrigins) return `${def.needsOrigins}つ以上の世界を混ぜたゲームだけに出る`;
  return 'いつも出る';
}

export function goalCardHtml(id, originNames = {}) {
  const def = GOALS[id];
  return `<div class="fullcard goalcard">
    <div class="fc-art">${goalArt(id, 72)}</div>
    <div class="fc-head"><b>${esc(def.name)}</b></div>
    <div class="fc-stage gc-text">${esc(def.text)}</div>
    <div class="fc-meta">${whenText(def, originNames)}</div>
  </div>`;
}

export function goalFilterHtml(origins, state) {
  return `<div class="filters"><div>${origins.map((o) => `<label class="chip-check"><input type="checkbox" data-filter="origins" value="${o.id}" ${state.origins.has(o.id) ? 'checked' : ''}>${esc(o.label)}</label>`).join('')}</div></div>`;
}

// 世界ごとに見出しを付けて並べる（origins の順）
export function goalListHtml(origins, state) {
  const groups = origins.filter((o) => state.origins.has(o.id))
    .map((o) => ({ o, ids: Object.keys(GOALS).filter((id) => goalOrigin(id) === o.id) }))
    .filter((g) => g.ids.length);
  if (!groups.length) return '<p class="muted">当てはまるお題がありません。</p>';
  const names = Object.fromEntries(origins.map((o) => [o.id, o.label]));
  const n = groups.reduce((s, g) => s + g.ids.length, 0);
  return `<p class="muted">${n}枚。1ゲームに${GOAL_COUNT}枚を出し、満たしたラウンドの早い順に ${GOAL_POINTS.join('・')} 点（同じラウンドに満たした人は同じ点）。取った点は残る。</p>
    ${groups.map((g) => `<h2 class="gl-head">${esc(g.o.label)}</h2><div class="fullcards">${g.ids.map((id) => goalCardHtml(id, names)).join('')}</div>`).join('')}`;
}
