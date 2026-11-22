// カードの一覧（#8）。カードの一覧のページ（cards.html）と、ゲーム中の「カードの一覧」の両方で使う。
import { ELEMENTS, ROLES, GROWTH } from '../core/schema.js';
import { stageLinesHtml, costText, COLOR_JA, ROLE_JA, GROWTH_JA, stars } from './describe.js';
import { cardArt } from '../art/index.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// 1枚を全部の段階まで描く。left は「まだ出ていない枚数」（出さないなら undefined）
export function fullCardHtml(d, { originName = d.origin, left, copies } = {}) {
  const stages = [0, 1, 2].map((i) => `<div class="fc-stage"><b>${stars(i + 1)}</b>${d.stages[i].points ? `（${d.stages[i].points}点）` : ''}<br>${stageLinesHtml(d, i).join('<br>')}</div>`).join('');
  return `<div class="fullcard ${d.element}">
    ${cardArt(d, 64) ? `<div class="fc-art">${cardArt(d, 64)}</div>` : ''}
    <div class="fc-head"><b>${esc(d.name)}</b>${left !== undefined ? `<span class="fc-left ${left ? '' : 'none'}">あと${left}／${copies}枚</span>` : ''}</div>
    <div class="fc-meta">${COLOR_JA[d.element]}・${ROLE_JA[d.role]}・${GROWTH_JA[d.growth]}（育てる魔素 ${GROWTH[d.growth].join('・')}）</div>
    <div class="fc-meta">招く魔素 ${costText(d.cost)}・世界「${esc(originName)}」</div>
    ${stages}
  </div>`;
}

// 絞り込み（拡張・色・役目）と並べ方。state = { origins:Set, colors:Set, roles:Set }
export function filterHtml(origins, state) {
  const chip = (group, value, label) => `<label class="chip-check"><input type="checkbox" data-filter="${group}" value="${value}" ${state[group].has(value) ? 'checked' : ''}>${label}</label>`;
  return `<div class="filters">
    <div>${origins.map((o) => chip('origins', o.id, esc(o.name))).join('')}</div>
    <div>${ELEMENTS.map((c) => chip('colors', c, COLOR_JA[c])).join('')}</div>
    <div>${ROLES.map((r) => chip('roles', r, ROLE_JA[r])).join('')}</div>
  </div>`;
}

export function listHtml(cards, state, { originNames = {}, left = null, copies = 2 } = {}) {
  const shown = cards
    .filter((d) => state.origins.has(d.origin) && state.colors.has(d.element) && state.roles.has(d.role))
    .sort((a, b) => (ELEMENTS.indexOf(a.element) - ELEMENTS.indexOf(b.element)) || (ROLES.indexOf(a.role) - ROLES.indexOf(b.role)));
  if (!shown.length) return '<p class="muted">当てはまるカードがありません。</p>';
  return `<p class="muted">${shown.length}種類</p><div class="fullcards">${shown.map((d) => fullCardHtml(d, { originName: originNames[d.origin] ?? d.origin, left: left ? left[d.id] : undefined, copies })).join('')}</div>`;
}

export const allState = (origins) => ({ origins: new Set(origins.map((o) => o.id)), colors: new Set(ELEMENTS), roles: new Set(ROLES) });

// 絞り込みの印を押したとき
export function toggleFilter(state, input) {
  const set = state[input.dataset.filter];
  if (input.checked) set.add(input.value); else set.delete(input.value);
}

// まだ出ていない枚数：山の札は各種類 copies 枚。場・全員の庭と手元・捨て札に出た分を引く（見えている分だけで数える）
export function leftCounts(cat, view, copies = 2) {
  const left = Object.fromEntries(cat.deckIds.map((id) => [id, copies]));
  const seen = (c) => { if (c && left[c.id] !== undefined) left[c.id]--; };
  view.market.forEach(seen);
  view.discardPile.forEach(seen);
  for (const pl of view.players) { pl.garden.forEach(seen); pl.pending.forEach(seen); }
  return left;
}
