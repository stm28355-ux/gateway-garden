// できごとの記録（人ごと）。反応フェーズでほかの人がしたことは、ラウンドが終わるまでその人には見せない。
import { buysOf } from '../core/game.js';
import { GOALS } from '../core/goals.js';
import { COLOR_JA } from '../ui/describe.js';

export class Journal {
  constructor(cat, n) {
    this.cat = cat;
    this.logs = Array.from({ length: n }, () => []);
    this.hidden = Array.from({ length: n }, () => []);
  }

  note(line, only = null) {
    this.logs.forEach((l, v) => { if (only === null || only === v) l.push(line); });
  }

  describe(before, a) {
    const who = before.players[a.player].name;
    const card = (c) => `「${this.cat.cards[c.id].name}」`;
    const pl = before.players[a.player];
    switch (a.type) {
      case 'draft': return `${who}：始まりの札${card(before.market[a.market])}を取った`;
      case 'pick': {
        const b = before.bundles[a.bundle].map((c) => COLOR_JA[c]).join('');
        const bends = a.bends?.length ? `（${a.bends.map((x) => (x.kind === 'swap' ? '入れ替え' : '足す')).join('・')}）` : '';
        const got = buysOf(a).map((x) => card(before.market[x.market])).join('と');
        return `${who}：束${a.bundle + 1}（${b}）を拾った${bends}${got ? `、${got}を取った` : ''}`;
      }
      case 'place': return `${who}：${card(pl.pending[a.pending])}をマス${a.cell + 1}に置いた`;
      case 'grow': return `${who}：${card(pl.garden[a.cell])}を段階${pl.garden[a.cell].stage + 1}に育てた`;
      case 'use': return `${who}：${card(pl.garden[a.cell])}を使った`;
      case 'undo': return `${who}：1つ戻した`;
      case 'done': return `${who}：このラウンドを終えた`;
      default: return null;
    }
  }

  record(before, a, after) {
    const line = this.describe(before, a);
    if (line) {
      this.logs.forEach((l, v) => {
        if (before.phase === 'react' && a.player !== v && a.type !== 'done') this.hidden[v].push(line);
        else l.push(line);
      });
    }
    if (before.phase !== 'react' && after.phase === 'react') this.hidden.forEach((h) => { h.length = 0; });
    if (after.round !== before.round || (after.phase === 'end' && before.phase !== 'end')) {
      this.logs.forEach((l, v) => {
        if (this.hidden[v].length) l.push('（反応フェーズでほかの人がしたこと）', ...this.hidden[v]);
        this.hidden[v] = [];
      });
      for (const g of after.goals) {
        for (const c of after.claims[g]) {
          if (!before.claims[g].some((x) => x.player === c.player)) this.note(`${after.players[c.player].name}：目標札「${GOALS[g].name}」を満たした`);
        }
      }
      if (after.phase !== 'end') this.note(`―― ラウンド ${after.round} ――`);
    }
  }
}
