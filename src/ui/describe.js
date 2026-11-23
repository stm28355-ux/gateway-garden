// カードの効果の部品から、説明文を作る（画面とカードの一覧で使う）。
// 「いつ」はキーワード（来訪・開花・芽吹き・摘み・実り・加護・手入れ）で書き、マウスを乗せると説明が出る（工程7で決定）。
// 「説明も書く」設定のときは、キーワードの後ろに短い説明を括弧で付ける（はじめは「なし」。工程7の判定 T4）。
export const COLOR_JA = { white: '白', red: '赤', blue: '青', green: '緑', yellow: '黄', any: '好きな色' };
export const ROLE_JA = { generate: '生成', guide: '導き', boost: '強化', convert: '変換', score: '得点', chain: '連鎖' };
export const GROWTH_JA = { early: '早熟', flat: '平ら', late: '晩成' };
export const stars = (n) => '★'.repeat(n);
const AREA_JA = { adjacent: '隣', row: '同じ行', column: '同じ列', cross: '同じ行と列', garden: '庭' };
const ELEM_ADJ = { white: '白い', red: '赤い', blue: '青い', green: '緑の', yellow: '黄色い' };
const POS_JA = { center: '中央', corner: '角', edge: '辺' };

// キーワードと、その説明（ことばの一覧にも出す）
export const KEYWORDS = {
  place: { word: '来訪', help: '庭に置いたとき' },
  activate: { word: '開花', help: 'ラウンドの終わりに毎回。庭の左上から順に' },
  grow: { word: '芽吹き', help: 'その★に育った瞬間に1回' },
  pick: { word: '摘み', help: '束を摘むとき' },
  end: { word: '実り', help: 'ゲームの終わりに点になる' },
  always: { word: '加護', help: '置いてある間ずっと' },
  use: { word: '手入れ', help: '手入れフェーズで好きなときに。1ラウンドに1回' },
};
export const RESONATE = { word: '呼応', help: 'そのカードの「開花」を、今すぐもう1回動かす' };
// 長い決まった文を短い言葉にまとめる（工程9 F1〜F3。呼応と同じく、マウスを乗せると説明が出る）
export const TERMS = {
  swap: { word: '入れ替え', help: '摘む束の1つを、場の別の束の1つと入れ替えてから摘む' },
  add: { word: 'おかわり', help: '摘んだ束にこのカードの色があれば、その色をもう1つ' },
  convert: { word: '変性', help: '手持ちの魔素を、決めた数まで好きな色に変える（色が書いてあればその色に）' },
};

let explain = false; // 「説明も書く」
export const setExplain = (v) => { explain = v; };
export const getExplain = () => explain;

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const kwHtml = (k, extra = '') => `<span class="kw" title="${esc(k.help)}">${k.word}${extra}</span>${explain ? `<span class="kw-help">（${esc(k.help)}）</span>` : ''}`;

const BEND_JA = {
  add: '摘んだ束にこのカードの色があれば、その色をもう1つ',
  swap: '摘む束の1つを、場の別の束の1つと入れ替えてから摘む',
  adjacent: '選んだ束の隣の束からも1つ摘む',
  redraw: '摘んだ束に同じ色が2つあれば、同じ色をもう1つ',
  recolor: '束の中の1つを別の色に変える',
};

function filterWords(f) {
  if (!f) return '';
  if (f.empty) return '空きマス';
  const w = [];
  if (f.position) w.push(`${POS_JA[f.position]}の`);
  if (f.minStage) w.push(`${stars(f.minStage)}以上の`);
  if (f.origin) w.push(f.origin === 'other' ? '違う世界の' : '同じ世界の');
  if (f.role) w.push(`${ROLE_JA[f.role]}の`);
  if (f.element) w.push(f.element === 'self' ? '同じ色の' : ELEM_ADJ[f.element]);
  return w.join('');
}

function target(area, filter) {
  if (area === 'self') return 'このカード';
  const f = filterWords(filter);
  if (f === '空きマス') return `${AREA_JA[area]}の空きマス`;
  return `${AREA_JA[area]}の${f}カード`;
}

// 本文（キーワードの後ろ）。html=true のときは呼応をキーワードとして描く
function body(e, def, html) {
  const n = e.amount ?? 1;
  const color = e.color === 'self' ? COLOR_JA[def.element] : COLOR_JA[e.color];
  switch (e.do) {
    case 'gain': return `${color}を${n}つ得る`;
    case 'convert': return `${html ? kwHtml(TERMS.convert, n) : `変性${n}`}${e.to === 'any' ? '' : `（${COLOR_JA[e.to]}）`}`;
    case 'stageUp': return `${target(e.area, e.filter)}1枚を★1つ育てる`;
    case 'discount': return `${target(e.area, e.filter)}を育てる魔素-${n}`;
    case 'score': return `${n}点`;
    case 'hoard': return `残った魔素${e.every}個につき${n}点`;
    case 'limit': return `持てる魔素+${n}`;
    case 'trigger': return html ? `${target(e.area, e.filter)}に${kwHtml(RESONATE)}` : `${target(e.area, e.filter)}に呼応（開花をすぐ動かす）`;
    case 'move': return `${target(e.area, e.filter)}1枚を別のマスへ動かす`;
    case 'bend': return TERMS[e.kind] ? (html ? kwHtml(TERMS[e.kind]) : TERMS[e.kind].word) : BEND_JA[e.kind];
    default: return e.do;
  }
}

function wrap(e, s) {
  if (e.per) s = `${target(e.per.area, e.per.filter)}ごとに${s}`;
  if (e.if) s = `${target(e.if.area, e.if.filter)}が${e.if.atLeast}枚以上なら、${s}`;
  if (e.at) s = `${POS_JA[e.at]}にあれば、${s}`;
  return s;
}

// 文字だけ（記録・できごと・テスト用）
export function effectText(e, def, stage) {
  const k = KEYWORDS[e.when];
  return `${k.word}：${wrap(e, body(e, def, false))}`;
}

// 画面用（キーワードにマウスを乗せると説明が出る）
export function effectHtml(e, def, stage) {
  const k = KEYWORDS[e.when];
  return `${kwHtml(k)}：${wrap(e, body(e, def, true))}`;
}

// 同じ「いつ」の効果は1行にまとめる（工程9 F4：開花：A、B）
function merged(def, i, head, rest) {
  const rows = [];
  for (const e of def.stages[i].effects) {
    const row = rows.find((r) => r.when === e.when);
    if (row) row.parts.push(rest(e));
    else rows.push({ when: e.when, head: head(e), parts: [rest(e)] });
  }
  return rows.length ? rows.map((r) => `${r.head}：${r.parts.join('、')}`) : ['（効果なし）'];
}

export function stageLines(def, i) {
  return merged(def, i, (e) => KEYWORDS[e.when].word, (e) => wrap(e, body(e, def, false)));
}

export function stageLinesHtml(def, i) {
  return merged(def, i, (e) => kwHtml(KEYWORDS[e.when]), (e) => wrap(e, body(e, def, true)));
}

export function costText(cost) {
  return Object.entries(cost).map(([c, n]) => `${COLOR_JA[c]}${n}`).join('・');
}

// ことばの一覧（遊び方とカードの一覧に出す）
export function glossaryHtml() {
  const rows = [...Object.values(KEYWORDS), RESONATE, ...Object.values(TERMS)].map((k) => `<tr><th>${k.word}</th><td>${esc(k.help)}</td></tr>`).join('');
  return `<table class="glossary">${rows}</table>`;
}
