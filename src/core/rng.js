// 種つきの乱数。状態（st.rng）に数を1つ持ち、同じ種なら同じ結果になる。通信対戦でホストだけが引く。
export function rand(st) {
  let t = (st.rng = (st.rng + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function randInt(st, n) {
  return Math.floor(rand(st) * n);
}

export function shuffle(st, arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randInt(st, i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
