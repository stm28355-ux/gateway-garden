// CPU どうしで1ゲームを最後まで進める（自動対戦・テスト用）
import { applyMut, createGame, whoActs } from './game.js';
import { cpuAction } from './cpu.js';

export function playGame(cat, { players = 2, rounds = 8, seed = 1, maxSteps = 5000, onStep } = {}) {
  const st = createGame(cat, { players: Array.from({ length: players }, (_, i) => ({ name: `CPU${i + 1}`, cpu: 'normal' })), rounds, seed });
  const actions = [];
  for (let step = 0; st.phase !== 'end'; step++) {
    if (step > maxSteps) throw new Error('終わらない');
    const p = whoActs(st)[0];
    const a = cpuAction(cat, st, p);
    actions.push(a);
    applyMut(cat, st, a);
    onStep?.(st, a);
  }
  return { st, actions };
}
