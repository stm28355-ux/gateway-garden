import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applyAction, applyMut, createGame, whoActs } from '../src/core/game.js';
import { viewFor, snapshotReact } from '../src/core/view.js';
import { cpuAction } from '../src/core/cpu.js';
import { Journal } from '../src/net/journal.js';
import { HostRoom, GuestClient } from '../src/net/session.js';
import { APP_VERSION } from '../src/version.js';
import { baseCatalog, byName } from './helpers.js';

const cat = baseCatalog();
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });

// メモリの中でつなぐ、にせの通信（Trystero と同じ形）
function makeHub() {
  const nets = [];
  const make = (id) => {
    const handlers = {};
    let join = null;
    let leave = null;
    const net = {
      selfId: id,
      on(name, fn) { handlers[name] = fn; },
      send(name, data, peer) {
        for (const o of nets) if (o !== net && o.alive && (!peer || o.selfId === peer)) setTimeout(() => o.recv(name, structuredClone(data), id), 0);
      },
      set onJoin(fn) { join = fn; },
      set onLeave(fn) { leave = fn; },
      recv(name, data, from) { if (net.alive) handlers[name]?.(data, from); },
      joined(p) { join?.(p); },
      left(p) { leave?.(p); },
      alive: true,
      leave() {},
    };
    for (const o of nets.filter((x) => x.alive)) setTimeout(() => { o.joined(id); net.joined(o.selfId); }, 0);
    nets.push(net);
    return net;
  };
  const drop = (net) => { net.alive = false; for (const o of nets) if (o.alive) setTimeout(() => o.left(net.selfId), 0); };
  return { make, drop };
}

test('package.json の版とゲームの版がそろっている', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.version, APP_VERSION);
});

test('見え方：山と乱数は見せない。反応フェーズ中のほかの人は始まった時のまま', () => {
  let st = createGame(cat, { players: [{ name: 'A' }, { name: 'B' }], seed: 3 });
  for (const p of [1, 0]) st = applyAction(cat, st, { type: 'draft', player: p, market: 0 });
  for (const p of [0, 1]) st = applyAction(cat, st, { type: 'pick', player: p, bundle: 0, bends: [] });
  const start = snapshotReact(st);
  st = applyAction(cat, st, { type: 'place', player: 1, pending: 0, cell: 4 });
  const v0 = viewFor(st, 0, start);
  assert.ok(v0.deck.every((x) => x === null));
  assert.equal(v0.rng, 0);
  assert.equal(v0.players[1].garden[4], null, 'B が置いた札は A にはまだ見えない');
  assert.equal(v0.players[1].pending.length, 1);
  const v1 = viewFor(st, 1, start);
  assert.ok(v1.players[1].garden[4], 'B 自身には見える');
});

test('できごと：反応フェーズでほかの人がしたことは、ラウンドの後にまとめて見える', () => {
  const j = new Journal(cat, 2);
  let st = createGame(cat, { players: [{ name: 'A' }, { name: 'B' }], seed: 3 });
  const step = (a) => { const b = st; st = applyAction(cat, st, a); j.record(b, a, st); };
  for (const p of [1, 0]) step({ type: 'draft', player: p, market: 0 });
  for (const p of [0, 1]) step({ type: 'pick', player: p, bundle: 0, bends: [] });
  step({ type: 'place', player: 1, pending: 0, cell: 4 });
  assert.ok(!j.logs[0].some((l) => l.includes('B：') && l.includes('置いた')));
  assert.ok(j.logs[1].some((l) => l.includes('置いた')));
  step({ type: 'done', player: 1 });
  step({ type: 'place', player: 0, pending: 0, cell: 0 });
  step({ type: 'done', player: 0 });
  while (st.players.some((p) => p.choice)) for (const p of [0, 1]) if (st.players[p].choice) step({ type: 'choose', player: p, value: cpuAction(cat, st, p).value });
  assert.ok(j.logs[0].some((l) => l.includes('B：') && l.includes('置いた')), 'ラウンド後には見える');
});

async function until(fn, ms = 20000) {
  const t0 = Date.now();
  while (!fn()) {
    if (Date.now() - t0 > ms) throw new Error('時間切れ');
    await sleep(5);
  }
}

function autoGuest(guest) { // 届いた見え方だけで、CPU の考え方で遊ぶ参加者
  guest.onChange(() => {
    const v = guest.view();
    if (!v || v.phase === 'end' || guest.waiting) return;
    if (!whoActs(v).includes(guest.me)) return;
    if (v.phase === 'react' && v.players[guest.me].status === 'done') return;
    const a = cpuAction(cat, v, guest.me);
    if (!a) return;
    guest.waiting = true;
    guest.act(a);
  });
  const orig = guest.listeners;
  guest.onChange(() => { guest.waiting = false; });
  return orig;
}

test('通信：部屋を作って入り、ホスト＋参加者＋CPU で最後まで遊べる', async () => {
  const hub = makeHub();
  const host = new HostRoom(hub.make('H'), { name: 'ホスト', count: 3, rounds: 3, expansions: ['base'], versions: cat.versions, makeCatalog: () => cat, timing: { cpuDelay: 0, reactDelay: 0 } });
  const guest = new GuestClient(hub.make('G'), { name: '参加者', token: 't1' });
  await until(() => host.seats.length === 2 && guest.lobbyInfo?.seats.length === 2);
  const game = host.start(5);
  await until(() => guest.view());
  assert.equal(guest.me, 1);
  assert.ok(guest.view().deck.every((x) => x === null), '参加者には山の並びが届かない');
  assert.equal(guest.view().players[2].cpu, 'normal');
  // 参加者は自分以外の席の操作を送れない（席はホストが決める）
  autoGuest(guest);
  // ホストの手も CPU の考え方で進める
  game.onChange(() => {
    const st = game.st;
    if (st.phase === 'end' || !whoActs(st).includes(0)) return;
    if (st.phase === 'react' && st.players[0].status === 'done') return;
    setTimeout(() => { if (whoActs(game.st).includes(0) && game.st.phase !== 'end') game.act(cpuAction(cat, game.st, 0)); }, 0);
  });
  game.changed();
  guest.emit();
  await until(() => game.st.phase === 'end' && guest.view()?.phase === 'end');
  assert.equal(guest.view().result.length, 3);
  assert.ok(guest.log().length > 5);
});

