// 人ごとの見え方。通信対戦でホストが各人に送るのも、1人で遊ぶ画面が描くのも、この形。
// - 山の並びと乱数は送らない（次に出る札や束が分かってしまう）
// - 反応フェーズは全員同時なので、ほかの人の庭・魔素・目標札は反応フェーズが始まった時のまま（後出しを防ぐ）
// reactStart は { players, claims }：反応フェーズが始まった時の写し（セッションが持つ）
export function snapshotReact(st) {
  return { players: structuredClone(st.players), claims: structuredClone(st.claims) };
}

export function viewFor(st, p, reactStart) {
  const v = structuredClone(st);
  v.deck = Array(st.deck.length).fill(null);
  v.rng = 0;
  v.viewer = p;
  const frozen = st.phase === 'react' && reactStart;
  v.players.forEach((pl, i) => {
    if (i === p) return;
    if (frozen) Object.assign(pl, structuredClone(reactStart.players[i]), { status: pl.status, cpu: pl.cpu, away: pl.away });
    pl.history = [];
    pl.queue = [];
    pl.choice = null;
    pl.chains = {};
  });
  if (frozen) {
    for (const g of st.goals) {
      const base = reactStart.claims[g];
      v.claims[g] = [...base, ...st.claims[g].filter((x) => x.player === p && !base.some((y) => y.player === p))];
    }
  }
  return v;
}
