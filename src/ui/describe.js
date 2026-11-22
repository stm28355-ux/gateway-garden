// 札の効果の部品から、やさしい日本語の説明を作る（画面と札一覧で使う）
export const COLOR_JA = { white: '白', red: '赤', blue: '青', green: '緑', yellow: '黄', any: '好きな色' };
export const ROLE_JA = { generate: '生成', guide: '導き', boost: '強化', convert: '変換', score: '得点', chain: '連鎖' };
export const GROWTH_JA = { early: '早熟', flat: '平ら', late: '晩成' };
const AREA_JA = { adjacent: '隣', row: '同じ行', column: '同じ列', cross: '同じ行と列', garden: '庭' };
const ELEM_ADJ = { white: '白い', red: '赤い', blue: '青い', green: '緑の', yellow: '黄色い' };
const POS_JA ={ center: '中央', corner: '角', edge: '辺' };
const WHEN_JA = {
  place: '置いたとき', activate: '発動', grow: 'この段階になったとき', pick: '拾うとき',
  end: '終わりに', always: '常に', use: '使う（1ラウンド1回）',
};
const BEND_JA = {
  add: '取った束にこの札の色があれば、その色をもう1つ',
  swap: '取る束の1つを、場の別の束の1つと入れ替えてから取る',
  adjacent: '選んだ束の隣の束からも1つ取る',
  redraw: '取った束に同じ色が2つあれば、同じ色をもう1つ',
  recolor: '束の中の1つを別の色に変える',
};

function filterWords(f) {
  if (!f) return '';
  if (f.empty) return '空きマス';
  const w = [];
  if (f.position) w.push(`${POS_JA[f.position]}の`);
  if (f.minStage) w.push(`段階${f.minStage}以上の`);
  if (f.origin) w.push(f.origin === 'other' ? '違う出身の' : '同じ出身の');
  if (f.role) w.push(`${ROLE_JA[f.role]}の`);
  if (f.element) w.push(f.element === 'self' ? '同じ色の' : ELEM_ADJ[f.element]);
  return w.join('');
}

function target(area, filter) {
  if (area === 'self') return 'この札';
  const f = filterWords(filter);
  if (f === '空きマス') return `${AREA_JA[area]}の空きマス`;
  return `${AREA_JA[area]}の${f}札`;
}

function body(e, def) {
  const n = e.amount ?? 1;
  const color = e.color === 'self' ? COLOR_JA[def.element] : COLOR_JA[e.color];
  switch (e.do) {
    case 'gain': return `${color}を${n}つ得る`;
    case 'convert': return `手持ちの素材${n}つまでを${COLOR_JA[e.to]}に変える`;
    case 'stageUp': return `${target(e.area, e.filter)}1枚の段階を+${n}`;
    case 'discount': return `${target(e.area, e.filter)}の育てる値段-${n}`;
    case 'score': return `${n}点`;
    case 'hoard': return `残った素材${e.every}個につき${n}点`;
    case 'limit': return `持てる素材+${n}`;
    case 'trigger': return `${target(e.area, e.filter)}を発動させる`;
    case 'move': return `${target(e.area, e.filter)}1枚を別のマスへ動かす`;
    case 'bend': return BEND_JA[e.kind];
    default: return e.do;
  }
}

export function effectText(e, def) {
  let s = body(e, def);
  if (e.per) s = `${target(e.per.area, e.per.filter)}1枚につき${s}`;
  if (e.if) s = `${target(e.if.area, e.if.filter)}が${e.if.atLeast}枚以上なら、${s}`;
  if (e.at) s = `${POS_JA[e.at]}にあれば、${s}`;
  return `${WHEN_JA[e.when]}：${s}`;
}

export function stageLines(def, i) {
  const st = def.stages[i];
  const lines = st.effects.map((e) => effectText(e, def));
  if (!lines.length) lines.push('（効果なし）');
  return lines;
}

export function costText(cost) {
  return Object.entries(cost).map(([c, n]) => `${c === 'any' ? '任' : COLOR_JA[c]}${n}`).join('・');
}
