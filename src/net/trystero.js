// つなぎ方（Trystero）：サーバーなしで、ブラウザ同士を直接つなぐ。部屋の合言葉で同じ部屋に入る。
// ほかのつなぎ方（Tailscale 用の小さなサーバーなど）を足すときは、同じ形（selfId・on・send・onJoin・onLeave・leave）を返せばよい。
export const TRYSTERO = 'https://cdn.jsdelivr.net/npm/trystero@0.26.0'; // 0.26.0（2026-10-04 公開）
export const APP_ID = 'gateway-garden.stm28355';
// nostr の中継。Trystero は appId から公開の中継5か所を自動で選ぶが、2026-11-22 に確かめると、そのうち合図が通るのは2か所だけだった
// （相手の回線からその2か所に届かないと、合図がすれ違ってつながらない）。2つのタブで合図が通るのを確かめた中継から8か所を決めて使う。
// 中継は止まることがあるので、つながりにくくなったら通信の確かめ（net-check.html）で調べて入れ替える。
export const NOSTR_RELAYS = [
  'wss://nos.lol',
  'wss://nostr.red5d.dev',
  'wss://nostrcity-club.fly.dev',
  'wss://cdn.satellite.earth',
  'wss://nostr.rblb.it',
  'wss://relay.agentry.com',
  'wss://nostr.christiansass.de',
  'wss://relay.nostrmap.net',
];

// joinRoom に渡す設定（ゲームと確かめページで同じものを使う）
export function roomConfig(strategy, extra = {}) {
  return { appId: APP_ID, ...(strategy === 'nostr' ? { relayConfig: { urls: NOSTR_RELAYS } } : {}), ...extra };
}

export const MESSAGES = ['hello', 'lobby', 'deny', 'view', 'act', 'err']; // 名前は短く

// turnConfig：TURN サーバーの並び（src/net/turn.js）。あれば、直接つながらない回線どうしでも中継を通ってつながる
export async function openTrystero(code, { strategy = 'nostr', turnConfig = null } = {}) {
  const mod = await import(`${TRYSTERO}/${strategy}/+esm`);
  const room = mod.joinRoom(roomConfig(strategy, { password: code, ...(turnConfig ? { turnConfig } : {}) }), `room-${code}`);
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
