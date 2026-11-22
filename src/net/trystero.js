// つなぎ方（Trystero）：サーバーなしで、ブラウザ同士を直接つなぐ。部屋の合言葉で同じ部屋に入る。
// ほかのつなぎ方（Tailscale 用の小さなサーバーなど）を足すときは、同じ形（selfId・on・send・onJoin・onLeave・leave）を返せばよい。
const TRYSTERO = 'https://cdn.jsdelivr.net/npm/trystero@0.26.0'; // 0.26.0（2026-10-04 公開）
const APP_ID = 'gateway-garden.stm28355';
export const MESSAGES = ['hello', 'lobby', 'deny', 'view', 'act', 'err']; // 名前は短く

export async function openTrystero(code, { strategy = 'nostr' } = {}) {
  const mod = await import(`${TRYSTERO}/${strategy}/+esm`);
  const room = mod.joinRoom({ appId: APP_ID, password: code }, `room-${code}`);
  const handlers = {};
  const actions = {};
  for (const name of MESSAGES) {
    const a = room.makeAction(name);
    a.onMessage = (data, ctx) => handlers[name]?.(data, ctx.peerId);
    actions[name] = a;
  }
  return {
    selfId: mod.selfId,
    on(name, fn) { handlers[name] = fn; },
    send(name, data, peerId) { return actions[name].send(data, peerId ? { target: peerId } : undefined); },
    set onJoin(fn) { room.onPeerJoin = fn; },
    set onLeave(fn) { room.onPeerLeave = fn; },
    peers: () => Object.keys(room.getPeers()),
    leave: () => room.leave(),
  };
}
