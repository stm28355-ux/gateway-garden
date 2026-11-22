// CPU どうしで1ゲームを最後まで進める（自動対戦・テスト用）
import { applyMut, createGame, whoActs } from './game.js';
import { cpuAction } from './cpu.js';

// cpu：全員の強さ（'normal'・'smart'）か、席ごとの並び（例：['smart', 'normal']）
export function playGame(cat, { players = 2, rounds = 8, seed = 1, maxSteps = 5000, onStep, cpu = 'normal' } = {}) {
  const level = (i) => (Array.isArray(cpu) ? cpu[i % cpu.length] : cpu);
  const st = createGame(cat, { players: Array.from({ length: players }, (_, i) => ({ name: `CPU${i + 1}`, cpu: level(i) })), rounds, seed });
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
