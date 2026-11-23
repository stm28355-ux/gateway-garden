// セッション：画面が見る「ゲームの相手」。どれも同じ形で使える。
//   view()  … 自分から見た盤面（src/core/view.js）
//   log()   … 自分のできごと
//   me      … 自分の席
//   act(a)  … 操作を送る（すぐ分かる誤りは文字で返す）
//   onChange(fn)
// GameHost：1人で遊ぶとき・部屋を作った人。本物の状態を持ち、CPU を動かし、ほかの人には各人の見え方だけを送る。
// GuestClient：部屋に入った人。ホストから届く見え方を描き、操作はホストに送るだけ。
import { applyAction, createGame, whoActs, GameError } from '../core/game.js';
import { cpuAction } from '../core/cpu.js';
import { viewFor, snapshotReact } from '../core/view.js';
import { GOALS } from '../core/goals.js';
import { Journal } from './journal.js';
import { APP_VERSION } from '../version.js';

class Emitter {
  constructor() { this.listeners = []; }
  onChange(fn) { this.listeners.push(fn); }
  emit() { for (const fn of this.listeners) fn(); }
}

export class GameHost extends Emitter {
  constructor(cat, { players, rounds, seed, me = 0, cpuDelay = 700, reactDelay = 350 }) {
    super();
    this.cat = cat;
    this.me = me;
    this.cpuDelay = cpuDelay;
    this.reactDelay = reactDelay;
    this.st = createGame(cat, { players, rounds, seed });
    this.journal = new Journal(cat, players.length);
    this.journal.note(`ゲーム開始（種 ${seed}）。目標札：${this.st.goals.map((g) => GOALS[g].name).join('・')}`);
    this.record = { game: 'gateway-garden', app: APP_VERSION, seed, rounds, firstPlayer: this.st.firstPlayer, players: players.map((p) => p.name), versions: cat.versions, start: Date.now(), actions: [], roundTimes: [] };
    this.reactStart = null;
    this.timer = null;
    this.remote = new Map(); // 席 → 相手の peerId（部屋を作ったときだけ）
    this.net = null;
  }

  view(p = this.me) { return viewFor(this.st, p, this.reactStart); }
  log(p = this.me) { return this.journal.logs[p]; }
  elapsed() { return this.st.phase === 'end' ? this.record.roundTimes.at(-1) ?? 0 : Date.now() - this.record.start; }

  apply(a) {
    const before = this.st;
    this.st = applyAction(this.cat, before, a);
    this.record.actions.push({ t: Date.now() - this.record.start, a });
    this.journal.record(before, a, this.st);
    if (before.phase !== 'react' && this.st.phase === 'react') this.reactStart = snapshotReact(this.st);
    if (this.st.phase !== 'react') this.reactStart = null;
    if (this.st.round !== before.round || (this.st.phase === 'end' && before.phase !== 'end')) this.record.roundTimes.push(Date.now() - this.record.start);
  }

  act(a) {
    try {
      this.apply(a);
    } catch (e) {
      if (!(e instanceof GameError)) throw e;
      return e.message;
    }
    this.changed();
    return null;
  }

  changed() {
    this.emit();
    this.broadcast();
    this.schedule();
  }

  broadcast() {
    if (!this.net) return;
    for (const [seat, peer] of this.remote) {
      this.net.send('view', { view: this.view(seat), log: this.log(seat).slice(-40), me: seat, elapsed: this.elapsed() }, peer);
    }
  }

  schedule() {
    clearTimeout(this.timer);
    const st = this.st;
    if (st.phase === 'end') return;
    const cpus = whoActs(st).filter((p) => st.players[p].cpu);
    if (!cpus.length) return;
    if (st.phase === 'react') { // 反応フェーズは同時なので、CPU はまとめて終える
      this.timer = setTimeout(() => {
        for (const p of cpus) {
          for (let k = 0; k < 300 && this.st.phase === 'react' && this.st.players[p].status !== 'done'; k++) this.apply(cpuAction(this.cat, this.st, p));
        }
        this.changed();
      }, this.reactDelay);
    } else {
      this.timer = setTimeout(() => {
        this.apply(cpuAction(this.cat, this.st, cpus[0]));
        this.changed();
      }, this.cpuDelay);
    }
  }