test('通信：版の違う人は入れない。抜けた人の席は CPU が代わり、同じ印で戻れる', async () => {
  const hub = makeHub();
  const host = new HostRoom(hub.make('H'), { name: 'ホスト', count: 2, rounds: 2, expansions: ['base'], versions: cat.versions, makeCatalog: () => cat, timing: { cpuDelay: 0, reactDelay: 0 } });
  const old = hub.make('X');
  let denied = null;
  old.on('deny', (m) => { denied = m.reason; });
  old.on('lobby', () => {});
  old.send('hello', { name: '古い', token: 'z', app: '0.0.1' });
  await until(() => denied);
  assert.match(denied, /版が違います/);

  const g1 = new GuestClient(hub.make('G1'), { name: '参加者', token: 'tok' });
  await until(() => host.seats.length === 2 && g1.lobbyInfo);
  const game = host.start(9);
  await until(() => g1.view());
  hub.drop(g1.net);
  await until(() => game.st.players[1].away);
  assert.equal(game.st.players[1].cpu, 'normal');
  const g2 = new GuestClient(hub.make('G2'), { name: '参加者', token: 'tok' });
  await until(() => !game.st.players[1].away && g2.view());
  assert.equal(g2.me, 1);
  assert.equal(game.st.players[1].cpu, null);
  clearTimeout(game.timer);
});

test('通信：参加者が送った操作は、送った人の席として扱う', async () => {
  const hub = makeHub();
  const host = new HostRoom(hub.make('H'), { name: 'ホスト', count: 2, rounds: 2, expansions: ['base'], versions: cat.versions, makeCatalog: () => cat, timing: { cpuDelay: 0, reactDelay: 0 } });
  const g = new GuestClient(hub.make('G'), { name: '参加者', token: 't' });
  await until(() => host.seats.length === 2);
  const game = host.start(1);
  await until(() => g.view());
  // 始まりの札は参加者（席1）から。席0 のふりをして送っても席1 として扱われる
  assert.deepEqual(whoActs(game.st), [1]);
  g.act({ type: 'draft', player: 0, market: 0 });
  await until(() => game.st.players[1].pending.length === 1);
  assert.equal(game.st.players[0].pending.length, 0);
  clearTimeout(game.timer);
  void byName; void applyMut;
});

test('部屋（#9）：部屋の中でゲームセットを変え、終わったら部屋に戻って、つないだまま次のゲームを始められる', async () => {
  const hub = makeHub();
  const host = new HostRoom(hub.make('H'), { name: 'ホスト', count: 2, rounds: 2, expansions: ['base'], versions: cat.versions, makeCatalog: () => cat, timing: { cpuDelay: 0, reactDelay: 0 } });
  const guest = new GuestClient(hub.make('G'), { name: '参加者', token: 't9' });
  await until(() => guest.lobbyInfo?.seats.length === 2);
  host.setSettings({ count: 4, rounds: 3 });
  await until(() => guest.lobbyInfo?.count === 4 && guest.lobbyInfo.rounds === 3);
  host.setSettings({ count: 1 }); // 入っている人数（2）より減らせない
  assert.equal(host.settings.count, 2);

  const game = host.start(7);
  await until(() => guest.view());
  assert.equal(game.st.rounds, 3);
  host.setSettings({ rounds: 6 }); // 始まっている間は変わらない
  assert.equal(host.settings.rounds, 3);

  host.backToRoom();
  await until(() => guest.lobbyInfo && !guest.lobbyInfo.started && guest.view() === null);
  assert.equal(host.seats.length, 2, '参加者は部屋に残る');

  host.setSettings({ rounds: 2 });
  const second = host.start(8);
  await until(() => guest.view()?.rounds === 2);
  assert.equal(second.st.players.length, 2);
  assert.equal(guest.me, 1);
  host.backToRoom();
});

test('投了（#10）：入った人が投了すると、席は CPU が代わって「投了」と残り、同じ印でも戻れない', async () => {
  const hub = makeHub();
  const host = new HostRoom(hub.make('H'), { name: 'ホスト', count: 2, rounds: 2, expansions: ['base'], versions: cat.versions, makeCatalog: () => cat, timing: { cpuDelay: 0, reactDelay: 0 } });
  const g1 = new GuestClient(hub.make('G1'), { name: '参加者', token: 'tok' });
  await until(() => host.seats.length === 2 && g1.lobbyInfo);
  const game = host.start(5);
  await until(() => g1.view());
  g1.resign();
  await until(() => game.st.players[1].resigned);
  assert.equal(game.st.players[1].cpu, 'normal');
  assert.ok(game.st.players[1].away);
  hub.drop(g1.net);
  const g2 = new GuestClient(hub.make('G2'), { name: '参加者', token: 'tok' });
  await until(() => g2.problem);
  assert.match(g2.problem, /投了/);
  // ホストが部屋に戻すと、投了した人の席は部屋から外れる
  host.backToRoom();
  assert.equal(host.seats.length, 1);
  clearTimeout(game.timer);
});
