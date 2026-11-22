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
    this.record = { game: 'gateway-garden', app: APP_VERSION, seed, rounds, players: players.map((p) => p.name), versions: cat.versions, start: Date.now(), actions: [], roundTimes: [] };
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
      this.seats[seat].peer = peer;
      this.game.returnSeat(seat, peer);
      return;
    }
    const again = this.seats.find((s) => s.token && s.token === m.token);
    if (again) again.peer = peer;
    else {
      if (this.seats.length >= this.settings.count) { this.net.send('deny', { reason: '部屋がいっぱいです。' }, peer); return; }
      let name = m.name || 'ゲスト';
      while (this.seats.some((s) => s.name === name)) name += '＋';
      this.seats.push({ name, peer, token: m.token });
    }
    this.sendLobby();
  }

  left(peer) {
    const seat = this.seats.findIndex((s) => s.peer === peer);
    if (seat < 0) return;
    if (this.game) { this.seats[seat].peer = null; this.game.leaveSeat(seat); return; }
    this.seats.splice(seat, 1);
    this.sendLobby();
  }

  start(seed) {
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
    net.on('lobby', (m, peer) => { this.hostId = peer; this.lobbyInfo = m; this.emit(); });
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
  act(a) {
    if (!this.hostId) return 'ホストとつながっていない';
    this.net.send('act', a, this.hostId);
    return null;
  }
}