  // 通信：抜けた人の席は CPU が代わりに遊ぶ。戻ってきたら返す
  leaveSeat(seat) {
    const pl = this.st.players[seat];
    pl.cpu = 'normal';
    pl.away = true;
    this.remote.delete(seat);
    this.journal.note(`${pl.name} が抜けたので、CPU が代わりに遊びます`);
    this.changed();
  }

  // 投了（#10）：その席は CPU が代わりに遊び、戻ってはこない。結果の表に「投了」と出す
  resignSeat(seat) {
    const pl = this.st.players[seat];
    if (!pl || pl.resigned) return;
    pl.resigned = true;
    pl.cpu = 'normal';
    pl.away = true;
    this.remote.delete(seat);
    this.journal.note(`${pl.name} が投了したので、CPU が代わりに遊びます`);
    this.changed();
  }

  returnSeat(seat, peer) {
    const pl = this.st.players[seat];
    pl.cpu = null;
    pl.away = false;
    this.remote.set(seat, peer);
    this.journal.note(`${pl.name} が戻りました`);
    this.changed();
  }
}

// ---- 部屋を作った人（ホスト） ------------------------------------------------

export const MAX_SEATS = 4; // 1つの部屋に入れる人数（ゲームの人数の上限）

// 部屋（#9）：1回つないだら、何ゲームも続けられる。ゲームセット（人数・長さ・世界）は部屋の中でホストが選び、入った人にも見える。
// ゲームが終わったら backToRoom で部屋に戻り、つながりはそのままで次のゲームを始める。
export class HostRoom extends Emitter {
  constructor(net, { name, count, rounds, expansions, versions, makeCatalog, timing = {} }) {
    super();
    this.net = net;
    this.settings = { count, rounds, expansions, versions };
    this.makeCatalog = makeCatalog;
    this.timing = timing; // テストで CPU の待ち時間を 0 にする
    this.seats = [{ name, peer: null, token: null }];
    this.game = null;
    this.problem = '';
    net.on('hello', (m, peer) => this.hello(m, peer));
    net.on('act', (a, peer) => this.remoteAct(a, peer));
    net.on('resign', (m, peer) => this.resigned(peer));
    net.on('lobby', () => { this.problem = '同じ合言葉の部屋がもう作られています。別の合言葉にしてください。'; this.emit(); });
    net.onJoin = () => this.sendLobby();
    net.onLeave = (peer) => this.left(peer);
  }

  lobby() {
    return { app: APP_VERSION, ...this.settings, seats: this.seats.map((s) => ({ name: s.name, here: true })), started: !!this.game };
  }

  sendLobby(peer) { this.net.send('lobby', this.lobby(), peer); this.emit(); }

  hello(m, peer) {
    if (m.app !== APP_VERSION) { this.net.send('deny', { reason: `ゲームの版が違います（ホスト ${APP_VERSION}・あなた ${m.app}）。ページを読み込み直してください。` }, peer); return; }
    if (this.game) {
      const seat = this.seats.findIndex((s) => s.token && s.token === m.token);
      if (seat < 0 || !this.game.st.players[seat]?.away) { this.net.send('deny', { reason: 'もう始まっています。' }, peer); return; }
      if (this.game.st.players[seat].resigned) { this.net.send('deny', { reason: '投了したので、このゲームには戻れません。終わるとホストが部屋に戻します。' }, peer); return; }
      this.seats[seat].peer = peer;
      this.game.returnSeat(seat, peer);
      return;
    }
    const again = this.seats.find((s) => s.token && s.token === m.token);
    if (again) again.peer = peer;
    else {
      if (this.seats.length >= MAX_SEATS) { this.net.send('deny', { reason: '部屋がいっぱいです。' }, peer); return; }
      let name = m.name || 'ゲスト';
      while (this.seats.some((s) => s.name === name)) name += '＋';
      this.seats.push({ name, peer, token: m.token });
      // 人数より多く入ってきたら、人数を増やす（ホストが後で減らせるのは、入っている人数まで）
      this.settings.count = Math.max(this.settings.count, this.seats.length);
    }
    this.sendLobby();
  }

