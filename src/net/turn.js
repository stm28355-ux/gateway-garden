// TURN（中継）サーバー。直接つながらない回線（越えにくい NAT）どうしでも、TURN を通せばつながる。
// 中継を通るのは直接つながらない2人の間だけで、中身は暗号のまま（WebRTC の決まり）。
//
// 使い方：TURN サービス（例：Metered の無料アカウント）で「ブラウザに置いてよい鍵」で取れる URL を TURN_URL に書く。
//   例：'https://<アプリ名>.metered.live/api/v1/turn/credentials?apiKey=<ブラウザ用の鍵>'
//   この URL を開くと、ICE サーバーの並び（[{ urls, username, credential }, ...]）が返る。
// 空のままなら TURN は使わない（今までどおり STUN だけで直接つなぐ）。
// Metered の無料アカウント（月 500MB。2026-11-22 に人が作った）。ブラウザに置いてよい鍵なので公開してよい
export const TURN_URL = 'https://stm-connect782.metered.live/api/v1/turn/credentials?apiKey=873f53e606562c97a9540736965f11277562';

// TURN サーバーの並びを取る。取れなければ null（つなぐのは止めない）
export async function turnServers(url = TURN_URL, { timeout = 5000 } = {}) {
  if (!url) return null;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeout);
  try {
    const res = await fetch(url, { signal: ctl.signal });
    if (!res.ok) return null;
    const list = await res.json();
    // STUN は Trystero が自分で持っているので、turn: / turns: だけ渡す
    const turn = (Array.isArray(list) ? list : list.iceServers ?? [])
      .map((s) => ({ ...s, urls: [].concat(s.urls).filter((u) => /^turns?:/.test(u)) }))
      .filter((s) => s.urls.length);
    return turn.length ? turn : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