  resigned(peer) {
    const seat = this.seats.findIndex((s) => s.peer === peer);
    if (seat < 0 || !this.game) return;
    this.seats[seat].peer = null;
    this.game.resignSeat(seat);
  }

  left(peer) {
    const seat = this.seats.findIndex((s) => s.peer === peer);
    if (seat < 0) return;
    if (this.game) { this.seats[seat].peer = null; this.game.leaveSeat(seat); return; }
    this.seats.splice(seat, 1);
    this.sendLobby();
  }

  // ゲームセットを変える（部屋の中でだけ。始まっている間は変えない）
  setSettings(s) {
    if (this.game) return;
    this.settings = { ...this.settings, ...s };
    this.settings.count = Math.min(MAX_SEATS, Math.max(this.settings.count, this.seats.length));
    this.sendLobby();
  }

  // ゲームが終わったら部屋に戻る。抜けたままの席（CPU が代わっていた人）は部屋から外す
  backToRoom() {
    if (!this.game) return;
    clearTimeout(this.game.timer);
    this.game.net = null;
    this.game = null;
    this.seats = this.seats.filter((s, i) => i === 0 || s.peer);
    this.sendLobby();
  }

  start(seed) {
    this.settings.count = Math.max(this.settings.count, this.seats.length);
    const cat = this.makeCatalog(this.settings.expansions);
    const players = this.seats.map((s) => ({ name: s.name }));
    for (let i = players.length; i < this.settings.count; i++) players.push({ name: `CPU${i - this.seats.length + 1}`, cpu: 'normal' });
    this.game = new GameHost(cat, { players, rounds: this.settings.rounds, seed, ...this.timing });
    this.game.net = this.net;
    this.seats.forEach((s, i) => { if (s.peer) this.game.remote.set(i, s.peer); });
    this.sendLobby();
    this.game.changed();
    return this.game;
  }

  remoteAct(a, peer) {
    if (!this.game) return;
    const seat = this.seats.findIndex((s) => s.peer === peer);
    if (seat < 0) return;
    const err = this.game.act({ ...a, player: seat }); // 席はホストが決める（ほかの人の操作は送れない）
    if (err) this.net.send('err', { message: err }, peer);
  }
}

// ---- 部屋に入った人 ----------------------------------------------------------

export class GuestClient extends Emitter {
  constructor(net, { name, token }) {
    super();
    this.net = net;
    this.name = name;
    this.token = token;
    this.hostId = null;
    this.lobbyInfo = null;
    this.st = null;
    this.lines = [];
    this.me = null;
    this.problem = '';
    this.error = '';
    this.elapsedMs = 0;
    net.on('lobby', (m, peer) => {
      this.hostId = peer;
      this.lobbyInfo = m;
      if (!m.started) { this.st = null; this.lines = []; this.error = ''; } // ホストが部屋に戻した（#9）
      this.emit();
    });
    net.on('deny', (m) => { this.problem = m.reason; this.emit(); });
    net.on('view', (m, peer) => {
      this.hostId = peer;
      this.st = m.view;
      this.lines = m.log;
      this.me = m.me;
      this.elapsedMs = m.elapsed;
      this.error = '';
      this.emit();
    });
    net.on('err', (m) => { this.error = m.message; this.emit(); });
    net.onJoin = () => this.sayHello();
    net.onLeave = (peer) => {
      if (peer === this.hostId) { this.problem = 'ホストとの接続が切れました。ホストが同じ合言葉で部屋を作り直すまで待つか、ページを読み込み直してください。'; this.emit(); }
    };
    this.sayHello();
  }

  sayHello() { this.net.send('hello', { name: this.name, token: this.token, app: APP_VERSION }); }
  view() { return this.st; }
  log() { return this.lines; }
  elapsed() { return this.elapsedMs; }
  // 投了（#10）：ホストに伝える。席は CPU が代わる。この後、画面は部屋から出る
  resign() { if (this.hostId) this.net.send('resign', {}, this.hostId); }

  act(a) {
    if (!this.hostId) return 'ホストとつながっていない';
    this.net.send('act', a, this.hostId);
    return null;
  }
}
